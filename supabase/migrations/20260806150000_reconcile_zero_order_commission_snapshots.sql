-- Reconcile commission snapshots when an order is persisted before its items.
-- This keeps manual orders and delayed item writes from freezing a zero base.

CREATE OR REPLACE FUNCTION private.reconcile_order_commission_snapshot(
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO private, public, pg_temp
AS $function$
DECLARE
  v_order public.pedidos%ROWTYPE;
  v_base numeric(12,2);
  v_commission_amount numeric(12,2);
BEGIN
  SELECT p.*
  INTO v_order
  FROM public.pedidos p
  WHERE p.id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL
     OR v_order.ambassador_id IS NULL
     OR v_order.referral_assignment_id IS NULL
     OR NOT v_order.referral_validated_snapshot
     OR NOT v_order.referral_commissionable_snapshot
     OR NOT v_order.ambassador_qualified_snapshot
     OR v_order.commission_plan_id_snapshot IS NULL
     OR v_order.commission_percentage_snapshot IS NULL THEN
    RETURN;
  END IF;

  v_base := round(coalesce(v_order.valor_total, 0), 2);

  IF v_base <= 0
     OR coalesce(v_order.commissionable_amount_snapshot, 0) > 0 THEN
    RETURN;
  END IF;

  v_commission_amount := round(
    v_base * v_order.commission_percentage_snapshot / 100.0,
    2
  );

  PERFORM set_config('bryza.allow_order_snapshot_update', 'true', true);

  UPDATE public.pedidos
  SET commissionable_amount_snapshot = v_base,
      commission_amount_snapshot = v_commission_amount,
      updated_at = now()
  WHERE id = v_order.id
    AND coalesce(commissionable_amount_snapshot, 0) <= 0;

  -- The insert trigger is skipped when the original snapshot was zero. Run the
  -- same canonical generator after the corrected snapshot is frozen.
  PERFORM public.fn_gerar_comissoes_multinivel(v_order.id);
END;
$function$;

REVOKE ALL ON FUNCTION private.reconcile_order_commission_snapshot(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.reconcile_order_commission_snapshot(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION private.reconcile_order_commission_after_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO private, public, pg_temp
AS $function$
BEGIN
  PERFORM private.reconcile_order_commission_snapshot(NEW.id);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.reconcile_order_commission_after_order_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.reconcile_order_commission_after_order_change()
  TO service_role;

DROP TRIGGER IF EXISTS trg_00_reconcile_order_commission_after_order
  ON public.pedidos;
CREATE TRIGGER trg_00_reconcile_order_commission_after_order
AFTER INSERT OR UPDATE OF valor_total ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION private.reconcile_order_commission_after_order_change();

CREATE OR REPLACE FUNCTION private.reconcile_order_commission_after_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO private, public, pg_temp
AS $function$
BEGIN
  PERFORM private.reconcile_order_commission_snapshot(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.pedido_id ELSE NEW.pedido_id END
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.reconcile_order_commission_after_item_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.reconcile_order_commission_after_item_change()
  TO service_role;

DROP TRIGGER IF EXISTS trg_00_reconcile_order_commission_after_item
  ON public.pedido_itens;
CREATE TRIGGER trg_00_reconcile_order_commission_after_item
AFTER INSERT OR UPDATE OF quantidade, preco_unitario, subtotal, desconto_aplicado
  OR DELETE ON public.pedido_itens
FOR EACH ROW
EXECUTE FUNCTION private.reconcile_order_commission_after_item_change();
