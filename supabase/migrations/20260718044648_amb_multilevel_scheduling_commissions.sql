-- BRYZA - PV publica, CRM, agendamento e comissoes multinivel 4% / 2% / 1%.
-- Migration exclusivamente aditiva: nenhum registro de negocio e removido.

BEGIN;

-- Um plano novo preserva o plano legado de 7% para qualquer snapshot historico.
INSERT INTO public.commission_plans (
  id, name, direct_percentage, level_2_percentage, level_3_percentage,
  multilevel_enabled, commission_base, status, valid_from
) VALUES (
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Embaixador Multinivel 4-2-1', 4.00, 2.00, 1.00,
  TRUE, 'valor_final', 'ativo', NOW()
) ON CONFLICT (id) DO NOTHING;

UPDATE public.ambassador_program_settings
SET default_commission_plan_id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
WHERE singleton = TRUE
  AND default_commission_plan_id IS DISTINCT FROM 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- Em instalacoes sem qualquer uso historico, evita que o plano legado apareca como opcao nova.
UPDATE public.commission_plans
SET status = 'inativo', valid_to = COALESCE(valid_to, now())
WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND NOT EXISTS (SELECT 1 FROM public.ambassadors WHERE commission_plan_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
  AND NOT EXISTS (SELECT 1 FROM public.commissions WHERE commission_plan_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

-- O cliente mantem separadamente quem o indicou e seu proprio cadastro de embaixador.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS own_ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_cpf_normalizado
  ON public.clientes (cpf) WHERE cpf IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_own_ambassador
  ON public.clientes (own_ambassador_id) WHERE own_ambassador_id IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.clientes ADD CONSTRAINT chk_clientes_cpf_normalizado
    CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Snapshots no agendamento permitem conversao posterior sem recalcular plano ou atribuicao.
CREATE SEQUENCE IF NOT EXISTS public.agendamento_numero_seq START 1;
ALTER TABLE public.agendamentos
  ALTER COLUMN vendedor_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS numero_agendamento TEXT,
  ADD COLUMN IF NOT EXISTS submission_id UUID,
  ADD COLUMN IF NOT EXISTS own_ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_visit_id UUID REFERENCES public.referral_visits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_code_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS attributed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attribution_source public.attribution_source_type,
  ADD COLUMN IF NOT EXISTS commission_plan_id_snapshot UUID REFERENCES public.commission_plans(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS commission_percentage_snapshot NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS commissionable_amount_snapshot NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS commission_amount_snapshot NUMERIC(12,2);

ALTER TABLE public.agendamentos
  ALTER COLUMN numero_agendamento SET DEFAULT ('AG' || LPAD(nextval('public.agendamento_numero_seq')::TEXT, 6, '0'));

UPDATE public.agendamentos
SET numero_agendamento = 'LEG-' || LEFT(id::TEXT, 8)
WHERE numero_agendamento IS NULL;

ALTER TABLE public.agendamentos ALTER COLUMN numero_agendamento SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_agendamentos_numero ON public.agendamentos(numero_agendamento);
CREATE UNIQUE INDEX IF NOT EXISTS uq_agendamentos_submission ON public.agendamentos(submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agendamentos_ambassador ON public.agendamentos(ambassador_id, created_at DESC);

-- Impede auto-patrocinio e ciclos, inclusive ao editar uma arvore futura.
CREATE OR REPLACE FUNCTION public.fn_validate_ambassador_parent_tree()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE v_cycle BOOLEAN;
BEGIN
  IF NEW.parent_ambassador_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.parent_ambassador_id = NEW.id THEN
    RAISE EXCEPTION 'Um embaixador nao pode patrocinar a si proprio.';
  END IF;

  WITH RECURSIVE ancestors AS (
    SELECT a.id, a.parent_ambassador_id, ARRAY[a.id] AS path
    FROM public.ambassadors a WHERE a.id = NEW.parent_ambassador_id
    UNION ALL
    SELECT a.id, a.parent_ambassador_id, an.path || a.id
    FROM public.ambassadors a
    JOIN ancestors an ON a.id = an.parent_ambassador_id
    WHERE NOT a.id = ANY(an.path)
  )
  SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = NEW.id) INTO v_cycle;
  IF v_cycle THEN RAISE EXCEPTION 'A arvore de embaixadores nao pode conter ciclos.'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ambassador_parent_tree ON public.ambassadors;
CREATE TRIGGER trg_validate_ambassador_parent_tree
  BEFORE INSERT OR UPDATE OF parent_ambassador_id ON public.ambassadors
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_ambassador_parent_tree();

-- Mantem a protecao contra snapshots forjados por vendedores, liberando apenas a RPC atomica.
CREATE OR REPLACE FUNCTION public.fn_amb_protect_seller_overrides()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE v_role public.app_role;
BEGIN
  v_role := public.get_user_role();
  IF v_role = 'vendedor'::public.app_role THEN
    IF TG_TABLE_NAME = 'clientes' THEN
      IF TG_OP = 'INSERT' AND
         (NEW.ambassador_id IS NOT NULL OR NEW.referral_code IS NOT NULL OR NEW.referral_source IS NOT NULL OR NEW.referral_attributed_at IS NOT NULL OR NEW.referral_locked_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Vendedores nao podem inserir atribuicao de embaixador diretamente.';
      ELSIF TG_OP = 'UPDATE' AND
         (OLD.ambassador_id IS DISTINCT FROM NEW.ambassador_id OR OLD.referral_code IS DISTINCT FROM NEW.referral_code OR
          OLD.referral_source IS DISTINCT FROM NEW.referral_source OR OLD.referral_attributed_at IS DISTINCT FROM NEW.referral_attributed_at OR
          OLD.referral_locked_at IS DISTINCT FROM NEW.referral_locked_at) THEN
        RAISE EXCEPTION 'Vendedores nao podem alterar atribuicao de embaixador diretamente.';
      END IF;
    ELSIF TG_TABLE_NAME = 'pedidos' AND current_setting('bryza.allow_seller_referral_snapshots', TRUE) IS DISTINCT FROM 'true' THEN
      IF TG_OP = 'INSERT' AND
         (NEW.ambassador_id IS NOT NULL OR NEW.referral_code_snapshot IS NOT NULL OR NEW.commission_plan_id_snapshot IS NOT NULL OR
          NEW.commission_percentage_snapshot IS NOT NULL OR NEW.commissionable_amount_snapshot IS NOT NULL OR NEW.commission_amount_snapshot IS NOT NULL) THEN
        RAISE EXCEPTION 'Vendedores nao podem criar snapshots de comissao diretamente.';
      ELSIF TG_OP = 'UPDATE' AND
         (OLD.ambassador_id IS DISTINCT FROM NEW.ambassador_id OR OLD.referral_code_snapshot IS DISTINCT FROM NEW.referral_code_snapshot OR
          OLD.commission_plan_id_snapshot IS DISTINCT FROM NEW.commission_plan_id_snapshot OR
          OLD.commission_percentage_snapshot IS DISTINCT FROM NEW.commission_percentage_snapshot OR
          OLD.commissionable_amount_snapshot IS DISTINCT FROM NEW.commissionable_amount_snapshot OR
          OLD.commission_amount_snapshot IS DISTINCT FROM NEW.commission_amount_snapshot) THEN
        RAISE EXCEPTION 'Vendedores nao podem alterar snapshots de comissao diretamente.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Substitui a validacao legada, que aceitava apenas nivel 1 e somente pedidos ja entregues.
CREATE OR REPLACE FUNCTION public.fn_trg_valida_comissao_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.pedidos%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_direct public.ambassadors%ROWTYPE;
  v_expected UUID;
  v_expected_pct NUMERIC(5,2);
BEGIN
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  SELECT * INTO v_order FROM public.pedidos WHERE id = NEW.order_id;
  IF v_order.id IS NULL OR v_order.ambassador_id IS NULL THEN RAISE EXCEPTION 'Comissao sem pedido ou indicacao valida.'; END IF;
  IF NEW.commission_level NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Nivel de comissao invalido.'; END IF;
  SELECT * INTO v_direct FROM public.ambassadors WHERE id = v_order.ambassador_id;
  v_expected := v_direct.id;
  IF NEW.commission_level >= 2 THEN
    SELECT parent_ambassador_id INTO v_expected FROM public.ambassadors WHERE id = v_expected;
  END IF;
  IF NEW.commission_level >= 3 THEN
    SELECT parent_ambassador_id INTO v_expected FROM public.ambassadors WHERE id = v_expected;
  END IF;
  IF v_expected IS NULL OR NEW.ambassador_id IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'Beneficiario nao corresponde ao nivel congelado da rede.';
  END IF;
  IF NEW.commission_plan_id IS DISTINCT FROM v_order.commission_plan_id_snapshot OR
     NEW.commissionable_amount IS DISTINCT FROM v_order.commissionable_amount_snapshot THEN
    RAISE EXCEPTION 'Snapshots da comissao divergem do pedido.';
  END IF;
  SELECT CASE NEW.commission_level
    WHEN 1 THEN direct_percentage WHEN 2 THEN level_2_percentage ELSE level_3_percentage END
  INTO v_expected_pct FROM public.commission_plans WHERE id = NEW.commission_plan_id;
  IF NEW.percentage_snapshot IS DISTINCT FROM v_expected_pct OR
     NEW.commission_amount IS DISTINCT FROM round(NEW.commissionable_amount * v_expected_pct / 100.0, 2) THEN
    RAISE EXCEPTION 'Calculo da comissao divergente do plano.';
  END IF;
  SELECT * INTO v_customer FROM public.clientes WHERE id = v_order.cliente_id;
  IF v_customer.own_ambassador_id = NEW.ambassador_id OR
     (v_customer.cpf IS NOT NULL AND v_customer.cpf = (SELECT cpf FROM public.ambassadors WHERE id = NEW.ambassador_id)) OR
     (regexp_replace(COALESCE(v_customer.telefone,''), '[^0-9]', '', 'g') <> '' AND
      regexp_replace(COALESCE(v_customer.telefone,''), '[^0-9]', '', 'g') =
      regexp_replace(COALESCE((SELECT phone FROM public.ambassadors WHERE id = NEW.ambassador_id),''), '[^0-9]', '', 'g')) THEN
    RAISE EXCEPTION 'Autoindicacao detectada.';
  END IF;
  RETURN NEW;
END;
$$;

-- Checkout publico atomico: CRM + atribuicao + candidato a embaixador + agendamento + itens.
CREATE OR REPLACE FUNCTION public.fn_criar_agendamento_publico(
  p_cliente_data JSONB,
  p_itens_data JSONB,
  p_atribuicao JSONB,
  p_idempotency_key UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.agendamentos%ROWTYPE;
  v_referrer public.ambassadors%ROWTYPE;
  v_visit public.referral_visits%ROWTYPE;
  v_plan public.commission_plans%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_candidate public.ambassadors%ROWTYPE;
  v_item JSONB;
  v_product RECORD;
  v_customer_id UUID;
  v_schedule_id UUID;
  v_phone TEXT := regexp_replace(COALESCE(p_cliente_data->>'telefone', ''), '[^0-9]', '', 'g');
  v_cpf TEXT := regexp_replace(COALESCE(p_cliente_data->>'cpf', ''), '[^0-9]', '', 'g');
  v_cep TEXT := regexp_replace(COALESCE(p_cliente_data->>'cep', ''), '[^0-9]', '', 'g');
  v_code TEXT := lower(trim(COALESCE(p_atribuicao->>'referral_code', '')));
  v_source public.attribution_source_type := 'smart_link';
  v_date TIMESTAMPTZ;
  v_total NUMERIC(12,2) := 0;
  v_base NUMERIC(12,2) := 0;
  v_direct_amount NUMERIC(12,2) := 0;
  v_qty INTEGER;
  v_payment TEXT := lower(COALESCE(p_cliente_data->>'forma_pagamento', 'pix'));
  v_attribution_days INTEGER := 30;
  v_clicked_referrer_id UUID;
BEGIN
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Identificador da solicitacao obrigatorio.'; END IF;
  SELECT * INTO v_existing FROM public.agendamentos WHERE submission_id = p_idempotency_key;
  IF v_existing.id IS NOT NULL THEN
    SELECT * INTO v_candidate FROM public.ambassadors WHERE id = v_existing.own_ambassador_id;
    RETURN jsonb_build_object(
      'sucesso', TRUE, 'idempotente', TRUE,
      'agendamento_id', v_existing.id,
      'numero_agendamento', v_existing.numero_agendamento,
      'data_agendamento', v_existing.data_agendamento,
      'novo_referral_code', v_candidate.referral_code,
      'valor_total', v_existing.valor_total
    );
  END IF;

  IF length(trim(COALESCE(p_cliente_data->>'nome', ''))) < 3 THEN RAISE EXCEPTION 'Nome invalido.'; END IF;
  IF v_phone !~ '^[0-9]{10,11}$' THEN RAISE EXCEPTION 'Telefone invalido.'; END IF;
  IF v_cpf !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'CPF invalido.'; END IF;
  IF v_cep <> '' AND v_cep !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'CEP invalido.'; END IF;
  IF upper(COALESCE(p_cliente_data->>'estado', '')) !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'UF invalida.'; END IF;
  IF v_payment NOT IN ('dinheiro', 'pix', 'cartao') THEN RAISE EXCEPTION 'Forma de pagamento invalida.'; END IF;
  IF jsonb_typeof(p_itens_data) <> 'array' OR jsonb_array_length(p_itens_data) = 0 OR jsonb_array_length(p_itens_data) > 20 THEN
    RAISE EXCEPTION 'A lista de itens e invalida.';
  END IF;

  BEGIN v_date := (p_cliente_data->>'data_agendamento')::TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Data de agendamento invalida.'; END;
  IF v_date < now() + interval '30 minutes' OR v_date > now() + interval '180 days' THEN
    RAISE EXCEPTION 'Data de agendamento fora do periodo permitido.';
  END IF;

  SELECT referral_attribution_days INTO v_attribution_days
  FROM public.ambassador_program_settings WHERE singleton = TRUE;

  SELECT * INTO v_referrer FROM public.ambassadors
  WHERE referral_code = v_code AND status = 'ativo';
  IF v_referrer.id IS NULL THEN RAISE EXCEPTION 'Indicacao invalida ou indisponivel.'; END IF;
  v_clicked_referrer_id := v_referrer.id;

  IF NULLIF(p_atribuicao->>'visit_id', '') IS NULL THEN RAISE EXCEPTION 'Visita de indicacao ausente.'; END IF;
  SELECT * INTO v_visit FROM public.referral_visits
  WHERE id = (p_atribuicao->>'visit_id')::UUID
    AND ambassador_id = v_referrer.id
    AND referral_code = v_referrer.referral_code
    AND visited_at >= now() - make_interval(days => COALESCE(v_attribution_days, 30));
  IF v_visit.id IS NULL THEN RAISE EXCEPTION 'Visita de indicacao invalida ou expirada.'; END IF;

  SELECT * INTO v_plan FROM public.commission_plans
  WHERE id = v_referrer.commission_plan_id AND status = 'ativo'
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_to IS NULL OR valid_to > now());
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Plano de comissao indisponivel.'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens_data) LOOP
    BEGIN v_qty := (v_item->>'quantidade')::INTEGER;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Quantidade invalida.'; END;
    IF v_qty < 1 OR v_qty > 100 THEN RAISE EXCEPTION 'Quantidade fora do limite.'; END IF;
    SELECT id, preco_venda, ativo INTO v_product
    FROM public.produtos WHERE id = (v_item->>'produto_id')::UUID FOR SHARE;
    IF v_product.id IS NULL OR v_product.ativo IS NOT TRUE THEN RAISE EXCEPTION 'Produto indisponivel.'; END IF;
    v_total := v_total + round(v_product.preco_venda * v_qty, 2);
    IF v_product.preco_venda > 0 THEN v_base := v_base + round(v_product.preco_venda * v_qty, 2); END IF;
  END LOOP;
  v_direct_amount := round(v_base * v_plan.direct_percentage / 100.0, 2);

  -- Serializa cadastros do mesmo telefone/CPF e evita duplicidade concorrente.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_phone || ':' || v_cpf, 0));
  SELECT * INTO v_customer FROM public.clientes
  WHERE regexp_replace(telefone, '[^0-9]', '', 'g') = v_phone OR cpf = v_cpf
  ORDER BY (cpf = v_cpf) DESC NULLS LAST LIMIT 1 FOR UPDATE;

  IF v_customer.id IS NOT NULL AND v_customer.cpf IS NOT NULL AND v_customer.cpf <> v_cpf THEN
    RAISE EXCEPTION 'Os dados informados nao correspondem ao cadastro existente.';
  END IF;

  IF v_customer.id IS NULL THEN
    INSERT INTO public.clientes (
      nome, cpf, telefone, endereco, bairro, cidade, estado, cep, origem,
      ambassador_id, referral_code, referral_source, referral_attributed_at, referral_locked_at
    ) VALUES (
      trim(p_cliente_data->>'nome'), v_cpf, v_phone,
      trim(p_cliente_data->>'endereco') || CASE WHEN NULLIF(trim(p_cliente_data->>'numero'), '') IS NULL THEN '' ELSE ', ' || trim(p_cliente_data->>'numero') END,
      trim(p_cliente_data->>'bairro'), trim(p_cliente_data->>'cidade'), upper(p_cliente_data->>'estado'), NULLIF(v_cep, ''), 'pagina_vendas',
      v_referrer.id, v_referrer.referral_code, 'smart_link', now(), now()
    ) RETURNING * INTO v_customer;
  ELSE
    UPDATE public.clientes SET
      cpf = COALESCE(cpf, v_cpf),
      ambassador_id = CASE WHEN referral_locked_at IS NULL OR ambassador_id IS NULL THEN v_referrer.id ELSE ambassador_id END,
      referral_code = CASE WHEN referral_locked_at IS NULL OR ambassador_id IS NULL THEN v_referrer.referral_code ELSE referral_code END,
      referral_source = CASE WHEN referral_locked_at IS NULL OR ambassador_id IS NULL THEN 'smart_link' ELSE referral_source END,
      referral_attributed_at = CASE WHEN referral_locked_at IS NULL OR ambassador_id IS NULL THEN now() ELSE referral_attributed_at END,
      referral_locked_at = COALESCE(referral_locked_at, now())
    WHERE id = v_customer.id RETURNING * INTO v_customer;
  END IF;
  v_customer_id := v_customer.id;

  -- A primeira atribuicao confirmada prevalece.
  SELECT * INTO v_referrer FROM public.ambassadors WHERE id = v_customer.ambassador_id;
  IF v_referrer.id IS NULL THEN RAISE EXCEPTION 'Atribuicao do cliente indisponivel.'; END IF;
  IF v_referrer.id IS DISTINCT FROM v_clicked_referrer_id THEN
    -- O primeiro indicador bloqueado continua prevalecendo; a visita atual apenas autorizou o checkout.
    v_visit.id := NULL;
    v_visit.visited_at := NULL;
    SELECT * INTO v_plan FROM public.commission_plans
    WHERE id = v_referrer.commission_plan_id AND status = 'ativo'
      AND (valid_from IS NULL OR valid_from <= now())
      AND (valid_to IS NULL OR valid_to > now());
    IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Plano da atribuicao original indisponivel.'; END IF;
    v_direct_amount := round(v_base * v_plan.direct_percentage / 100.0, 2);
  END IF;

  IF v_customer.own_ambassador_id IS NOT NULL THEN
    SELECT * INTO v_candidate FROM public.ambassadors WHERE id = v_customer.own_ambassador_id;
  ELSE
    SELECT * INTO v_candidate FROM public.ambassadors WHERE cpf = v_cpf FOR UPDATE;
    IF v_candidate.id IS NULL THEN
      INSERT INTO public.ambassadors (
        full_name, display_name, cpf, phone, email, city, state,
        parent_ambassador_id, commission_plan_id, status, notes
      ) VALUES (
        trim(p_cliente_data->>'nome'), trim(p_cliente_data->>'nome'), v_cpf, v_phone,
        NULLIF(lower(trim(COALESCE(p_cliente_data->>'email', ''))), ''),
        trim(p_cliente_data->>'cidade'), upper(p_cliente_data->>'estado'),
        v_referrer.id, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pendente',
        'Cadastro automatico pela pagina de vendas; acesso ainda nao ativado.'
      ) RETURNING * INTO v_candidate;
    END IF;
    UPDATE public.clientes SET own_ambassador_id = v_candidate.id WHERE id = v_customer_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.referral_attributions
    WHERE customer_id = v_customer_id AND status IN ('atribuido', 'convertido')
  ) THEN
    INSERT INTO public.referral_attributions (
      ambassador_id, customer_id, referral_code, source, status,
      first_visit_at, attributed_at, locked_at, metadata
    ) VALUES (
      v_referrer.id, v_customer_id, v_referrer.referral_code, 'smart_link', 'atribuido',
      v_visit.visited_at, now(), now(), jsonb_build_object('visit_id', v_visit.id, 'checkout_visit_id', p_atribuicao->>'visit_id')
    );
  END IF;

  INSERT INTO public.agendamentos (
    submission_id, data_agendamento, status, cliente_id, vendedor_id,
    valor_total, forma_pagamento, observacoes,
    nome_cliente, telefone_cliente, endereco_entrega, bairro, cidade, estado, cep,
    own_ambassador_id, ambassador_id, referral_visit_id, referral_code_snapshot,
    attributed_at, attribution_source, commission_plan_id_snapshot,
    commission_percentage_snapshot, commissionable_amount_snapshot, commission_amount_snapshot
  ) VALUES (
    p_idempotency_key, v_date, 'agendado', v_customer_id, v_referrer.user_id,
    v_total, v_payment, 'Agendamento criado pela pagina de vendas.',
    trim(p_cliente_data->>'nome'), v_phone,
    trim(p_cliente_data->>'endereco') || CASE WHEN NULLIF(trim(p_cliente_data->>'numero'), '') IS NULL THEN '' ELSE ', ' || trim(p_cliente_data->>'numero') END || CASE WHEN NULLIF(trim(COALESCE(p_cliente_data->>'complemento','')), '') IS NULL THEN '' ELSE ' - ' || trim(p_cliente_data->>'complemento') END,
    trim(p_cliente_data->>'bairro'), trim(p_cliente_data->>'cidade'), upper(p_cliente_data->>'estado'), NULLIF(v_cep, ''),
    v_candidate.id, v_referrer.id, v_visit.id, v_referrer.referral_code,
    now(), v_source, v_plan.id, v_plan.direct_percentage, v_base, v_direct_amount
  ) RETURNING id INTO v_schedule_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens_data) LOOP
    v_qty := (v_item->>'quantidade')::INTEGER;
    SELECT id, preco_venda INTO v_product FROM public.produtos WHERE id = (v_item->>'produto_id')::UUID;
    INSERT INTO public.agendamento_itens (agendamento_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES (v_schedule_id, v_product.id, v_qty, v_product.preco_venda, round(v_product.preco_venda * v_qty, 2));
  END LOOP;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, new_data, metadata)
  VALUES ('public_sales_page_scheduled', 'agendamentos', v_schedule_id,
    jsonb_build_object('customer_id', v_customer_id, 'ambassador_id', v_referrer.id, 'own_ambassador_id', v_candidate.id),
    jsonb_build_object('submission_id', p_idempotency_key, 'referral_visit_id', v_visit.id));

  SELECT * INTO v_existing FROM public.agendamentos WHERE id = v_schedule_id;
  RETURN jsonb_build_object(
    'sucesso', TRUE, 'agendamento_id', v_schedule_id,
    'numero_agendamento', v_existing.numero_agendamento,
    'data_agendamento', v_existing.data_agendamento,
    'novo_referral_code', v_candidate.referral_code,
    'valor_total', v_total
  );
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_existing FROM public.agendamentos WHERE submission_id = p_idempotency_key;
  IF v_existing.id IS NOT NULL THEN
    SELECT * INTO v_candidate FROM public.ambassadors WHERE id = v_existing.own_ambassador_id;
    RETURN jsonb_build_object('sucesso', TRUE, 'idempotente', TRUE,
      'agendamento_id', v_existing.id, 'numero_agendamento', v_existing.numero_agendamento,
      'data_agendamento', v_existing.data_agendamento, 'novo_referral_code', v_candidate.referral_code,
      'valor_total', v_existing.valor_total);
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_criar_agendamento_publico(JSONB, JSONB, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_criar_agendamento_publico(JSONB, JSONB, JSONB, UUID) TO service_role;

-- Gera beneficiarios L1/L2/L3 usando o plano e a arvore congelados na criacao.
CREATE OR REPLACE FUNCTION public.fn_gerar_comissoes_multinivel(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.pedidos%ROWTYPE;
  v_plan public.commission_plans%ROWTYPE;
  v_current public.ambassadors%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_level INTEGER;
  v_pct NUMERIC(5,2);
  v_amount NUMERIC(12,2);
  v_status TEXT;
  v_count INTEGER := 0;
  v_rows INTEGER := 0;
BEGIN
  SELECT * INTO v_order FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF v_order.id IS NULL OR v_order.ambassador_id IS NULL OR v_order.commission_plan_id_snapshot IS NULL THEN
    RETURN jsonb_build_object('sucesso', TRUE, 'criadas', 0);
  END IF;
  SELECT * INTO v_plan FROM public.commission_plans WHERE id = v_order.commission_plan_id_snapshot;
  SELECT * INTO v_current FROM public.ambassadors WHERE id = v_order.ambassador_id;
  SELECT * INTO v_customer FROM public.clientes WHERE id = v_order.cliente_id;
  IF v_customer.own_ambassador_id = v_current.id OR
     (v_customer.cpf IS NOT NULL AND v_customer.cpf = v_current.cpf) OR
     (regexp_replace(COALESCE(v_customer.telefone,''), '[^0-9]', '', 'g') <> '' AND
      regexp_replace(COALESCE(v_customer.telefone,''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(v_current.phone,''), '[^0-9]', '', 'g')) THEN
    RETURN jsonb_build_object('sucesso', TRUE, 'criadas', 0, 'motivo', 'autoindicacao_bloqueada');
  END IF;
  v_status := CASE
    WHEN v_order.status_pedido = 'cancelado' THEN 'cancelada'
    WHEN v_order.status_pedido IN ('entregue','finalizado') AND v_order.payment_check_status = 'confirmado' THEN 'liberada'
    WHEN v_order.status_pedido IN ('entregue','finalizado') THEN 'aguardando_pagamento'
    ELSE 'aguardando_entrega' END;

  FOR v_level IN 1..3 LOOP
    EXIT WHEN v_current.id IS NULL;
    v_pct := CASE v_level WHEN 1 THEN v_plan.direct_percentage WHEN 2 THEN v_plan.level_2_percentage ELSE v_plan.level_3_percentage END;
    IF v_level = 1 OR v_plan.multilevel_enabled THEN
      IF v_pct > 0 AND v_current.status = 'ativo' THEN
        v_amount := round(v_order.commissionable_amount_snapshot * v_pct / 100.0, 2);
        INSERT INTO public.commissions (
          ambassador_id, order_id, customer_id, commission_plan_id, commission_level,
          commissionable_amount, order_amount_snapshot, percentage_snapshot, commission_amount,
          status, available_at, cancelled_at
        ) VALUES (
          v_current.id, v_order.id, v_order.cliente_id, v_plan.id, v_level,
          v_order.commissionable_amount_snapshot, v_order.valor_total, v_pct, v_amount,
          v_status, CASE WHEN v_status = 'liberada' THEN now() END,
          CASE WHEN v_status = 'cancelada' THEN now() END
        ) ON CONFLICT (order_id, ambassador_id, commission_level) DO NOTHING;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_count := v_count + v_rows;
      END IF;
    END IF;
    SELECT * INTO v_current FROM public.ambassadors WHERE id = v_current.parent_ambassador_id;
  END LOOP;
  RETURN jsonb_build_object('sucesso', TRUE, 'criadas', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_gerar_comissoes_multinivel(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_gerar_comissoes_multinivel(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_trg_generate_order_commissions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.fn_gerar_comissoes_multinivel(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_trg_generate_order_commissions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_generate_order_commissions ON public.pedidos;
CREATE TRIGGER trg_generate_order_commissions
  AFTER INSERT ON public.pedidos FOR EACH ROW
  WHEN (NEW.ambassador_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_trg_generate_order_commissions();

CREATE OR REPLACE FUNCTION public.fn_trg_sync_commission_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status_pedido = 'cancelado' THEN
    UPDATE public.commissions SET status = 'cancelada', cancelled_at = COALESCE(cancelled_at, now())
    WHERE order_id = NEW.id AND status IN ('aguardando_entrega','aguardando_pagamento','liberada');
  ELSIF NEW.status_pedido IN ('entregue','finalizado') AND NEW.payment_check_status = 'confirmado' THEN
    UPDATE public.commissions SET status = 'liberada', available_at = COALESCE(available_at, now())
    WHERE order_id = NEW.id AND status IN ('aguardando_entrega','aguardando_pagamento');
  ELSIF NEW.status_pedido IN ('entregue','finalizado') THEN
    UPDATE public.commissions SET status = 'aguardando_pagamento'
    WHERE order_id = NEW.id AND status = 'aguardando_entrega';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_trg_sync_commission_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_commission_status ON public.pedidos;
CREATE TRIGGER trg_sync_commission_status
  AFTER UPDATE OF status_pedido, payment_check_status ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_sync_commission_status();

-- Conversao atomica evita o rollback manual com DELETE usado pelo servico antigo.
CREATE OR REPLACE FUNCTION public.fn_converter_agendamento_em_pedido(p_agendamento_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := public.get_user_role()::TEXT;
  v_ag public.agendamentos%ROWTYPE;
  v_order_id UUID;
  v_order_number TEXT;
BEGIN
  IF auth.uid() IS NULL OR v_role NOT IN ('admin','vendedor') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO v_ag FROM public.agendamentos WHERE id = p_agendamento_id FOR UPDATE;
  IF v_ag.id IS NULL THEN RAISE EXCEPTION 'Agendamento nao encontrado.'; END IF;
  IF v_ag.status = 'convertido' AND v_ag.pedido_id IS NOT NULL THEN
    SELECT numero_pedido INTO v_order_number FROM public.pedidos WHERE id = v_ag.pedido_id;
    RETURN jsonb_build_object('sucesso', TRUE, 'idempotente', TRUE, 'pedido_id', v_ag.pedido_id, 'numero_pedido', v_order_number);
  END IF;
  IF v_ag.status <> 'agendado' THEN RAISE EXCEPTION 'Agendamento nao pode ser convertido neste estado.'; END IF;
  IF v_role = 'vendedor' AND v_ag.vendedor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  PERFORM set_config('bryza.allow_seller_referral_snapshots', 'true', TRUE);

  INSERT INTO public.pedidos (
    cliente_id, vendedor_id, valor_total, desconto_tipo, desconto_valor, desconto_aplicado,
    forma_pagamento, observacoes, nome_cliente, telefone_cliente, endereco_entrega,
    bairro, cidade, estado, cep, nome_vendedor, codigo_vendedor, status_pedido,
    ambassador_id, referral_visit_id, referral_code_snapshot, attributed_at, attribution_source,
    commission_plan_id_snapshot, commission_percentage_snapshot,
    commissionable_amount_snapshot, commission_amount_snapshot
  ) VALUES (
    v_ag.cliente_id, v_ag.vendedor_id, v_ag.valor_total, v_ag.desconto_tipo, v_ag.desconto_valor, v_ag.desconto_aplicado,
    v_ag.forma_pagamento, v_ag.observacoes, v_ag.nome_cliente, v_ag.telefone_cliente, v_ag.endereco_entrega,
    v_ag.bairro, v_ag.cidade, v_ag.estado, v_ag.cep, v_ag.nome_vendedor, v_ag.codigo_vendedor, 'aguardando_preparacao',
    v_ag.ambassador_id, v_ag.referral_visit_id, v_ag.referral_code_snapshot, v_ag.attributed_at, v_ag.attribution_source,
    v_ag.commission_plan_id_snapshot, v_ag.commission_percentage_snapshot,
    v_ag.commissionable_amount_snapshot, v_ag.commission_amount_snapshot
  ) RETURNING id, numero_pedido INTO v_order_id, v_order_number;

  INSERT INTO public.pedido_itens (
    pedido_id, produto_id, quantidade, preco_unitario, subtotal,
    desconto_tipo, desconto_valor, desconto_aplicado
  )
  SELECT v_order_id, produto_id, quantidade, preco_unitario, subtotal,
    desconto_tipo, desconto_valor, desconto_aplicado
  FROM public.agendamento_itens WHERE agendamento_id = v_ag.id;

  UPDATE public.agendamentos SET status = 'convertido', pedido_id = v_order_id, updated_at = now()
  WHERE id = v_ag.id;
  UPDATE public.referral_attributions SET status = 'convertido', converted_at = COALESCE(converted_at, now())
  WHERE customer_id = v_ag.cliente_id AND ambassador_id = v_ag.ambassador_id AND status = 'atribuido';

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), v_role, 'schedule_converted_to_order', 'pedidos', v_order_id,
    jsonb_build_object('agendamento_id', v_ag.id));
  RETURN jsonb_build_object('sucesso', TRUE, 'pedido_id', v_order_id, 'numero_pedido', v_order_number);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_converter_agendamento_em_pedido(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_converter_agendamento_em_pedido(UUID) TO authenticated, service_role;

-- Fecha RPCs antigas que permitiam alteracao de CRM/comissao por qualquer autenticado.
REVOKE EXECUTE ON FUNCTION public.fn_criar_ou_atualizar_cliente_com_atribuicao(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_processar_comissao_pedido_pago(UUID) FROM authenticated, anon, PUBLIC;

-- RLS de agendamento: embaixador nao pode ler PII do cliente; vendedor ve apenas os seus.
DROP POLICY IF EXISTS "Permitir leitura para todos os usuários autenticados" ON public.agendamentos;
DROP POLICY IF EXISTS "Permitir inserção para todos os usuários autenticados" ON public.agendamentos;
DROP POLICY IF EXISTS "Permitir atualização para todos os usuários autenticados" ON public.agendamentos;
DROP POLICY IF EXISTS "Permitir deleção para todos os usuários autenticados" ON public.agendamentos;
CREATE POLICY agendamentos_select_by_role ON public.agendamentos FOR SELECT TO authenticated
  USING (public.get_user_role()::TEXT IN ('admin','logistica') OR (public.get_user_role()::TEXT = 'vendedor' AND vendedor_id = auth.uid()));
CREATE POLICY agendamentos_insert_by_role ON public.agendamentos FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role()::TEXT = 'admin' OR (public.get_user_role()::TEXT = 'vendedor' AND vendedor_id = auth.uid()));
CREATE POLICY agendamentos_update_by_role ON public.agendamentos FOR UPDATE TO authenticated
  USING (public.get_user_role()::TEXT IN ('admin','logistica') OR (public.get_user_role()::TEXT = 'vendedor' AND vendedor_id = auth.uid()))
  WITH CHECK (public.get_user_role()::TEXT IN ('admin','logistica') OR (public.get_user_role()::TEXT = 'vendedor' AND vendedor_id = auth.uid()));
CREATE POLICY agendamentos_delete_admin_only ON public.agendamentos FOR DELETE TO authenticated
  USING (public.get_user_role()::TEXT = 'admin');

DROP POLICY IF EXISTS "Permitir leitura para itens de todos os usuários autenticados" ON public.agendamento_itens;
DROP POLICY IF EXISTS "Permitir inserção para itens de todos os usuários autenticados" ON public.agendamento_itens;
DROP POLICY IF EXISTS "Permitir atualização para itens de todos os usuários autenticados" ON public.agendamento_itens;
DROP POLICY IF EXISTS "Permitir deleção para itens de todos os usuários autenticados" ON public.agendamento_itens;
CREATE POLICY agendamento_itens_select_by_parent ON public.agendamento_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.id = agendamento_id));
CREATE POLICY agendamento_itens_insert_by_parent ON public.agendamento_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.id = agendamento_id));
CREATE POLICY agendamento_itens_update_by_parent ON public.agendamento_itens FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.id = agendamento_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.id = agendamento_id));
CREATE POLICY agendamento_itens_delete_admin_only ON public.agendamento_itens FOR DELETE TO authenticated
  USING (public.get_user_role()::TEXT = 'admin');

-- Pagamento manual, atomico e auditavel das comissoes ja liberadas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_payments_reference
  ON public.commission_payments(payment_reference) WHERE payment_reference IS NOT NULL;

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
        'amount', c.commission_amount, 'created_at', c.created_at
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

CREATE OR REPLACE FUNCTION public.fn_admin_criar_pagamento_comissoes(
  p_ambassador_id UUID,
  p_commission_ids UUID[],
  p_payment_reference TEXT,
  p_notes TEXT DEFAULT NULL,
  p_override_minimum BOOLEAN DEFAULT FALSE,
  p_override_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amb public.ambassadors%ROWTYPE;
  v_payment public.commission_payments%ROWTYPE;
  v_total NUMERIC(12,2);
  v_minimum NUMERIC(12,2);
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role()::TEXT <> 'admin' THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_ambassador_id IS NULL OR COALESCE(array_length(p_commission_ids,1),0) = 0 THEN RAISE EXCEPTION 'Selecao de comissoes obrigatoria.'; END IF;
  IF length(trim(COALESCE(p_payment_reference,''))) < 3 THEN RAISE EXCEPTION 'Referencia de pagamento obrigatoria.'; END IF;
  IF p_override_minimum AND length(trim(COALESCE(p_override_reason,''))) < 5 THEN RAISE EXCEPTION 'Motivo do override obrigatorio.'; END IF;

  SELECT * INTO v_payment FROM public.commission_payments WHERE payment_reference = trim(p_payment_reference);
  IF v_payment.id IS NOT NULL THEN
    IF v_payment.ambassador_id = p_ambassador_id THEN
      RETURN jsonb_build_object('sucesso', TRUE, 'idempotente', TRUE, 'payment_id', v_payment.id, 'amount', v_payment.amount);
    END IF;
    RAISE EXCEPTION 'Referencia de pagamento ja utilizada.';
  END IF;

  SELECT * INTO v_amb FROM public.ambassadors WHERE id = p_ambassador_id FOR UPDATE;
  IF v_amb.id IS NULL THEN RAISE EXCEPTION 'Embaixador nao encontrado.'; END IF;
  SELECT minimum_payment_amount INTO v_minimum FROM public.ambassador_program_settings WHERE singleton = TRUE;

  PERFORM 1 FROM public.commissions WHERE id = ANY(p_commission_ids) FOR UPDATE;
  SELECT count(*), COALESCE(sum(commission_amount),0) INTO v_count, v_total
  FROM public.commissions
  WHERE id = ANY(p_commission_ids) AND ambassador_id = p_ambassador_id AND status = 'liberada';
  IF v_count <> array_length(p_commission_ids,1) THEN RAISE EXCEPTION 'Uma ou mais comissoes nao estao liberadas ou pertencem a outro embaixador.'; END IF;
  IF v_total < COALESCE(v_minimum,0) AND NOT p_override_minimum THEN RAISE EXCEPTION 'Valor abaixo do minimo configurado.'; END IF;

  INSERT INTO public.commission_payments (
    ambassador_id, amount, payment_method, ambassador_name_snapshot,
    cpf_masked_snapshot, pix_key_type_snapshot, pix_key_snapshot,
    payment_reference, status, paid_at, notes, created_by
  ) VALUES (
    v_amb.id, v_total, 'pix', v_amb.full_name,
    left(v_amb.cpf,3) || '.***.***-' || right(v_amb.cpf,2),
    v_amb.pix_key_type,
    CASE WHEN v_amb.pix_key IS NULL THEN NULL WHEN length(v_amb.pix_key) <= 6 THEN '******'
      ELSE left(v_amb.pix_key,3) || repeat('*', greatest(length(v_amb.pix_key)-6,4)) || right(v_amb.pix_key,3) END,
    trim(p_payment_reference), 'processando', now(), p_notes, auth.uid()
  ) ON CONFLICT (payment_reference) WHERE payment_reference IS NOT NULL DO NOTHING
  RETURNING * INTO v_payment;

  IF v_payment.id IS NULL THEN
    SELECT * INTO v_payment FROM public.commission_payments WHERE payment_reference = trim(p_payment_reference);
    IF v_payment.id IS NOT NULL AND v_payment.ambassador_id = p_ambassador_id THEN
      RETURN jsonb_build_object('sucesso', TRUE, 'idempotente', TRUE, 'payment_id', v_payment.id, 'amount', v_payment.amount);
    END IF;
    RAISE EXCEPTION 'Referencia de pagamento ja utilizada.';
  END IF;

  INSERT INTO public.commission_payment_items(payment_id, commission_id, amount)
  SELECT v_payment.id, id, commission_amount FROM public.commissions WHERE id = ANY(p_commission_ids);
  UPDATE public.commissions SET status = 'paga', paid_at = now()
  WHERE id = ANY(p_commission_ids) AND status = 'liberada';
  UPDATE public.commission_payments SET status = 'paga' WHERE id = v_payment.id;

  INSERT INTO public.audit_logs(actor_id, actor_role, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'admin', 'commission_payment_completed', 'commission_payments', v_payment.id,
    jsonb_build_object('amount', v_total, 'commission_count', v_count,
      'override_minimum', p_override_minimum, 'override_reason', p_override_reason));
  RETURN jsonb_build_object('sucesso', TRUE, 'payment_id', v_payment.id, 'amount', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_admin_criar_pagamento_comissoes(UUID,UUID[],TEXT,TEXT,BOOLEAN,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_criar_pagamento_comissoes(UUID,UUID[],TEXT,TEXT,BOOLEAN,TEXT) TO authenticated;

COMMIT;
