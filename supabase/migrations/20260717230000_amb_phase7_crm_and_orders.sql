-- Migration: 20260717230000_amb_phase7_crm_and_orders.sql
-- Description: Integração CRM, Atribuição do Cliente, Snapshots de Pedidos e Comissões Idempotentes (Prompt 07)

BEGIN;

-- 1. Saneamento Prévio de Nulos em commission_level
UPDATE public.commissions
SET commission_level = 1
WHERE commission_level IS NULL;

-- 2. Validação de Duplicidades Históricas Antes da Constraint UNIQUE
DO $$
DECLARE
  v_duplicados INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_duplicados
  FROM (
    SELECT order_id, ambassador_id, COALESCE(commission_level, 1)
    FROM public.commissions
    GROUP BY order_id, ambassador_id, COALESCE(commission_level, 1)
    HAVING COUNT(*) > 1
  ) d;

  IF v_duplicados > 0 THEN
    RAISE EXCEPTION 'Migration interrompida: Existem % registros duplicados de comissão no histórico. Execute o script de saneamento auditado antes de aplicar a constraint UNIQUE.', v_duplicados;
  END IF;
END $$;

-- 3. Aplicação de DEFAULT 1, NOT NULL e Constraint UNIQUE Composta
ALTER TABLE public.commissions 
  ALTER COLUMN commission_level SET DEFAULT 1,
  ALTER COLUMN commission_level SET NOT NULL;

ALTER TABLE public.commissions 
  DROP CONSTRAINT IF EXISTS unique_commission_order_amb_level;

ALTER TABLE public.commissions 
  ADD CONSTRAINT unique_commission_order_amb_level 
  UNIQUE (order_id, ambassador_id, commission_level);

-- 4. Trigger de Imutabilidade dos Snapshots no Pedido (Defense in Depth)
CREATE OR REPLACE FUNCTION public.fn_trg_pedidos_snapshots_imutaveis()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.ambassador_id IS NOT NULL AND NEW.ambassador_id IS DISTINCT FROM OLD.ambassador_id) OR
       (OLD.referral_code_snapshot IS NOT NULL AND NEW.referral_code_snapshot IS DISTINCT FROM OLD.referral_code_snapshot) OR
       (OLD.commission_plan_id_snapshot IS NOT NULL AND NEW.commission_plan_id_snapshot IS DISTINCT FROM OLD.commission_plan_id_snapshot) OR
       (OLD.commission_percentage_snapshot IS NOT NULL AND NEW.commission_percentage_snapshot IS DISTINCT FROM OLD.commission_percentage_snapshot) OR
       (OLD.commissionable_amount_snapshot IS NOT NULL AND NEW.commissionable_amount_snapshot IS DISTINCT FROM OLD.commissionable_amount_snapshot) OR
       (OLD.commission_amount_snapshot IS NOT NULL AND NEW.commission_amount_snapshot IS DISTINCT FROM OLD.commission_amount_snapshot) THEN

      IF current_setting('bryza.allow_order_snapshot_update', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Alteração de snapshots do pedido é proibida após o congelamento inicial.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_snapshots_imutaveis ON public.pedidos;
CREATE TRIGGER trg_pedidos_snapshots_imutaveis
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_pedidos_snapshots_imutaveis();

-- 5. Trigger de Imutabilidade Financeira em Commissions (Defense in Depth)
CREATE OR REPLACE FUNCTION public.fn_trg_commissions_financial_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.commissionable_amount IS DISTINCT FROM OLD.commissionable_amount OR
        NEW.order_amount_snapshot IS DISTINCT FROM OLD.order_amount_snapshot OR
        NEW.percentage_snapshot IS DISTINCT FROM OLD.percentage_snapshot OR
        NEW.commission_amount IS DISTINCT FROM OLD.commission_amount OR
        NEW.ambassador_id IS DISTINCT FROM OLD.ambassador_id OR
        NEW.order_id IS DISTINCT FROM OLD.order_id OR
        NEW.commission_level IS DISTINCT FROM OLD.commission_level) THEN

      IF current_setting('bryza.allow_commission_financial_update', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Alteração direta nos dados financeiros da comissão é proibida. Utilize RPC administrativa auditada.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commissions_financial_immutable ON public.commissions;
CREATE TRIGGER trg_commissions_financial_immutable
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_commissions_financial_immutable();

-- 6. RPC Administrativa de Reatribuição do Cliente com SELECT FOR UPDATE
CREATE OR REPLACE FUNCTION public.fn_admin_reatribuir_cliente(
  p_cliente_id UUID,
  p_novo_ambassador_id UUID,
  p_motivo TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente RECORD;
  v_novo_amb RECORD;
  v_actor_id UUID;
  v_actor_role TEXT;
BEGIN
  v_actor_id := auth.uid();
  v_actor_role := public.get_user_role();

  IF v_actor_id IS NULL OR v_actor_role != 'admin' THEN
    RAISE EXCEPTION 'Acesso negado: Requer privilégios de administrador.';
  END IF;

  IF p_motivo IS NULL OR char_length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo obrigatório (mínimo 5 caracteres).';
  END IF;

  SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id FOR UPDATE;
  IF v_cliente.id IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;

  SELECT * INTO v_novo_amb FROM public.ambassadors WHERE id = p_novo_ambassador_id AND status = 'ativo';
  IF v_novo_amb.id IS NULL THEN
    RAISE EXCEPTION 'Novo embaixador não encontrado ou inativo.';
  END IF;

  UPDATE public.clientes
  SET ambassador_id = v_novo_amb.id,
      referral_code = v_novo_amb.referral_code,
      referral_source = 'admin_manual',
      referral_attributed_at = now(),
      referral_locked_at = now()
  WHERE id = p_cliente_id;

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, old_data, new_data, metadata
  ) VALUES (
    v_actor_id, v_actor_role, 'admin_reatribuir_cliente', 'clientes', p_cliente_id,
    jsonb_build_object('ambassador_id', v_cliente.ambassador_id, 'referral_code', v_cliente.referral_code),
    jsonb_build_object('ambassador_id', v_novo_amb.id, 'referral_code', v_novo_amb.referral_code),
    jsonb_build_object('motivo', p_motivo)
  );

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_reatribuir_cliente(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_reatribuir_cliente(UUID, UUID, TEXT) TO authenticated;

-- 7. RPC Restrita de Busca de Embaixadores Ativos (Exclusiva Admin)
CREATE OR REPLACE FUNCTION public.fn_search_active_ambassadors(p_query TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  display_name TEXT,
  username TEXT,
  referral_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role TEXT;
BEGIN
  v_actor_role := public.get_user_role();
  IF v_actor_role != 'admin' THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem pesquisar embaixadores.';
  END IF;

  RETURN QUERY
  SELECT a.id, a.full_name, a.display_name, a.username, a.referral_code
  FROM public.ambassadors a
  WHERE a.status = 'ativo'
    AND (
      a.full_name ILIKE '%' || p_query || '%' OR
      a.display_name ILIKE '%' || p_query || '%' OR
      a.referral_code ILIKE '%' || p_query || '%' OR
      a.username ILIKE '%' || p_query || '%'
    )
  ORDER BY a.full_name ASC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_search_active_ambassadors(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_search_active_ambassadors(TEXT) TO authenticated;

-- 8. RPC Transacional de Criação/Atualização do Cliente com Atribuição
CREATE OR REPLACE FUNCTION public.fn_criar_ou_atualizar_cliente_com_atribuicao(
  p_nome TEXT,
  p_telefone TEXT,
  p_endereco TEXT,
  p_bairro TEXT,
  p_cidade TEXT,
  p_estado TEXT DEFAULT 'SP',
  p_cep TEXT DEFAULT NULL,
  p_origem TEXT DEFAULT 'indicação',
  p_ambassador_id UUID DEFAULT NULL,
  p_referral_code TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'manual_code'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente RECORD;
  v_cliente_id UUID;
  v_final_ambassador_id UUID := NULL;
  v_final_referral_code TEXT := NULL;
  v_final_source TEXT := p_source;
  v_amb RECORD;
BEGIN
  SELECT * INTO v_cliente FROM public.clientes WHERE telefone = p_telefone FOR UPDATE;

  IF v_cliente.id IS NOT NULL THEN
    v_cliente_id := v_cliente.id;

    -- 1. Hierarquia: Se o cliente já possui atribuição bloqueada, preserva intacto
    IF v_cliente.referral_locked_at IS NOT NULL AND v_cliente.ambassador_id IS NOT NULL THEN
      UPDATE public.clientes
      SET nome = COALESCE(p_nome, nome),
          endereco = COALESCE(p_endereco, endereco),
          bairro = COALESCE(p_bairro, bairro),
          cidade = COALESCE(p_cidade, cidade),
          estado = COALESCE(p_estado, estado),
          cep = COALESCE(p_cep, cep)
      WHERE id = v_cliente_id;

      RETURN v_cliente_id;
    END IF;
  END IF;

  -- 2. Resolução da Hierarquia para Novo Cliente ou Cliente não bloqueado
  IF p_ambassador_id IS NOT NULL THEN
    SELECT * INTO v_amb FROM public.ambassadors WHERE id = p_ambassador_id AND status = 'ativo';
    IF v_amb.id IS NOT NULL THEN
      v_final_ambassador_id := v_amb.id;
      v_final_referral_code := v_amb.referral_code;
      v_final_source := COALESCE(p_source, 'admin_selection');
    END IF;
  ELSIF p_referral_code IS NOT NULL AND p_referral_code != '' THEN
    SELECT * INTO v_amb FROM public.ambassadors WHERE lower(referral_code) = lower(trim(p_referral_code)) AND status = 'ativo';
    IF v_amb.id IS NOT NULL THEN
      v_final_ambassador_id := v_amb.id;
      v_final_referral_code := v_amb.referral_code;
      v_final_source := COALESCE(p_source, 'manual_code');
    END IF;
  END IF;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (
      nome, telefone, endereco, bairro, cidade, estado, cep, origem,
      ambassador_id, referral_code, referral_source, referral_attributed_at, referral_locked_at
    ) VALUES (
      p_nome, p_telefone, p_endereco, p_bairro, p_cidade, p_estado, p_cep, COALESCE(p_origem, 'indicação'),
      v_final_ambassador_id, v_final_referral_code, v_final_source,
      CASE WHEN v_final_ambassador_id IS NOT NULL THEN now() ELSE NULL END,
      CASE WHEN v_final_ambassador_id IS NOT NULL THEN now() ELSE NULL END
    ) RETURNING id INTO v_cliente_id;
  ELSE
    UPDATE public.clientes
    SET nome = COALESCE(p_nome, nome),
        endereco = COALESCE(p_endereco, endereco),
        bairro = COALESCE(p_bairro, bairro),
        cidade = COALESCE(p_cidade, cidade),
        estado = COALESCE(p_estado, estado),
        cep = COALESCE(p_cep, cep),
        ambassador_id = COALESCE(v_final_ambassador_id, ambassador_id),
        referral_code = COALESCE(v_final_referral_code, referral_code),
        referral_source = COALESCE(v_final_source, referral_source),
        referral_attributed_at = CASE WHEN v_final_ambassador_id IS NOT NULL THEN now() ELSE referral_attributed_at END,
        referral_locked_at = CASE WHEN v_final_ambassador_id IS NOT NULL THEN now() ELSE referral_locked_at END
    WHERE id = v_cliente_id;
  END IF;

  RETURN v_cliente_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_criar_ou_atualizar_cliente_com_atribuicao FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_criar_ou_atualizar_cliente_com_atribuicao TO service_role, authenticated;

-- 9. RPC Transacional de Criação de Pedido com Cálculo Proporcional NUMERIC
CREATE OR REPLACE FUNCTION public.fn_criar_pedido_completo(
  p_cliente_data JSONB,
  p_itens_data JSONB,
  p_atribuicao JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ambassador_id UUID;
  v_referral_code TEXT;
  v_visit_id UUID;
  v_source public.attribution_source_type;
  v_cliente_id UUID;
  v_pedido_id UUID;
  v_numero_pedido TEXT;
  v_valor_total NUMERIC := 0.00;
  v_subtotal_elegivel NUMERIC := 0.00;
  v_subtotal_total_descontavel NUMERIC := 0.00;
  v_desconto_pedido NUMERIC := 0.00;
  v_proporcao_elegivel NUMERIC := 0.00;
  v_desconto_elegivel NUMERIC := 0.00;
  v_base_comissionavel NUMERIC := 0.00;
  v_comissao_valor NUMERIC := 0.00;
  v_plan_id UUID;
  v_plan_pct NUMERIC := 0.00;
  v_item JSONB;
  v_prod RECORD;
  v_cli_nome TEXT;
  v_cli_fone TEXT;
  v_cli_endereco TEXT;
  v_cli_bairro TEXT;
  v_cli_cidade TEXT;
  v_cli_estado TEXT;
  v_cli_cep TEXT;
  v_cli_complemento TEXT;
  v_amb RECORD;
  v_plan RECORD;
BEGIN
  v_cli_nome := p_cliente_data->>'nome';
  v_cli_fone := p_cliente_data->>'telefone';
  v_cli_endereco := p_cliente_data->>'endereco';
  v_cli_bairro := p_cliente_data->>'bairro';
  v_cli_cidade := p_cliente_data->>'cidade';
  v_cli_estado := COALESCE(p_cliente_data->>'estado', 'SP');
  v_cli_cep := p_cliente_data->>'cep';
  v_cli_complemento := p_cliente_data->>'complemento';

  IF v_cli_nome IS NULL OR v_cli_fone IS NULL THEN
    RAISE EXCEPTION 'Nome e telefone do cliente são obrigatórios.';
  END IF;

  v_referral_code := lower(trim(COALESCE(p_atribuicao->>'referral_code', '')));
  
  -- Resolver cliente via RPC de atribuição
  v_cliente_id := public.fn_criar_ou_atualizar_cliente_com_atribuicao(
    v_cli_nome, v_cli_fone, v_cli_endereco, v_cli_bairro, v_cli_cidade, v_cli_estado, v_cli_cep,
    COALESCE(p_cliente_data->>'origem', 'indicação'),
    NULL, v_referral_code, COALESCE(p_atribuicao->>'source', 'smart_link')
  );

  -- Obter embaixador congelado do cliente
  SELECT ambassador_id INTO v_ambassador_id FROM public.clientes WHERE id = v_cliente_id;

  IF v_ambassador_id IS NOT NULL THEN
    SELECT * INTO v_amb FROM public.ambassadors WHERE id = v_ambassador_id AND status = 'ativo';
    IF v_amb.id IS NOT NULL THEN
      v_referral_code := v_amb.referral_code;
      SELECT * INTO v_plan FROM public.commission_plans WHERE id = v_amb.commission_plan_id AND status = 'ativo';
      IF v_plan.id IS NOT NULL THEN
        v_plan_id := v_plan.id;
        v_plan_pct := COALESCE(v_plan.direct_percentage, 0.00);
      END IF;
    ELSE
      v_ambassador_id := NULL;
    END IF;
  END IF;

  IF p_atribuicao->>'visit_id' IS NOT NULL AND p_atribuicao->>'visit_id' != '' THEN
    v_visit_id := (p_atribuicao->>'visit_id')::UUID;
  END IF;

  IF p_atribuicao->>'source' IS NOT NULL AND p_atribuicao->>'source' != '' THEN
    v_source := (p_atribuicao->>'source')::public.attribution_source_type;
  ELSE
    v_source := 'smart_link'::public.attribution_source_type;
  END IF;

  -- Calcular subtotais elegíveis e total descontável com NUMERIC
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens_data) LOOP
    SELECT id, preco_venda, ativo INTO v_prod FROM public.produtos WHERE id = (v_item->>'produto_id')::UUID;
    IF v_prod.id IS NULL OR v_prod.ativo IS FALSE THEN
      RAISE EXCEPTION 'Produto indisponível ou inativo: %', v_item->>'produto_id';
    END IF;

    v_valor_total := v_valor_total + round((v_prod.preco_venda * (v_item->>'quantidade')::INTEGER), 2);
    v_subtotal_total_descontavel := v_subtotal_total_descontavel + round((v_prod.preco_venda * (v_item->>'quantidade')::INTEGER), 2);

    -- Brindes (preco_unitario = 0) possuem peso zero na base comissionável
    IF v_prod.preco_venda > 0 THEN
      v_subtotal_elegivel := v_subtotal_elegivel + round((v_prod.preco_venda * (v_item->>'quantidade')::INTEGER), 2);
    END IF;
  END LOOP;

  v_desconto_pedido := round(COALESCE((p_cliente_data->>'desconto_aplicado')::NUMERIC, 0.00), 2);

  IF v_subtotal_total_descontavel > 0 THEN
    v_proporcao_elegivel := v_subtotal_elegivel / v_subtotal_total_descontavel;
    v_desconto_elegivel := round(v_desconto_pedido * v_proporcao_elegivel, 2);
  ELSE
    v_desconto_elegivel := 0.00;
  END IF;

  v_base_comissionavel := greatest(0.00, v_subtotal_elegivel - v_desconto_elegivel);

  IF v_ambassador_id IS NOT NULL AND v_plan_pct > 0 THEN
    v_comissao_valor := round(v_base_comissionavel * (v_plan_pct / 100.00), 2);
  ELSE
    v_comissao_valor := 0.00;
  END IF;

  v_numero_pedido := 'PED-' || floor(extract(epoch from now()))::text || '-' || floor(random() * 8999 + 1000)::text;

  INSERT INTO public.pedidos (
    numero_pedido, cliente_id, nome_cliente, telefone_cliente, endereco_entrega,
    bairro, cidade, estado, cep, complemento, valor_total, forma_pagamento, status_pedido,
    ambassador_id, referral_visit_id, referral_code_snapshot, attributed_at, attribution_source,
    commission_plan_id_snapshot, commission_percentage_snapshot,
    commissionable_amount_snapshot, commission_amount_snapshot, payment_check_status
  ) VALUES (
    v_numero_pedido, v_cliente_id, v_cli_nome, v_cli_fone, v_cli_endereco,
    v_cli_bairro, v_cli_cidade, v_cli_estado, v_cli_cep, v_cli_complemento, v_valor_total,
    COALESCE(p_cliente_data->>'forma_pagamento', 'dinheiro'), 'aguardando_preparacao',
    v_ambassador_id, v_visit_id, v_referral_code, CASE WHEN v_ambassador_id IS NOT NULL THEN now() ELSE NULL END, v_source,
    v_plan_id, v_plan_pct, v_base_comissionavel, v_comissao_valor, 'pendente'
  ) RETURNING id INTO v_pedido_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens_data) LOOP
    SELECT id, preco_venda INTO v_prod FROM public.produtos WHERE id = (v_item->>'produto_id')::UUID;
    INSERT INTO public.pedido_itens (
      pedido_id, produto_id, quantidade, preco_unitario, subtotal
    ) VALUES (
      v_pedido_id, v_prod.id, (v_item->>'quantidade')::INTEGER, v_prod.preco_venda,
      round((v_prod.preco_venda * (v_item->>'quantidade')::INTEGER), 2)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'sucesso', true,
    'pedido_id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'valor_total', v_valor_total,
    'base_comissionavel', v_base_comissionavel,
    'comissao_estimada', v_comissao_valor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_criar_pedido_completo(JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_criar_pedido_completo(JSONB, JSONB, JSONB) TO service_role;

-- 10. RPC de Processamento de Comissão Idempotente com Erro Estruturado sem Rollback
CREATE OR REPLACE FUNCTION public.fn_processar_comissao_pedido_pago(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pedido RECORD;
  v_comm RECORD;
  v_comm_id UUID;
  v_actor_id UUID;
  v_actor_role TEXT;
BEGIN
  v_actor_id := auth.uid();
  v_actor_role := public.get_user_role();

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF v_pedido.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'pedido_nao_encontrado');
  END IF;

  -- 1. Exigir Confirmação Financeira Real de Pagamento
  IF v_pedido.payment_check_status IS DISTINCT FROM 'pago' AND v_pedido.status_pedido IS DISTINCT FROM 'pago' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'pagamento_nao_confirmado');
  END IF;

  IF v_pedido.ambassador_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'pedido_sem_embaixador');
  END IF;

  -- 2. Checar se comissão já existe para (order_id, ambassador_id, commission_level = 1)
  SELECT * INTO v_comm 
  FROM public.commissions 
  WHERE order_id = p_pedido_id AND ambassador_id = v_pedido.ambassador_id AND commission_level = 1;

  IF v_comm.id IS NOT NULL THEN
    -- Validação de Idempotência Não-Silenciosa
    IF v_comm.commissionable_amount = v_pedido.commissionable_amount_snapshot AND
       v_comm.percentage_snapshot = v_pedido.commission_percentage_snapshot AND
       v_comm.commission_amount = v_pedido.commission_amount_snapshot THEN
      RETURN jsonb_build_object('sucesso', true, 'idempotente', true, 'commission_id', v_comm.id);
    ELSE
      -- Persistir auditoria sem abortar a transação (Erro Estruturado)
      INSERT INTO public.audit_logs (
        actor_id, actor_role, action, entity_type, entity_id, old_data, new_data, metadata
      ) VALUES (
        v_actor_id, v_actor_role, 'commission_idempotency_mismatch_alert', 'commissions', v_comm.id,
        jsonb_build_object('commissionable_amount', v_comm.commissionable_amount, 'commission_amount', v_comm.commission_amount),
        jsonb_build_object('commissionable_amount', v_pedido.commissionable_amount_snapshot, 'commission_amount', v_pedido.commission_amount_snapshot),
        jsonb_build_object('order_id', p_pedido_id, 'motivo', 'Divergência de valores em reprocessamento de comissão')
      );

      RETURN jsonb_build_object(
        'sucesso', false,
        'erro', 'divergencia_idempotencia',
        'mensagem', 'Divergência detectada entre comissão gravada e snapshots do pedido. Auditoria registrada.'
      );
    END IF;
  END IF;

  -- 3. Inserir Comissão Nível 1 com DEFAULT 1
  INSERT INTO public.commissions (
    ambassador_id, order_id, customer_id, commission_plan_id,
    commission_level, commissionable_amount, order_amount_snapshot,
    percentage_snapshot, commission_amount, status
  ) VALUES (
    v_pedido.ambassador_id, p_pedido_id, v_pedido.cliente_id, v_pedido.commission_plan_id_snapshot,
    1, v_pedido.commissionable_amount_snapshot, v_pedido.valor_total,
    v_pedido.commission_percentage_snapshot, v_pedido.commission_amount_snapshot, 'pendente'
  ) RETURNING id INTO v_comm_id;

  RETURN jsonb_build_object('sucesso', true, 'commission_id', v_comm_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_processar_comissao_pedido_pago(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_processar_comissao_pedido_pago(UUID) TO service_role, authenticated;

COMMIT;
