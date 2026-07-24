-- Remote migration 20260724202022.
CREATE OR REPLACE FUNCTION private.skip_unqualified_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_order_created_at timestamptz;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT created_at
  INTO v_order_created_at
  FROM public.pedidos
  WHERE id = NEW.order_id;

  IF v_order_created_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM private.ambassador_qualifications q
    WHERE q.ambassador_id = NEW.ambassador_id
      AND v_order_created_at::date BETWEEN q.period_start AND q.period_end
      AND q.rule_code = 'monthly_purchase_qualification'
      AND q.status IN ('qualified', 'exception')
  ) THEN
    IF v_actor IS NOT NULL THEN
      INSERT INTO private.phase1_audit_events (
        actor_id, event_type, entity_type, entity_id, outcome_code, metadata
      )
      VALUES (
        v_actor,
        'commission_skipped_unqualified',
        'order',
        NEW.order_id,
        'ambassador_not_qualified',
        jsonb_build_object(
          'operation_scope', 'commission_generation',
          'operation_type', 'skip_unqualified_network_level'
        )
      );
    END IF;
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.skip_unqualified_commission()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_00_skip_unqualified_commission ON public.commissions;
CREATE TRIGGER trg_00_skip_unqualified_commission
BEFORE INSERT ON public.commissions
FOR EACH ROW
EXECUTE FUNCTION private.skip_unqualified_commission();
