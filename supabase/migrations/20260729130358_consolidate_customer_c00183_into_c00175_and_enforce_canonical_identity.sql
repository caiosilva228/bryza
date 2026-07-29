-- Consolidates the checkout-created duplicate C00183 into canonical customer
-- C00175. This migration is intentionally fail-closed: if the audited graph
-- changes before execution, the transaction aborts and must be reviewed again.
DO $$
DECLARE
  v_canonical public.clientes%ROWTYPE;
  v_duplicate public.clientes%ROWTYPE;
  v_unexpected_links bigint;
BEGIN
  SELECT * INTO v_canonical
  FROM public.clientes
  WHERE codigo_cliente = 175
    AND regexp_replace(telefone, '[^0-9]', '', 'g') = '61982115107'
  FOR UPDATE;

  SELECT * INTO v_duplicate
  FROM public.clientes
  WHERE codigo_cliente = 183
    AND regexp_replace(telefone, '[^0-9]', '', 'g') = '61982115107'
  FOR UPDATE;

  IF v_canonical.id IS NULL
     OR v_duplicate.id IS NULL
     OR v_canonical.codigo_cliente <> 175
     OR v_duplicate.codigo_cliente <> 183
     OR v_canonical.person_id IS NULL
     OR v_duplicate.person_id IS NOT NULL
     OR regexp_replace(v_canonical.telefone, '[^0-9]', '', 'g')
        <> regexp_replace(v_duplicate.telefone, '[^0-9]', '', 'g')
     OR regexp_replace(v_canonical.telefone, '[^0-9]', '', 'g')
        <> '61982115107' THEN
    RAISE EXCEPTION 'customer_merge_preflight_identity_mismatch';
  END IF;

  IF (SELECT count(*) FROM public.agendamentos
      WHERE cliente_id = v_duplicate.id) <> 1
     OR (SELECT count(*) FROM public.pedidos
         WHERE cliente_id = v_duplicate.id) <> 1 THEN
    RAISE EXCEPTION 'customer_merge_preflight_order_graph_changed';
  END IF;

  SELECT
    (SELECT count(*) FROM public.vendas WHERE cliente_id = v_duplicate.id)
    + (SELECT count(*) FROM public.entregas WHERE cliente_id = v_duplicate.id)
    + (SELECT count(*) FROM public.funil_leads WHERE cliente_id = v_duplicate.id)
    + (SELECT count(*) FROM public.commissions WHERE customer_id = v_duplicate.id)
    + (SELECT count(*) FROM public.first_purchase_referral_bonuses
       WHERE customer_id = v_duplicate.id)
    + (SELECT count(*) FROM public.referral_attributions
       WHERE customer_id = v_duplicate.id)
    + (SELECT count(*) FROM private.customer_ambassador_assignments
       WHERE customer_id = v_duplicate.id)
    + (SELECT count(*) FROM private.customer_commercial_assignments
       WHERE customer_id = v_duplicate.id)
    + (SELECT count(*) FROM private.ambassador_invitation_eligibilities
       WHERE customer_id = v_duplicate.id)
    + (SELECT count(*) FROM private.ambassador_lost_commissions
       WHERE customer_id = v_duplicate.id)
    + (SELECT count(*) FROM private.legacy_referral_link_archive
       WHERE customer_id = v_duplicate.id)
    + (SELECT count(*) FROM private.operation_idempotency
       WHERE customer_id = v_duplicate.id)
  INTO v_unexpected_links;

  IF v_unexpected_links <> 0 THEN
    RAISE EXCEPTION 'customer_merge_preflight_unexpected_links:%',
      v_unexpected_links;
  END IF;

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);

  UPDATE public.agendamentos
  SET cliente_id = v_canonical.id
  WHERE cliente_id = v_duplicate.id;

  UPDATE public.pedidos
  SET cliente_id = v_canonical.id
  WHERE cliente_id = v_duplicate.id;

  -- These updates are deliberately retained even though the audited counts are
  -- zero, so the complete FK graph is explicit and future review is mechanical.
  UPDATE public.vendas SET cliente_id = v_canonical.id
  WHERE cliente_id = v_duplicate.id;
  UPDATE public.entregas SET cliente_id = v_canonical.id
  WHERE cliente_id = v_duplicate.id;
  UPDATE public.funil_leads SET cliente_id = v_canonical.id
  WHERE cliente_id = v_duplicate.id;
  UPDATE public.commissions SET customer_id = v_canonical.id
  WHERE customer_id = v_duplicate.id;
  UPDATE public.first_purchase_referral_bonuses
  SET customer_id = v_canonical.id
  WHERE customer_id = v_duplicate.id;
  UPDATE public.referral_attributions SET customer_id = v_canonical.id
  WHERE customer_id = v_duplicate.id;
  UPDATE private.customer_ambassador_assignments
  SET customer_id = v_canonical.id
  WHERE customer_id = v_duplicate.id;
  UPDATE private.customer_commercial_assignments
  SET customer_id = v_canonical.id
  WHERE customer_id = v_duplicate.id;
  UPDATE private.ambassador_invitation_eligibilities
  SET customer_id = v_canonical.id
  WHERE customer_id = v_duplicate.id;
  UPDATE private.ambassador_lost_commissions
  SET customer_id = v_canonical.id
  WHERE customer_id = v_duplicate.id;

  -- Historical/idempotency rows also remain referentially intact.
  UPDATE private.legacy_referral_link_archive
  SET customer_id = v_canonical.id
  WHERE customer_id = v_duplicate.id;
  UPDATE private.operation_idempotency
  SET customer_id = v_canonical.id
  WHERE customer_id = v_duplicate.id;

  UPDATE public.clientes
  SET lifecycle_status = 'archived',
      archived_at = now(),
      archived_by = NULL,
      archive_reason = 'Consolidado no cliente C00175; duplicidade de telefone normalizado',
      status_cliente = 'inativo'
  WHERE id = v_duplicate.id;

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, old_data, new_data,
    metadata
  )
  VALUES (
    NULL, 'migration', 'customer_identity_consolidated', 'clientes',
    v_canonical.id,
    jsonb_build_object(
      'duplicate_customer_id', v_duplicate.id,
      'duplicate_customer_code', v_duplicate.codigo_cliente
    ),
    jsonb_build_object(
      'canonical_customer_id', v_canonical.id,
      'canonical_customer_code', v_canonical.codigo_cliente
    ),
    jsonb_build_object(
      'reason', 'normalized_phone_duplicate',
      'moved_schedules', 1,
      'moved_orders', 1
    )
  );
END;
$$;

-- Database-level concurrency barrier. These expression indexes are the final
-- arbiter even if two canonical calls race or a privileged integration is buggy.
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_active_phone_normalized
  ON public.clientes (
    (
      CASE
        WHEN regexp_replace(telefone, '[^0-9]', '', 'g') ~ '^55[0-9]{10,11}$'
          THEN substring(regexp_replace(telefone, '[^0-9]', '', 'g') FROM 3)
        ELSE regexp_replace(telefone, '[^0-9]', '', 'g')
      END
    )
  )
  WHERE lifecycle_status = 'active'
    AND length(regexp_replace(telefone, '[^0-9]', '', 'g')) >= 10;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_active_cpf_digits
  ON public.clientes (
    (regexp_replace(cpf, '[^0-9]', '', 'g'))
  )
  WHERE lifecycle_status = 'active'
    AND length(regexp_replace(cpf, '[^0-9]', '', 'g')) = 11;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_active_person
  ON public.clientes (person_id)
  WHERE lifecycle_status = 'active' AND person_id IS NOT NULL;

-- Existing canonical RPCs set bryza.canonical_identity_write=true locally.
-- Reject every new customer row that bypasses those RPCs, including service-role
-- direct inserts. The flag is transaction-local in the canonical functions.
CREATE OR REPLACE FUNCTION private.prevent_independent_personal_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF coalesce(current_setting('bryza.canonical_identity_write', true), '') = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'clientes' AND TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'canonical_customer_insert_required'
      USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'clientes'
     AND OLD.person_id IS NOT NULL
     AND (
       NEW.nome IS DISTINCT FROM OLD.nome
       OR NEW.cpf IS DISTINCT FROM OLD.cpf
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.telefone IS DISTINCT FROM OLD.telefone
     ) THEN
    RAISE EXCEPTION 'canonical_identity_write_required' USING ERRCODE = '42501';
  ELSIF TG_TABLE_NAME = 'profiles'
     AND OLD.person_id IS NOT NULL
     AND (
       NEW.nome IS DISTINCT FROM OLD.nome
       OR NEW.cpf IS DISTINCT FROM OLD.cpf
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.telefone IS DISTINCT FROM OLD.telefone
     ) THEN
    RAISE EXCEPTION 'canonical_identity_write_required' USING ERRCODE = '42501';
  ELSIF TG_TABLE_NAME = 'ambassadors'
     AND OLD.person_id IS NOT NULL
     AND (
       NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.cpf IS DISTINCT FROM OLD.cpf
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.phone IS DISTINCT FROM OLD.phone
     ) THEN
    RAISE EXCEPTION 'canonical_identity_write_required' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_independent_personal_write()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_clientes_require_canonical_identity_write
  ON public.clientes;
CREATE TRIGGER trg_clientes_require_canonical_identity_write
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION private.prevent_independent_personal_write();
