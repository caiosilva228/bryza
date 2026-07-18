BEGIN;

ALTER TABLE public.ambassador_program_settings
  ADD COLUMN first_purchase_bonus_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN first_purchase_minimum_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN first_purchase_bonus_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN first_purchase_bonus_enabled_at TIMESTAMPTZ;

ALTER TABLE public.ambassador_program_settings
  ADD CONSTRAINT ambassador_program_settings_first_purchase_minimum_check
    CHECK (first_purchase_minimum_amount >= 0),
  ADD CONSTRAINT ambassador_program_settings_first_purchase_bonus_check
    CHECK (first_purchase_bonus_amount >= 0),
  ADD CONSTRAINT ambassador_program_settings_first_purchase_values_check
    CHECK (NOT first_purchase_bonus_enabled OR (first_purchase_minimum_amount > 0 AND first_purchase_bonus_amount > 0));

ALTER TABLE public.pedidos
  ADD COLUMN first_purchase_bonus_enabled_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN first_purchase_minimum_snapshot NUMERIC(12,2),
  ADD COLUMN first_purchase_bonus_amount_snapshot NUMERIC(12,2),
  ADD COLUMN first_purchase_bonus_effective_from_snapshot TIMESTAMPTZ;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_first_purchase_minimum_snapshot_check
    CHECK (first_purchase_minimum_snapshot IS NULL OR first_purchase_minimum_snapshot >= 0),
  ADD CONSTRAINT pedidos_first_purchase_bonus_amount_snapshot_check
    CHECK (first_purchase_bonus_amount_snapshot IS NULL OR first_purchase_bonus_amount_snapshot >= 0);

ALTER TABLE public.commissions
  ADD COLUMN commission_type TEXT NOT NULL DEFAULT 'network_percentage',
  ADD COLUMN fixed_bonus_amount_snapshot NUMERIC(12,2),
  ADD COLUMN qualification_minimum_snapshot NUMERIC(12,2);

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_commission_type_check
    CHECK (commission_type IN ('network_percentage', 'first_purchase_bonus')),
  ADD CONSTRAINT commissions_fixed_bonus_snapshot_check
    CHECK (fixed_bonus_amount_snapshot IS NULL OR fixed_bonus_amount_snapshot > 0),
  ADD CONSTRAINT commissions_qualification_minimum_snapshot_check
    CHECK (qualification_minimum_snapshot IS NULL OR qualification_minimum_snapshot >= 0),
  ADD CONSTRAINT commissions_type_snapshots_check CHECK (
    (commission_type = 'network_percentage' AND fixed_bonus_amount_snapshot IS NULL AND qualification_minimum_snapshot IS NULL)
    OR
    (commission_type = 'first_purchase_bonus' AND percentage_snapshot = 0 AND fixed_bonus_amount_snapshot > 0 AND qualification_minimum_snapshot > 0)
  );

ALTER TABLE public.commissions
  DROP CONSTRAINT IF EXISTS unique_commission_order_amb_level,
  DROP CONSTRAINT IF EXISTS uq_commission_order_amb_level;

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_order_amb_level_type_key
    UNIQUE (order_id, ambassador_id, commission_level, commission_type);

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
      FROM chain JOIN public.ambassadors parent ON parent.id = chain.parent_ambassador_id
      WHERE chain.level_number < 10 AND NOT parent.id = ANY(chain.path)
    )
    SELECT chain.id AS ambassador_id, chain.status, levels.level_number, levels.percentage
    FROM chain JOIN public.commission_plan_levels levels
      ON levels.commission_plan_id = v_order.commission_plan_id_snapshot
     AND levels.level_number = chain.level_number AND levels.enabled
    ORDER BY levels.level_number
  LOOP
    IF v_node.percentage > 0 AND v_node.status = 'ativo' THEN
      v_amount := round(v_order.commissionable_amount_snapshot * v_node.percentage / 100.0, 2);
      INSERT INTO public.commissions (
        ambassador_id, order_id, customer_id, commission_plan_id, commission_level,
        commissionable_amount, order_amount_snapshot, percentage_snapshot, commission_amount,
        commission_type, status, available_at, cancelled_at
      ) VALUES (
        v_node.ambassador_id, v_order.id, v_order.cliente_id, v_order.commission_plan_id_snapshot, v_node.level_number,
        v_order.commissionable_amount_snapshot, v_order.valor_total, v_node.percentage, v_amount,
        'network_percentage', v_status, CASE WHEN v_status = 'liberada' THEN now() END,
        CASE WHEN v_status = 'cancelada' THEN now() END
      ) ON CONFLICT (order_id, ambassador_id, commission_level, commission_type) DO NOTHING;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_count := v_count + v_rows;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('sucesso', TRUE, 'criadas', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_gerar_comissoes_multinivel(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_gerar_comissoes_multinivel(UUID) TO service_role;

CREATE TABLE public.first_purchase_referral_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  commission_id UUID NOT NULL REFERENCES public.commissions(id) ON DELETE RESTRICT,
  qualification_amount NUMERIC(12,2) NOT NULL CHECK (qualification_amount >= 0),
  qualification_minimum_snapshot NUMERIC(12,2) NOT NULL CHECK (qualification_minimum_snapshot > 0),
  bonus_amount_snapshot NUMERIC(12,2) NOT NULL CHECK (bonus_amount_snapshot > 0),
  settings_effective_from_snapshot TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT first_purchase_referral_bonuses_customer_key UNIQUE (customer_id),
  CONSTRAINT first_purchase_referral_bonuses_order_key UNIQUE (order_id),
  CONSTRAINT first_purchase_referral_bonuses_commission_key UNIQUE (commission_id)
);
CREATE INDEX first_purchase_referral_bonuses_ambassador_idx
  ON public.first_purchase_referral_bonuses(ambassador_id);

ALTER TABLE public.first_purchase_referral_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY first_purchase_referral_bonuses_deny_direct_access
  ON public.first_purchase_referral_bonuses AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);
REVOKE ALL ON public.first_purchase_referral_bonuses FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.first_purchase_referral_bonuses TO service_role;

CREATE OR REPLACE FUNCTION public.fn_snapshot_first_purchase_bonus_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings public.ambassador_program_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_settings
  FROM public.ambassador_program_settings
  WHERE singleton;

  NEW.first_purchase_bonus_enabled_snapshot := COALESCE(v_settings.first_purchase_bonus_enabled, FALSE)
    AND v_settings.program_status = 'ativo';
  NEW.first_purchase_minimum_snapshot := CASE WHEN NEW.first_purchase_bonus_enabled_snapshot THEN v_settings.first_purchase_minimum_amount END;
  NEW.first_purchase_bonus_amount_snapshot := CASE WHEN NEW.first_purchase_bonus_enabled_snapshot THEN v_settings.first_purchase_bonus_amount END;
  NEW.first_purchase_bonus_effective_from_snapshot := CASE WHEN NEW.first_purchase_bonus_enabled_snapshot THEN v_settings.first_purchase_bonus_enabled_at END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_first_purchase_bonus_on_order
BEFORE INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_snapshot_first_purchase_bonus_on_order();

CREATE OR REPLACE FUNCTION public.fn_generate_first_purchase_referral_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer public.clientes%ROWTYPE;
  v_new_ambassador public.ambassadors%ROWTYPE;
  v_commission_id UUID;
  v_qualification_amount NUMERIC(12,2);
BEGIN
  IF NEW.status_pedido NOT IN ('entregue', 'finalizado') OR NEW.payment_check_status <> 'confirmado' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.status_pedido IN ('entregue', 'finalizado')
     AND OLD.payment_check_status = 'confirmado' THEN
    RETURN NEW;
  END IF;
  IF NOT NEW.first_purchase_bonus_enabled_snapshot
     OR NEW.first_purchase_minimum_snapshot IS NULL
     OR NEW.first_purchase_bonus_amount_snapshot IS NULL
     OR NEW.first_purchase_bonus_effective_from_snapshot IS NULL
     OR NEW.cliente_id IS NULL
     OR NEW.ambassador_id IS NULL
     OR NEW.commission_plan_id_snapshot IS NULL THEN
    RETURN NEW;
  END IF;

  v_qualification_amount := COALESCE(NEW.valor_total, 0);
  IF v_qualification_amount < NEW.first_purchase_minimum_snapshot THEN RETURN NEW; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('first_purchase_bonus:' || NEW.cliente_id::text, 0));
  SELECT * INTO v_customer FROM public.clientes WHERE id = NEW.cliente_id FOR SHARE;
  IF v_customer.id IS NULL
     OR v_customer.own_ambassador_id IS NULL
     OR v_customer.data_cadastro < NEW.first_purchase_bonus_effective_from_snapshot THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_new_ambassador
  FROM public.ambassadors
  WHERE id = v_customer.own_ambassador_id
  FOR SHARE;
  IF v_new_ambassador.id IS NULL
     OR v_new_ambassador.parent_ambassador_id IS DISTINCT FROM NEW.ambassador_id
     OR NOT EXISTS (
       SELECT 1 FROM public.commissions c
       WHERE c.order_id = NEW.id
         AND c.ambassador_id = NEW.ambassador_id
         AND c.commission_level = 1
         AND c.commission_type = 'network_percentage'
     ) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.first_purchase_referral_bonuses WHERE customer_id = NEW.cliente_id) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pedidos previous_order
    WHERE previous_order.cliente_id = NEW.cliente_id
      AND previous_order.id <> NEW.id
      AND previous_order.created_at < NEW.created_at
      AND previous_order.status_pedido IN ('entregue', 'finalizado')
      AND previous_order.payment_check_status = 'confirmado'
      AND previous_order.first_purchase_bonus_enabled_snapshot
      AND previous_order.valor_total >= previous_order.first_purchase_minimum_snapshot
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.commissions (
    ambassador_id, order_id, customer_id, commission_plan_id, commission_level,
    commissionable_amount, order_amount_snapshot, percentage_snapshot, commission_amount,
    commission_type, fixed_bonus_amount_snapshot, qualification_minimum_snapshot,
    status, available_at
  ) VALUES (
    NEW.ambassador_id, NEW.id, NEW.cliente_id, NEW.commission_plan_id_snapshot, 1,
    COALESCE(NEW.commissionable_amount_snapshot, v_qualification_amount), v_qualification_amount, 0,
    NEW.first_purchase_bonus_amount_snapshot, 'first_purchase_bonus',
    NEW.first_purchase_bonus_amount_snapshot, NEW.first_purchase_minimum_snapshot,
    'liberada', now()
  )
  ON CONFLICT (order_id, ambassador_id, commission_level, commission_type) DO NOTHING
  RETURNING id INTO v_commission_id;

  IF v_commission_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.first_purchase_referral_bonuses (
    customer_id, order_id, ambassador_id, commission_id, qualification_amount,
    qualification_minimum_snapshot, bonus_amount_snapshot, settings_effective_from_snapshot
  ) VALUES (
    NEW.cliente_id, NEW.id, NEW.ambassador_id, v_commission_id, v_qualification_amount,
    NEW.first_purchase_minimum_snapshot, NEW.first_purchase_bonus_amount_snapshot,
    NEW.first_purchase_bonus_effective_from_snapshot
  ) ON CONFLICT (customer_id) DO NOTHING;

  IF NOT FOUND THEN
    DELETE FROM public.commissions WHERE id = v_commission_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_generate_first_purchase_referral_bonus() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_first_purchase_referral_bonus() TO service_role;

CREATE TRIGGER trg_generate_first_purchase_referral_bonus
AFTER INSERT OR UPDATE OF status_pedido, payment_check_status ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_generate_first_purchase_referral_bonus();

-- O bônus usa a mesma carteira financeira, mas tem snapshots e cálculo próprios.
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
  IF v_order.id IS NULL OR v_order.ambassador_id IS NULL THEN
    RAISE EXCEPTION 'Comissão sem pedido ou indicação válida.';
  END IF;
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

  IF NEW.commission_type = 'first_purchase_bonus' THEN
    IF NEW.commission_level <> 1
       OR NEW.percentage_snapshot <> 0
       OR NEW.fixed_bonus_amount_snapshot IS NULL
       OR NEW.qualification_minimum_snapshot IS NULL
       OR NEW.order_amount_snapshot < NEW.qualification_minimum_snapshot
       OR NEW.commission_amount IS DISTINCT FROM NEW.fixed_bonus_amount_snapshot THEN
      RAISE EXCEPTION 'Cálculo ou elegibilidade do bônus da primeira compra inválido.';
    END IF;
  ELSE
    SELECT percentage INTO v_expected_pct
    FROM public.commission_plan_levels
    WHERE commission_plan_id = NEW.commission_plan_id
      AND level_number = NEW.commission_level AND enabled;
    IF v_expected_pct IS NULL THEN RAISE EXCEPTION 'Nível inexistente ou inativo no plano.'; END IF;
    IF NEW.percentage_snapshot IS DISTINCT FROM v_expected_pct
       OR NEW.commission_amount IS DISTINCT FROM round(NEW.commissionable_amount * v_expected_pct / 100.0, 2) THEN
      RAISE EXCEPTION 'Cálculo da comissão divergente do plano.';
    END IF;
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

CREATE OR REPLACE FUNCTION public.fn_amb_protect_commission_snapshots()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.ambassador_id IS DISTINCT FROM NEW.ambassador_id
     OR OLD.order_id IS DISTINCT FROM NEW.order_id
     OR OLD.commission_plan_id IS DISTINCT FROM NEW.commission_plan_id
     OR OLD.commission_level IS DISTINCT FROM NEW.commission_level
     OR OLD.commissionable_amount IS DISTINCT FROM NEW.commissionable_amount
     OR OLD.order_amount_snapshot IS DISTINCT FROM NEW.order_amount_snapshot
     OR OLD.percentage_snapshot IS DISTINCT FROM NEW.percentage_snapshot
     OR OLD.commission_amount IS DISTINCT FROM NEW.commission_amount
     OR OLD.commission_type IS DISTINCT FROM NEW.commission_type
     OR OLD.fixed_bonus_amount_snapshot IS DISTINCT FROM NEW.fixed_bonus_amount_snapshot
     OR OLD.qualification_minimum_snapshot IS DISTINCT FROM NEW.qualification_minimum_snapshot THEN
    RAISE EXCEPTION 'Dados financeiros e snapshots de comissão já gerados são imutáveis.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trg_commissions_financial_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.commissionable_amount IS DISTINCT FROM OLD.commissionable_amount
     OR NEW.order_amount_snapshot IS DISTINCT FROM OLD.order_amount_snapshot
     OR NEW.percentage_snapshot IS DISTINCT FROM OLD.percentage_snapshot
     OR NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
     OR NEW.ambassador_id IS DISTINCT FROM OLD.ambassador_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.commission_level IS DISTINCT FROM OLD.commission_level
     OR NEW.commission_type IS DISTINCT FROM OLD.commission_type
     OR NEW.fixed_bonus_amount_snapshot IS DISTINCT FROM OLD.fixed_bonus_amount_snapshot
     OR NEW.qualification_minimum_snapshot IS DISTINCT FROM OLD.qualification_minimum_snapshot THEN
    IF current_setting('bryza.allow_commission_financial_update', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Alteração direta nos dados financeiros da comissão é proibida. Utilize RPC administrativa auditada.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trg_pedidos_snapshots_imutaveis()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF (OLD.ambassador_id IS NOT NULL AND NEW.ambassador_id IS DISTINCT FROM OLD.ambassador_id)
     OR (OLD.referral_code_snapshot IS NOT NULL AND NEW.referral_code_snapshot IS DISTINCT FROM OLD.referral_code_snapshot)
     OR (OLD.commission_plan_id_snapshot IS NOT NULL AND NEW.commission_plan_id_snapshot IS DISTINCT FROM OLD.commission_plan_id_snapshot)
     OR (OLD.commission_percentage_snapshot IS NOT NULL AND NEW.commission_percentage_snapshot IS DISTINCT FROM OLD.commission_percentage_snapshot)
     OR (OLD.commissionable_amount_snapshot IS NOT NULL AND NEW.commissionable_amount_snapshot IS DISTINCT FROM OLD.commissionable_amount_snapshot)
     OR (OLD.commission_amount_snapshot IS NOT NULL AND NEW.commission_amount_snapshot IS DISTINCT FROM OLD.commission_amount_snapshot)
     OR NEW.first_purchase_bonus_enabled_snapshot IS DISTINCT FROM OLD.first_purchase_bonus_enabled_snapshot
     OR NEW.first_purchase_minimum_snapshot IS DISTINCT FROM OLD.first_purchase_minimum_snapshot
     OR NEW.first_purchase_bonus_amount_snapshot IS DISTINCT FROM OLD.first_purchase_bonus_amount_snapshot
     OR NEW.first_purchase_bonus_effective_from_snapshot IS DISTINCT FROM OLD.first_purchase_bonus_effective_from_snapshot THEN
    IF current_setting('bryza.allow_order_snapshot_update', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Alteração de snapshots do pedido é proibida após o congelamento inicial.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_first_purchase_referral_bonus_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'O registro do bônus da primeira compra é imutável.';
END;
$$;
CREATE TRIGGER trg_first_purchase_referral_bonus_immutable
BEFORE UPDATE OR DELETE ON public.first_purchase_referral_bonuses
FOR EACH ROW EXECUTE FUNCTION public.fn_first_purchase_referral_bonus_immutable();

-- Mantém a atualização do bônus na mesma transação da configuração geral.
ALTER FUNCTION public.fn_admin_save_ambassador_program_settings(UUID, JSONB)
  RENAME TO fn_admin_save_ambassador_program_settings_core;
REVOKE ALL ON FUNCTION public.fn_admin_save_ambassador_program_settings_core(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_save_ambassador_program_settings_core(UUID, JSONB) TO service_role;

CREATE FUNCTION public.fn_admin_save_ambassador_program_settings(p_actor_id UUID, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_old JSONB;
  v_enabled BOOLEAN;
  v_minimum NUMERIC(12,2);
  v_bonus NUMERIC(12,2);
BEGIN
  IF jsonb_typeof(p_payload->'firstPurchaseBonusEnabled') <> 'boolean' THEN
    RAISE EXCEPTION 'Configuração do bônus da primeira compra inválida.';
  END IF;
  v_enabled := (p_payload->>'firstPurchaseBonusEnabled')::boolean;
  v_minimum := (p_payload->>'firstPurchaseMinimumAmount')::numeric;
  v_bonus := (p_payload->>'firstPurchaseBonusAmount')::numeric;
  IF v_minimum NOT BETWEEN 0 AND 1000000 OR v_bonus NOT BETWEEN 0 AND 1000000
     OR (v_enabled AND (v_minimum <= 0 OR v_bonus <= 0)) THEN
    RAISE EXCEPTION 'Valores do bônus da primeira compra inválidos.';
  END IF;

  SELECT to_jsonb(s) INTO v_old FROM public.ambassador_program_settings s WHERE singleton;
  v_result := public.fn_admin_save_ambassador_program_settings_core(p_actor_id, p_payload);
  UPDATE public.ambassador_program_settings SET
    first_purchase_bonus_enabled = v_enabled,
    first_purchase_minimum_amount = v_minimum,
    first_purchase_bonus_amount = v_bonus,
    first_purchase_bonus_enabled_at = CASE
      WHEN v_enabled AND NOT COALESCE(first_purchase_bonus_enabled, FALSE) THEN now()
      WHEN v_enabled THEN COALESCE(first_purchase_bonus_enabled_at, now())
      ELSE NULL
    END,
    updated_at = now()
  WHERE singleton;

  INSERT INTO public.audit_logs(actor_id, actor_role, action, entity_type, entity_id, old_data, new_data)
  SELECT p_actor_id, 'admin', 'first_purchase_bonus_settings_updated',
         'ambassador_program_settings', s.id, v_old, to_jsonb(s)
  FROM public.ambassador_program_settings s WHERE singleton;

  SELECT jsonb_build_object(
    'settings', to_jsonb(s), 'plan', to_jsonb(p),
    'levels', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.level_number)
      FROM public.commission_plan_levels l WHERE l.commission_plan_id = p.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.ambassador_program_settings s
  JOIN public.commission_plans p ON p.id = s.default_commission_plan_id
  WHERE s.singleton;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_admin_save_ambassador_program_settings(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_save_ambassador_program_settings(UUID, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_admin_listar_comissoes_liberadas()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_minimum NUMERIC(12,2); v_groups JSONB; v_available NUMERIC(12,2);
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role()::TEXT <> 'admin' THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT minimum_payment_amount INTO v_minimum FROM public.ambassador_program_settings WHERE singleton = TRUE;
  SELECT COALESCE(sum(commission_amount),0) INTO v_available FROM public.commissions WHERE status = 'liberada';
  SELECT COALESCE(jsonb_agg(group_data ORDER BY (group_data->>'ambassador_name')), '[]'::jsonb) INTO v_groups
  FROM (
    SELECT jsonb_build_object(
      'ambassador_id', a.id,
      'ambassador_name', a.full_name,
      'referral_code', a.referral_code,
      'pix_key_type', a.pix_key_type,
      'pix_masked', CASE
        WHEN a.pix_key IS NULL THEN NULL
        WHEN length(a.pix_key) <= 6 THEN '******'
        ELSE left(a.pix_key, 3) || repeat('*', greatest(length(a.pix_key)-6, 4)) || right(a.pix_key, 3)
      END,
      'total', sum(c.commission_amount),
      'count', count(*),
      'eligible_minimum', sum(c.commission_amount) >= COALESCE(v_minimum,0),
      'commissions', jsonb_agg(jsonb_build_object(
        'id', c.id, 'order_id', c.order_id, 'level', c.commission_level,
        'type', c.commission_type, 'amount', c.commission_amount, 'created_at', c.created_at
      ) ORDER BY c.created_at)
    ) AS group_data
    FROM public.commissions c
    JOIN public.ambassadors a ON a.id = c.ambassador_id
    WHERE c.status = 'liberada'
    GROUP BY a.id, a.full_name, a.referral_code, a.pix_key_type, a.pix_key
  ) grouped;
  RETURN jsonb_build_object(
    'summary', jsonb_build_object('available', v_available, 'minimum_payment_amount', COALESCE(v_minimum,0)),
    'groups', v_groups
  );
END;
$$;
REVOKE ALL ON FUNCTION public.fn_admin_listar_comissoes_liberadas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_listar_comissoes_liberadas() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_get_embaixador_comissoes(
  p_limit INT DEFAULT 10,
  p_offset INT DEFAULT 0,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amb_id UUID;
  v_total INT := 0;
  v_items JSONB := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501'; END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN RAISE EXCEPTION 'p_limit deve estar entre 1 e 50' USING ERRCODE = '22023'; END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN RAISE EXCEPTION 'p_offset deve ser maior ou igual a 0' USING ERRCODE = '22023'; END IF;

  SELECT a.id INTO v_amb_id
  FROM public.ambassadors a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.user_id = auth.uid() AND p.role = 'embaixador' AND p.ativo = TRUE
    AND p.must_change_password = FALSE AND a.status = 'ativo';
  IF v_amb_id IS NULL THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501'; END IF;

  SELECT COUNT(*) INTO v_total FROM public.commissions c
  WHERE c.ambassador_id = v_amb_id AND (p_status IS NULL OR p_status = '' OR c.status = p_status);

  SELECT jsonb_agg(jsonb_build_object(
    'id', sub.id, 'created_at', sub.created_at, 'order_code', sub.codigo_pedido,
    'order_amount', sub.valor_total, 'commission_percentage', sub.percentage_snapshot,
    'commission_amount', sub.commission_amount, 'commission_type', sub.commission_type,
    'status', sub.status
  )) INTO v_items
  FROM (
    SELECT c.id, c.created_at, ped.numero_pedido AS codigo_pedido, ped.valor_total,
           c.percentage_snapshot, c.commission_amount, c.commission_type, c.status
    FROM public.commissions c
    JOIN public.pedidos ped ON ped.id = c.order_id
    WHERE c.ambassador_id = v_amb_id AND (p_status IS NULL OR p_status = '' OR c.status = p_status)
    ORDER BY c.created_at DESC, c.id DESC LIMIT p_limit OFFSET p_offset
  ) sub;
  RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb), 'total', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_get_embaixador_comissoes(INT, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_comissoes(INT, INT, TEXT) TO authenticated, service_role;

COMMIT;
