BEGIN;

-- The first-purchase bonus was still using the pre-canonical
-- clientes.own_ambassador_id relationship. Official referrals now live in
-- the immutable order snapshot and customer_ambassador_assignments. The old
-- trigger also ran before the network commission trigger, so it could exit
-- before the direct commission existed.
CREATE OR REPLACE FUNCTION public.fn_generate_first_purchase_referral_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_customer public.clientes%ROWTYPE;
  v_assignment private.customer_ambassador_assignments%ROWTYPE;
  v_commission_id UUID;
  v_qualification_amount NUMERIC(12,2);
  v_commission_created BOOLEAN := FALSE;
  v_rows INTEGER := 0;
BEGIN
  IF NEW.status_pedido NOT IN ('entregue', 'finalizado')
     OR NEW.payment_check_status <> 'confirmado'
     OR COALESCE(NEW.payment_status, '') IN ('reembolsado', 'chargeback') THEN
    RETURN NEW;
  END IF;

  -- Re-evaluate an already-finalized order only when its bonus is still
  -- missing. This makes the repair idempotent without creating a bonus after
  -- a later refund/chargeback update.
  IF TG_OP = 'UPDATE'
     AND OLD.status_pedido IN ('entregue', 'finalizado')
     AND OLD.payment_check_status = 'confirmado'
     AND EXISTS (
       SELECT 1
       FROM public.first_purchase_referral_bonuses b
       WHERE b.order_id = NEW.id
     ) THEN
    RETURN NEW;
  END IF;

  IF NOT NEW.first_purchase_bonus_enabled_snapshot
     OR NEW.first_purchase_minimum_snapshot IS NULL
     OR NEW.first_purchase_bonus_amount_snapshot IS NULL
     OR NEW.first_purchase_bonus_effective_from_snapshot IS NULL
     OR NEW.cliente_id IS NULL
     OR NEW.ambassador_id IS NULL
     OR NEW.referral_assignment_id IS NULL
     OR NOT NEW.referral_validated_snapshot
     OR NOT NEW.referral_commissionable_snapshot
     OR NOT NEW.ambassador_qualified_snapshot
     OR NEW.commission_plan_id_snapshot IS NULL THEN
    RETURN NEW;
  END IF;

  v_qualification_amount := COALESCE(NEW.valor_total, 0);
  IF v_qualification_amount < NEW.first_purchase_minimum_snapshot THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('first_purchase_bonus:' || NEW.cliente_id::text, 0)
  );

  SELECT *
  INTO v_customer
  FROM public.clientes
  WHERE id = NEW.cliente_id
  FOR SHARE;

  IF v_customer.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validate the same official assignment captured by the order. The row may
  -- have been ended later; the order snapshot remains the source of truth.
  SELECT *
  INTO v_assignment
  FROM private.customer_ambassador_assignments
  WHERE id = NEW.referral_assignment_id
    AND customer_id = NEW.cliente_id
    AND ambassador_id = NEW.ambassador_id
    AND is_validated
    AND is_commissionable
    AND valid_from <= NEW.created_at
    AND (valid_until IS NULL OR valid_until >= NEW.created_at);

  IF v_assignment.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.first_purchase_referral_bonuses b
    WHERE b.customer_id = NEW.cliente_id
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pedidos previous_order
    WHERE previous_order.cliente_id = NEW.cliente_id
      AND previous_order.id <> NEW.id
      AND previous_order.created_at < NEW.created_at
      AND previous_order.status_pedido IN ('entregue', 'finalizado')
      AND previous_order.payment_check_status = 'confirmado'
      AND COALESCE(previous_order.payment_status, '') NOT IN ('reembolsado', 'chargeback')
      AND previous_order.first_purchase_bonus_enabled_snapshot
      AND previous_order.first_purchase_minimum_snapshot IS NOT NULL
      AND previous_order.valor_total >= previous_order.first_purchase_minimum_snapshot
  ) THEN
    RETURN NEW;
  END IF;

  -- Repair an existing commission row if a previous attempt inserted it but
  -- did not finish the bonus ledger row; otherwise create both exactly once.
  SELECT c.id
  INTO v_commission_id
  FROM public.commissions c
  WHERE c.order_id = NEW.id
    AND c.ambassador_id = NEW.ambassador_id
    AND c.commission_level = 1
    AND c.commission_type = 'first_purchase_bonus';

  IF v_commission_id IS NULL THEN
    INSERT INTO public.commissions (
      ambassador_id, order_id, customer_id, commission_plan_id, commission_level,
      commissionable_amount, order_amount_snapshot, percentage_snapshot, commission_amount,
      commission_type, fixed_bonus_amount_snapshot, qualification_minimum_snapshot,
      status, available_at
    ) VALUES (
      NEW.ambassador_id, NEW.id, NEW.cliente_id, NEW.commission_plan_id_snapshot, 1,
      COALESCE(NEW.commissionable_amount_snapshot, v_qualification_amount),
      v_qualification_amount,
      0,
      NEW.first_purchase_bonus_amount_snapshot,
      'first_purchase_bonus',
      NEW.first_purchase_bonus_amount_snapshot,
      NEW.first_purchase_minimum_snapshot,
      'liberada',
      now()
    )
    ON CONFLICT (order_id, ambassador_id, commission_level, commission_type) DO NOTHING
    RETURNING id INTO v_commission_id;

    v_commission_created := v_commission_id IS NOT NULL;
  END IF;

  IF v_commission_id IS NULL THEN
    SELECT c.id
    INTO v_commission_id
    FROM public.commissions c
    WHERE c.order_id = NEW.id
      AND c.ambassador_id = NEW.ambassador_id
      AND c.commission_level = 1
      AND c.commission_type = 'first_purchase_bonus';
  END IF;

  IF v_commission_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.first_purchase_referral_bonuses (
    customer_id, order_id, ambassador_id, commission_id, qualification_amount,
    qualification_minimum_snapshot, bonus_amount_snapshot, settings_effective_from_snapshot
  ) VALUES (
    NEW.cliente_id,
    NEW.id,
    NEW.ambassador_id,
    v_commission_id,
    v_qualification_amount,
    NEW.first_purchase_minimum_snapshot,
    NEW.first_purchase_bonus_amount_snapshot,
    NEW.first_purchase_bonus_effective_from_snapshot
  )
  ON CONFLICT (customer_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 AND v_commission_created THEN
    DELETE FROM public.commissions WHERE id = v_commission_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_generate_first_purchase_referral_bonus()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_first_purchase_referral_bonus()
  TO service_role;

-- AFTER triggers execute alphabetically. Run this trigger after the order
-- commission generator so the direct commission is available in the same
-- transaction, including for orders inserted already finalized/paid.
DROP TRIGGER IF EXISTS trg_generate_first_purchase_referral_bonus ON public.pedidos;
DROP TRIGGER IF EXISTS trg_zz_generate_first_purchase_referral_bonus ON public.pedidos;
CREATE TRIGGER trg_zz_generate_first_purchase_referral_bonus
AFTER INSERT OR UPDATE OF status_pedido, payment_check_status, payment_status
ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_generate_first_purchase_referral_bonus();

-- Make the push/in-app notification explicit for bonus commissions while
-- preserving the existing notification type and idempotency key.
CREATE OR REPLACE FUNCTION public.fn_create_commission_release_notification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'liberada' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'liberada' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.ambassador_notifications (
    ambassador_id,
    commission_id,
    title,
    body,
    amount
  )
  VALUES (
    NEW.ambassador_id,
    NEW.id,
    CASE
      WHEN NEW.commission_type = 'first_purchase_bonus'
        THEN 'Bônus de primeira compra liberado!'
      ELSE 'Nova comissão liberada!'
    END,
    CASE
      WHEN NEW.commission_type = 'first_purchase_bonus'
        THEN 'Seu bônus de indicação de R$ '
          || replace(to_char(NEW.commission_amount, 'FM999999990D00'), '.', ',')
          || ' já está disponível.'
      ELSE 'Sua comissão de R$ '
        || replace(to_char(NEW.commission_amount, 'FM999999990D00'), '.', ',')
        || ' já está disponível.'
    END,
    NEW.commission_amount
  )
  ON CONFLICT (commission_id, notification_type) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMIT;
