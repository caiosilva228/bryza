BEGIN;

ALTER TABLE public.ambassador_program_settings
  ADD COLUMN IF NOT EXISTS monthly_activation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS monthly_activation_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activation_grace_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activation_basis TEXT NOT NULL DEFAULT 'vendas_pessoais';

ALTER TABLE public.ambassador_program_settings
  DROP CONSTRAINT IF EXISTS ambassador_program_settings_monthly_activation_amount_check,
  DROP CONSTRAINT IF EXISTS ambassador_program_settings_activation_grace_days_check,
  DROP CONSTRAINT IF EXISTS ambassador_program_settings_activation_basis_check,
  ADD CONSTRAINT ambassador_program_settings_monthly_activation_amount_check
    CHECK (monthly_activation_amount >= 0),
  ADD CONSTRAINT ambassador_program_settings_activation_grace_days_check
    CHECK (activation_grace_days BETWEEN 0 AND 90),
  ADD CONSTRAINT ambassador_program_settings_activation_basis_check
    CHECK (activation_basis IN ('vendas_pessoais', 'compras_pessoais'));

CREATE TABLE public.commission_plan_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_plan_id UUID NOT NULL REFERENCES public.commission_plans(id) ON DELETE RESTRICT,
  level_number SMALLINT NOT NULL CHECK (level_number BETWEEN 1 AND 10),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT commission_plan_levels_plan_level_key UNIQUE (commission_plan_id, level_number)
);

CREATE INDEX idx_commission_plan_levels_plan_enabled
  ON public.commission_plan_levels(commission_plan_id, level_number) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_ambassadors_parent_id
  ON public.ambassadors(parent_ambassador_id) WHERE parent_ambassador_id IS NOT NULL;

INSERT INTO public.commission_plan_levels
  (commission_plan_id, level_number, name, percentage, enabled)
SELECT cp.id, source.level_number, 'Nível ' || source.level_number, source.percentage, TRUE
FROM public.commission_plans cp
CROSS JOIN LATERAL (VALUES
  (1::smallint, cp.direct_percentage),
  (2::smallint, cp.level_2_percentage),
  (3::smallint, cp.level_3_percentage)
) AS source(level_number, percentage)
WHERE source.level_number = 1
   OR (cp.multilevel_enabled AND source.percentage > 0)
ON CONFLICT (commission_plan_id, level_number) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_validate_commission_plan_levels()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan_id UUID := COALESCE(NEW.commission_plan_id, OLD.commission_plan_id);
  v_count INTEGER;
  v_min INTEGER;
  v_max INTEGER;
  v_total NUMERIC;
BEGIN
  SELECT count(*), min(level_number), max(level_number), COALESCE(sum(percentage), 0)
    INTO v_count, v_min, v_max, v_total
  FROM public.commission_plan_levels
  WHERE commission_plan_id = v_plan_id AND enabled;

  IF v_count < 1 OR v_min <> 1 OR v_max <> v_count THEN
    RAISE EXCEPTION 'Os níveis ativos devem ser contíguos e começar no nível 1.';
  END IF;
  IF v_count > 10 THEN RAISE EXCEPTION 'O plano aceita no máximo 10 níveis.'; END IF;
  IF v_total > 100 THEN RAISE EXCEPTION 'A soma das comissões não pode superar 100%%.'; END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_validate_commission_plan_levels
AFTER INSERT OR UPDATE OR DELETE ON public.commission_plan_levels
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_commission_plan_levels();

CREATE OR REPLACE FUNCTION public.fn_sync_legacy_commission_percentages()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan_id UUID := COALESCE(NEW.commission_plan_id, OLD.commission_plan_id);
BEGIN
  UPDATE public.commission_plans SET
    direct_percentage = COALESCE((SELECT percentage FROM public.commission_plan_levels WHERE commission_plan_id = v_plan_id AND level_number = 1 AND enabled), 0),
    level_2_percentage = COALESCE((SELECT percentage FROM public.commission_plan_levels WHERE commission_plan_id = v_plan_id AND level_number = 2 AND enabled), 0),
    level_3_percentage = COALESCE((SELECT percentage FROM public.commission_plan_levels WHERE commission_plan_id = v_plan_id AND level_number = 3 AND enabled), 0),
    multilevel_enabled = EXISTS (SELECT 1 FROM public.commission_plan_levels WHERE commission_plan_id = v_plan_id AND level_number > 1 AND enabled),
    updated_at = now()
  WHERE id = v_plan_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_legacy_commission_percentages
AFTER INSERT OR UPDATE OR DELETE ON public.commission_plan_levels
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_legacy_commission_percentages();

ALTER TABLE public.commissions DROP CONSTRAINT commissions_commission_level_check;
ALTER TABLE public.commissions ADD CONSTRAINT commissions_commission_level_check
  CHECK (commission_level BETWEEN 1 AND 10);

ALTER TABLE public.commission_plan_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY commission_plan_levels_deny_direct_access
  ON public.commission_plan_levels AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);
REVOKE ALL ON public.commission_plan_levels FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.commission_plan_levels TO service_role;

CREATE OR REPLACE FUNCTION public.fn_gerar_comissoes_multinivel(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.pedidos%ROWTYPE;
  v_direct public.ambassadors%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_node RECORD;
  v_amount NUMERIC(12,2);
  v_status TEXT;
  v_count INTEGER := 0;
  v_rows INTEGER := 0;
BEGIN
  SELECT * INTO v_order FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF v_order.id IS NULL OR v_order.ambassador_id IS NULL OR v_order.commission_plan_id_snapshot IS NULL THEN
    RETURN jsonb_build_object('sucesso', TRUE, 'criadas', 0);
  END IF;
  SELECT * INTO v_direct FROM public.ambassadors WHERE id = v_order.ambassador_id;
  SELECT * INTO v_customer FROM public.clientes WHERE id = v_order.cliente_id;
  IF v_direct.id IS NULL THEN RETURN jsonb_build_object('sucesso', TRUE, 'criadas', 0); END IF;
  IF v_customer.own_ambassador_id = v_direct.id
     OR (v_customer.cpf IS NOT NULL AND v_customer.cpf = v_direct.cpf)
     OR (regexp_replace(COALESCE(v_customer.telefone,''), '[^0-9]', '', 'g') <> '' AND
         regexp_replace(COALESCE(v_customer.telefone,''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(v_direct.phone,''), '[^0-9]', '', 'g')) THEN
    RETURN jsonb_build_object('sucesso', TRUE, 'criadas', 0, 'motivo', 'autoindicacao_bloqueada');
  END IF;

  v_status := CASE
    WHEN v_order.status_pedido = 'cancelado' THEN 'cancelada'
    WHEN v_order.status_pedido IN ('entregue','finalizado') AND v_order.payment_check_status = 'confirmado' THEN 'liberada'
    WHEN v_order.status_pedido IN ('entregue','finalizado') THEN 'aguardando_pagamento'
    ELSE 'aguardando_entrega' END;

  FOR v_node IN
    WITH RECURSIVE chain AS (
      SELECT a.id, a.parent_ambassador_id, a.status, 1::integer AS level_number, ARRAY[a.id]::uuid[] AS path
      FROM public.ambassadors a WHERE a.id = v_order.ambassador_id
      UNION ALL
      SELECT parent.id, parent.parent_ambassador_id, parent.status, chain.level_number + 1, chain.path || parent.id
      FROM chain
      JOIN public.ambassadors parent ON parent.id = chain.parent_ambassador_id
      WHERE chain.level_number < 10 AND NOT parent.id = ANY(chain.path)
    )
    SELECT chain.id AS ambassador_id, chain.status, levels.level_number, levels.percentage
    FROM chain
    JOIN public.commission_plan_levels levels
      ON levels.commission_plan_id = v_order.commission_plan_id_snapshot
     AND levels.level_number = chain.level_number
     AND levels.enabled
    ORDER BY levels.level_number
  LOOP
    IF v_node.percentage > 0 AND v_node.status = 'ativo' THEN
      v_amount := round(v_order.commissionable_amount_snapshot * v_node.percentage / 100.0, 2);
      INSERT INTO public.commissions (
        ambassador_id, order_id, customer_id, commission_plan_id, commission_level,
        commissionable_amount, order_amount_snapshot, percentage_snapshot, commission_amount,
        status, available_at, cancelled_at
      ) VALUES (
        v_node.ambassador_id, v_order.id, v_order.cliente_id, v_order.commission_plan_id_snapshot, v_node.level_number,
        v_order.commissionable_amount_snapshot, v_order.valor_total, v_node.percentage, v_amount,
        v_status, CASE WHEN v_status = 'liberada' THEN now() END,
        CASE WHEN v_status = 'cancelada' THEN now() END
      ) ON CONFLICT (order_id, ambassador_id, commission_level) DO NOTHING;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_count := v_count + v_rows;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('sucesso', TRUE, 'criadas', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_gerar_comissoes_multinivel(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_gerar_comissoes_multinivel(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_trg_valida_comissao_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.pedidos%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_expected UUID;
  v_expected_pct NUMERIC(5,2);
BEGIN
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  SELECT * INTO v_order FROM public.pedidos WHERE id = NEW.order_id;
  IF v_order.id IS NULL OR v_order.ambassador_id IS NULL THEN RAISE EXCEPTION 'Comissão sem pedido ou indicação válida.'; END IF;
  IF NEW.commission_level NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Nível de comissão inválido.'; END IF;

  WITH RECURSIVE chain AS (
    SELECT a.id, a.parent_ambassador_id, 1::integer AS level_number, ARRAY[a.id]::uuid[] AS path
    FROM public.ambassadors a WHERE a.id = v_order.ambassador_id
    UNION ALL
    SELECT parent.id, parent.parent_ambassador_id, chain.level_number + 1, chain.path || parent.id
    FROM chain JOIN public.ambassadors parent ON parent.id = chain.parent_ambassador_id
    WHERE chain.level_number < NEW.commission_level AND NOT parent.id = ANY(chain.path)
  )
  SELECT id INTO v_expected FROM chain WHERE level_number = NEW.commission_level;

  IF v_expected IS NULL OR NEW.ambassador_id IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'Beneficiário não corresponde ao nível da rede.';
  END IF;
  IF NEW.commission_plan_id IS DISTINCT FROM v_order.commission_plan_id_snapshot
     OR NEW.commissionable_amount IS DISTINCT FROM v_order.commissionable_amount_snapshot THEN
    RAISE EXCEPTION 'Snapshots da comissão divergem do pedido.';
  END IF;
  SELECT percentage INTO v_expected_pct
  FROM public.commission_plan_levels
  WHERE commission_plan_id = NEW.commission_plan_id
    AND level_number = NEW.commission_level AND enabled;
  IF v_expected_pct IS NULL THEN RAISE EXCEPTION 'Nível inexistente ou inativo no plano.'; END IF;
  IF NEW.percentage_snapshot IS DISTINCT FROM v_expected_pct
     OR NEW.commission_amount IS DISTINCT FROM round(NEW.commissionable_amount * v_expected_pct / 100.0, 2) THEN
    RAISE EXCEPTION 'Cálculo da comissão divergente do plano.';
  END IF;
  SELECT * INTO v_customer FROM public.clientes WHERE id = v_order.cliente_id;
  IF v_customer.own_ambassador_id = NEW.ambassador_id
     OR (v_customer.cpf IS NOT NULL AND v_customer.cpf = (SELECT cpf FROM public.ambassadors WHERE id = NEW.ambassador_id))
     OR (regexp_replace(COALESCE(v_customer.telefone,''), '[^0-9]', '', 'g') <> '' AND
         regexp_replace(COALESCE(v_customer.telefone,''), '[^0-9]', '', 'g') = regexp_replace(COALESCE((SELECT phone FROM public.ambassadors WHERE id = NEW.ambassador_id),''), '[^0-9]', '', 'g')) THEN
    RAISE EXCEPTION 'Autoindicação detectada.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_admin_save_ambassador_program_settings(
  p_actor_id UUID,
  p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings public.ambassador_program_settings%ROWTYPE;
  v_old_plan public.commission_plans%ROWTYPE;
  v_old_data JSONB;
  v_plan JSONB := p_payload->'defaultPlan';
  v_levels JSONB := p_payload->'defaultPlan'->'levels';
  v_new_plan_id UUID;
  v_enabled_count INTEGER;
  v_enabled_min INTEGER;
  v_enabled_max INTEGER;
  v_enabled_total NUMERIC;
  v_l1 NUMERIC;
  v_l2 NUMERIC := 0;
  v_l3 NUMERIC := 0;
  v_result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role::text = 'admin' AND ativo) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object' OR jsonb_typeof(v_plan) <> 'object' OR jsonb_typeof(v_levels) <> 'array' THEN
    RAISE EXCEPTION 'Configurações incompletas.';
  END IF;

  SELECT * INTO v_settings FROM public.ambassador_program_settings WHERE singleton FOR UPDATE;
  IF v_settings.id IS NULL THEN RAISE EXCEPTION 'Configuração central não encontrada.'; END IF;
  SELECT * INTO v_old_plan FROM public.commission_plans WHERE id = v_settings.default_commission_plan_id FOR SHARE;
  IF v_old_plan.id IS NULL THEN RAISE EXCEPTION 'Plano padrão não encontrado.'; END IF;

  IF jsonb_array_length(v_levels) < 1 OR jsonb_array_length(v_levels) > 10 THEN
    RAISE EXCEPTION 'O plano deve ter entre 1 e 10 níveis.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(v_levels) AS level(level_number integer, name text, percentage numeric, enabled boolean)
    WHERE level.level_number NOT BETWEEN 1 AND 10
       OR level.name IS NULL OR char_length(trim(level.name)) NOT BETWEEN 1 AND 60
       OR level.percentage IS NULL OR level.percentage NOT BETWEEN 0 AND 100
       OR level.enabled IS NULL
  ) THEN RAISE EXCEPTION 'Nível, nome, percentual ou situação inválidos.'; END IF;
  IF (SELECT count(DISTINCT level_number) FROM jsonb_to_recordset(v_levels) AS level(level_number integer)) <> jsonb_array_length(v_levels)
     OR (SELECT min(level_number) FROM jsonb_to_recordset(v_levels) AS level(level_number integer)) <> 1
     OR (SELECT max(level_number) FROM jsonb_to_recordset(v_levels) AS level(level_number integer)) <> jsonb_array_length(v_levels) THEN
    RAISE EXCEPTION 'A numeração dos níveis deve ser única e sequencial.';
  END IF;

  SELECT count(*), min(level_number), max(level_number), COALESCE(sum(percentage),0),
         max(percentage) FILTER (WHERE level_number = 1),
         COALESCE(max(percentage) FILTER (WHERE level_number = 2),0),
         COALESCE(max(percentage) FILTER (WHERE level_number = 3),0)
    INTO v_enabled_count, v_enabled_min, v_enabled_max, v_enabled_total, v_l1, v_l2, v_l3
  FROM jsonb_to_recordset(v_levels) AS level(level_number integer, name text, percentage numeric, enabled boolean)
  WHERE enabled;
  IF v_enabled_count < 1 OR v_enabled_min <> 1 OR v_enabled_max <> v_enabled_count OR v_l1 <= 0 THEN
    RAISE EXCEPTION 'Os níveis ativos devem ser contíguos, começar no nível 1 e possuir comissão direta positiva.';
  END IF;
  IF v_enabled_total > 100 THEN RAISE EXCEPTION 'A soma das comissões não pode superar 100%%.'; END IF;

  IF char_length(trim(COALESCE(v_plan->>'name',''))) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Nome do plano inválido.'; END IF;
  IF COALESCE(v_plan->>'commissionBase','') NOT IN ('valor_final','valor_bruto','valor_liquido') THEN RAISE EXCEPTION 'Base de comissão inválida.'; END IF;
  IF COALESCE(p_payload->>'programStatus','') NOT IN ('ativo','pausado','encerrado') THEN RAISE EXCEPTION 'Status do programa inválido.'; END IF;
  IF COALESCE(p_payload->>'paymentFrequency','') NOT IN ('semanal','quinzenal','mensal') THEN RAISE EXCEPTION 'Frequência de pagamento inválida.'; END IF;
  IF COALESCE(p_payload->>'activationBasis','') NOT IN ('vendas_pessoais','compras_pessoais') THEN RAISE EXCEPTION 'Base de ativação inválida.'; END IF;
  IF (p_payload->>'referralAttributionDays')::integer NOT BETWEEN 1 AND 3650
     OR (p_payload->>'minimumPaymentAmount')::numeric NOT BETWEEN 0 AND 1000000
     OR (p_payload->>'monthlyActivationAmount')::numeric NOT BETWEEN 0 AND 1000000
     OR (p_payload->>'activationGraceDays')::integer NOT BETWEEN 0 AND 90 THEN
    RAISE EXCEPTION 'Valores numéricos fora dos limites permitidos.';
  END IF;
  IF (p_payload->>'monthlyActivationEnabled')::boolean
     AND (p_payload->>'monthlyActivationAmount')::numeric <= 0 THEN
    RAISE EXCEPTION 'A ativação mensal habilitada exige valor maior que zero.';
  END IF;
  IF jsonb_typeof(p_payload->'allowPixEdit') <> 'boolean'
     OR jsonb_typeof(p_payload->'requirePixChangeApproval') <> 'boolean'
     OR jsonb_typeof(p_payload->'monthlyActivationEnabled') <> 'boolean' THEN
    RAISE EXCEPTION 'Configurações booleanas inválidas.';
  END IF;

  SELECT jsonb_build_object(
    'settings', to_jsonb(v_settings), 'plan', to_jsonb(v_old_plan),
    'levels', COALESCE((SELECT jsonb_agg(to_jsonb(levels) ORDER BY level_number) FROM public.commission_plan_levels levels WHERE commission_plan_id = v_old_plan.id), '[]'::jsonb)
  ) INTO v_old_data;

  INSERT INTO public.commission_plans
    (name, direct_percentage, level_2_percentage, level_3_percentage, multilevel_enabled, commission_base, status, valid_from)
  VALUES
    (trim(v_plan->>'name'), v_l1, v_l2, v_l3, v_enabled_count > 1, v_plan->>'commissionBase', 'ativo', now())
  RETURNING id INTO v_new_plan_id;

  INSERT INTO public.commission_plan_levels
    (commission_plan_id, level_number, name, percentage, enabled)
  SELECT v_new_plan_id, level_number, trim(name), percentage, enabled
  FROM jsonb_to_recordset(v_levels) AS level(level_number integer, name text, percentage numeric, enabled boolean)
  ORDER BY level_number;

  UPDATE public.ambassadors SET commission_plan_id = v_new_plan_id, updated_at = now()
  WHERE commission_plan_id = v_old_plan.id;

  UPDATE public.ambassador_program_settings SET
    default_commission_plan_id = v_new_plan_id,
    program_status = p_payload->>'programStatus',
    referral_attribution_days = (p_payload->>'referralAttributionDays')::integer,
    referral_destination_url = NULLIF(trim(p_payload->>'referralDestinationUrl'), ''),
    whatsapp_number = NULLIF(trim(p_payload->>'whatsappNumber'), ''),
    whatsapp_message_template = NULLIF(trim(p_payload->>'whatsappMessageTemplate'), ''),
    minimum_payment_amount = (p_payload->>'minimumPaymentAmount')::numeric,
    payment_frequency = p_payload->>'paymentFrequency',
    allow_pix_edit = (p_payload->>'allowPixEdit')::boolean,
    require_pix_change_approval = (p_payload->>'requirePixChangeApproval')::boolean,
    monthly_activation_enabled = (p_payload->>'monthlyActivationEnabled')::boolean,
    monthly_activation_amount = (p_payload->>'monthlyActivationAmount')::numeric,
    activation_grace_days = (p_payload->>'activationGraceDays')::integer,
    activation_basis = p_payload->>'activationBasis',
    updated_at = now()
  WHERE singleton;

  SELECT jsonb_build_object(
    'settings', to_jsonb(settings), 'plan', to_jsonb(plan),
    'levels', COALESCE((SELECT jsonb_agg(to_jsonb(levels) ORDER BY level_number) FROM public.commission_plan_levels levels WHERE commission_plan_id = plan.id), '[]'::jsonb)
  )
  INTO v_result
  FROM public.ambassador_program_settings settings
  JOIN public.commission_plans plan ON plan.id = settings.default_commission_plan_id
  WHERE settings.singleton;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_data, new_data, metadata)
  VALUES (p_actor_id, 'admin', 'ambassador_program_settings_updated', 'ambassador_program_settings', v_settings.id,
          v_old_data, v_result, jsonb_build_object('old_commission_plan_id', v_old_plan.id, 'new_commission_plan_id', v_new_plan_id, 'plan_version_created', TRUE));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_save_ambassador_program_settings(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_save_ambassador_program_settings(UUID, JSONB) TO service_role;

-- Candidatos automáticos criados pelo checkout sempre recebem o plano padrão vigente.
CREATE OR REPLACE FUNCTION public.fn_assign_current_default_plan_to_checkout_candidate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'pendente' AND NEW.notes = 'Cadastro automatico pela pagina de vendas; acesso ainda nao ativado.' THEN
    SELECT default_commission_plan_id INTO NEW.commission_plan_id
    FROM public.ambassador_program_settings WHERE singleton;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_current_default_plan_to_checkout_candidate
BEFORE INSERT ON public.ambassadors
FOR EACH ROW EXECUTE FUNCTION public.fn_assign_current_default_plan_to_checkout_candidate();

COMMIT;
