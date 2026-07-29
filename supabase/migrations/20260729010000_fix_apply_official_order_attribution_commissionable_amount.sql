-- Migration: fix_apply_official_order_attribution_commissionable_amount
-- Problema: apply_official_order_attribution calculava commission_amount_snapshot
-- usando COALESCE(commissionable_amount_snapshot, valor_total) mas NUNCA
-- persistia o fallback no campo commissionable_amount_snapshot.
-- Isso fazia pedidos criados via agendamento/smart_link herdarem NULL do agendamento,
-- e a trigger fn_gerar_comissoes_multinivel falhava (ou era silenciosa).
--
-- Solução: quando referral_commissionable_snapshot = true e o campo é NULL,
-- preenchê-lo com valor_total antes de calcular commission_amount_snapshot.

CREATE OR REPLACE FUNCTION private.apply_official_order_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO private, public, pg_temp
AS $$
DECLARE
  v_assignment private.customer_ambassador_assignments%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_ambassador public.ambassadors%ROWTYPE;
  v_plan public.commission_plans%ROWTYPE;
  v_qualification private.ambassador_qualifications%ROWTYPE;
BEGIN
  NEW.ambassador_id := NULL;
  NEW.referral_assignment_id := NULL;
  NEW.referral_code_snapshot := NULL;
  NEW.referral_visit_id := NULL;
  NEW.attributed_at := NULL;
  NEW.attribution_source := NULL;
  NEW.commission_plan_id_snapshot := NULL;
  NEW.commission_percentage_snapshot := NULL;
  NEW.commissionable_amount_snapshot := NULL;
  NEW.commission_amount_snapshot := NULL;
  NEW.referral_validated_snapshot := false;
  NEW.referral_commissionable_snapshot := false;
  NEW.ambassador_qualified_snapshot := false;
  NEW.ambassador_qualification_id_snapshot := NULL;
  NEW.qualification_period_start_snapshot := NULL;
  NEW.qualification_period_end_snapshot := NULL;

  IF NEW.cliente_id IS NULL THEN
    NEW.first_purchase_bonus_enabled_snapshot := false;
    RETURN NEW;
  END IF;

  SELECT * INTO v_customer
  FROM public.clientes
  WHERE id = NEW.cliente_id
  FOR SHARE;

  IF v_customer.id IS NULL OR v_customer.lifecycle_status <> 'active' THEN
    RAISE EXCEPTION 'order_customer_not_found_or_inactive';
  END IF;

  SELECT * INTO v_assignment
  FROM private.customer_ambassador_assignments
  WHERE id = v_customer.current_referral_assignment_id
    AND customer_id = v_customer.id
    AND status = 'active'
    AND is_validated
  FOR SHARE;

  IF v_assignment.id IS NULL THEN
    NEW.first_purchase_bonus_enabled_snapshot := false;
    RETURN NEW;
  END IF;

  SELECT * INTO v_ambassador
  FROM public.ambassadors
  WHERE id = v_assignment.ambassador_id
    AND status = 'ativo'
    AND lifecycle_status = 'active'
  FOR SHARE;

  IF v_ambassador.id IS NULL THEN
    NEW.first_purchase_bonus_enabled_snapshot := false;
    RETURN NEW;
  END IF;

  IF v_customer.person_id IS NOT NULL
     AND v_ambassador.person_id IS NOT NULL
     AND v_customer.person_id = v_ambassador.person_id THEN
    INSERT INTO private.phase1_audit_events (
      actor_id, event_type, entity_type, entity_id, outcome_code, metadata
    )
    SELECT
      coalesce(auth.uid(), (SELECT id FROM public.profiles WHERE ativo LIMIT 1)),
      'order_self_referral_blocked',
      'customer_ambassador_assignment',
      v_assignment.id,
      'self_referral_forbidden',
      jsonb_build_object(
        'operation_scope', 'order_creation',
        'operation_type', 'apply_official_attribution'
      );

    NEW.first_purchase_bonus_enabled_snapshot := false;
    RETURN NEW;
  END IF;

  SELECT * INTO v_plan
  FROM public.commission_plans
  WHERE id = v_ambassador.commission_plan_id
    AND status = 'ativo'
  FOR SHARE;

  SELECT * INTO v_qualification
  FROM private.ambassador_qualifications
  WHERE ambassador_id = v_ambassador.id
    AND NEW.created_at::date BETWEEN period_start AND period_end
    AND rule_code = 'monthly_purchase_qualification'
  ORDER BY evaluated_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  NEW.ambassador_id := v_ambassador.id;
  NEW.referral_assignment_id := v_assignment.id;
  NEW.referral_code_snapshot := v_ambassador.referral_code;
  NEW.attributed_at := now();
  NEW.attribution_source := CASE v_assignment.source
    WHEN 'admin_selection' THEN 'admin_manual'::public.attribution_source_type
    WHEN 'manual_order_selection' THEN 'admin_manual'::public.attribution_source_type
    WHEN 'smart_link' THEN 'smart_link'::public.attribution_source_type
    WHEN 'manual_code' THEN 'customer_registration'::public.attribution_source_type
    ELSE 'admin_manual'::public.attribution_source_type
  END;
  NEW.referral_validated_snapshot := v_assignment.is_validated;
  NEW.ambassador_qualification_id_snapshot := v_qualification.id;
  NEW.qualification_period_start_snapshot := v_qualification.period_start;
  NEW.qualification_period_end_snapshot := v_qualification.period_end;
  NEW.ambassador_qualified_snapshot := coalesce(
    v_qualification.status IN ('qualified', 'exception'),
    false
  );
  NEW.referral_commissionable_snapshot :=
    v_assignment.is_commissionable
    AND NEW.ambassador_qualified_snapshot
    AND v_plan.id IS NOT NULL;

  IF v_plan.id IS NOT NULL THEN
    NEW.commission_plan_id_snapshot := v_plan.id;
    NEW.commission_percentage_snapshot := coalesce(v_plan.direct_percentage, 0);
  END IF;

  IF NEW.referral_commissionable_snapshot THEN
    -- FIX: garante que commissionable_amount_snapshot seja sempre preenchido
    -- quando comissionável, resolvendo bug de pedidos via agendamento/smart_link
    -- onde o agendamento não tinha o campo preenchido.
    IF NEW.commissionable_amount_snapshot IS NULL THEN
      NEW.commissionable_amount_snapshot := NEW.valor_total;
    END IF;
    NEW.commission_amount_snapshot := round(
      NEW.commissionable_amount_snapshot
      * coalesce(NEW.commission_percentage_snapshot, 0) / 100,
      2
    );
  ELSE
    NEW.commissionable_amount_snapshot := NULL;
    NEW.commission_amount_snapshot := 0;
    NEW.first_purchase_bonus_enabled_snapshot := false;
  END IF;

  RETURN NEW;
END;
$$;
