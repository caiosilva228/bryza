-- Test Suite: scratch/test_crm_order_integration_suite.sql
-- Validação integral de Atribuição CRM, Idempotência de Comissões, Snapshots e Alocação Proporcional de Desconto (Prompt 07)

BEGIN;

DO $$
DECLARE
  v_amb_id UUID;
  v_amb_code TEXT;
  v_cust_id UUID;
  v_pedido_id UUID;
  v_prod_pago_id UUID;
  v_prod_gratis_id UUID;
  v_res JSONB;
  v_comm_res JSONB;
  v_audit_cnt INTEGER;
BEGIN
  RAISE NOTICE '=== TEST 1: Buscar / Criar Embaixador Ativo para Testes ===';
  SELECT id, referral_code INTO v_amb_id, v_amb_code FROM public.ambassadors WHERE status = 'ativo' LIMIT 1;
  IF v_amb_id IS NULL THEN
    INSERT INTO public.ambassadors (full_name, display_name, status, phone, email, cpf)
    VALUES ('Embaixador CRM Teste', 'Embaixador CRM', 'ativo', '11977777777', 'amb_crm@bryza.com', '98765432100')
    RETURNING id, referral_code INTO v_amb_id, v_amb_code;
  END IF;

  RAISE NOTICE '=== TEST 2: Criar Cliente com Atribuição via RPC Transacional ===';
  v_cust_id := public.fn_criar_ou_atualizar_cliente_com_atribuicao(
    'Cliente Teste CRM 07',
    '11966666666',
    'Rua CRM, 500',
    'Bairro Teste',
    'São Paulo',
    'SP',
    '01000-000',
    'indicação',
    v_amb_id,
    v_amb_code,
    'manual_code'
  );

  IF v_cust_id IS NULL THEN
    RAISE EXCEPTION 'TEST FAILED: Cliente não foi criado via RPC.';
  END IF;

  -- Confirmar que referral_locked_at foi preenchido
  IF (SELECT referral_locked_at FROM public.clientes WHERE id = v_cust_id) IS NULL THEN
    RAISE EXCEPTION 'TEST FAILED: referral_locked_at não foi preenchido na atribuição do cliente.';
  END IF;

  RAISE NOTICE '=== TEST 3: Tentar Sobrescrever Atribuição Bloqueada (Regra do Cliente Atribuído) ===';
  PERFORM public.fn_criar_ou_atualizar_cliente_com_atribuicao(
    'Cliente Teste CRM 07',
    '11966666666',
    'Rua CRM, 500',
    'Bairro Teste',
    'São Paulo',
    'SP',
    '01000-000',
    'indicação',
    NULL,
    'bryza99999',
    'smart_link'
  );

  -- Confirmar que o ambassador_id permanece o original
  IF (SELECT ambassador_id FROM public.clientes WHERE id = v_cust_id) != v_amb_id THEN
    RAISE EXCEPTION 'TEST FAILED: Atribuição bloqueada do cliente foi indevidamente sobrescrita!';
  END IF;

  RAISE NOTICE '=== TEST 4: Produtos para Teste de Base Comissionável (Pago + Brinde R$ 0) ===';
  SELECT id INTO v_prod_pago_id FROM public.produtos WHERE preco_venda > 0 AND ativo = true LIMIT 1;
  IF v_prod_pago_id IS NULL THEN
    INSERT INTO public.produtos (nome_produto, categoria, unidade, custo_unitario, preco_venda, estoque_atual, estoque_minimo, ativo)
    VALUES ('Produto Pago Teste', 'Teste', 'UN', 10, 100, 100, 5, true)
    RETURNING id INTO v_prod_pago_id;
  END IF;

  SELECT id INTO v_prod_gratis_id FROM public.produtos WHERE preco_venda = 0 AND ativo = true LIMIT 1;
  IF v_prod_gratis_id IS NULL THEN
    INSERT INTO public.produtos (nome_produto, categoria, unidade, custo_unitario, preco_venda, estoque_atual, estoque_minimo, ativo)
    VALUES ('Brinde Grátis Teste', 'Brinde', 'UN', 0, 0, 100, 5, true)
    RETURNING id INTO v_prod_gratis_id;
  END IF;

  RAISE NOTICE '=== TEST 5: Criar Pedido Completo com Desconto Proporcional e Brinde ===';
  v_res := public.fn_criar_pedido_completo(
    jsonb_build_object(
      'nome', 'Cliente Teste CRM 07',
      'telefone', '11966666666',
      'endereco', 'Rua CRM, 500',
      'bairro', 'Bairro Teste',
      'cidade', 'São Paulo',
      'estado', 'SP',
      'desconto_aplicado', 10.00
    ),
    jsonb_build_array(
      jsonb_build_object('produto_id', v_prod_pago_id, 'quantidade', 1),
      jsonb_build_object('produto_id', v_prod_gratis_id, 'quantidade', 1)
    ),
    jsonb_build_object(
      'referral_code', v_amb_code,
      'source', 'smart_link'
    )
  );

  v_pedido_id := (v_res->>'pedido_id')::UUID;
  IF v_pedido_id IS NULL THEN
    RAISE EXCEPTION 'TEST FAILED: Pedido não foi criado.';
  END IF;

  RAISE NOTICE '=== TEST 6: Idempotência de Comissão sem Confirmação Financeira (Deve Rejeitar) ===';
  v_comm_res := public.fn_processar_comissao_pedido_pago(v_pedido_id);
  IF (v_comm_res->>'sucesso')::BOOLEAN IS TRUE THEN
    RAISE EXCEPTION 'TEST FAILED: Comissão foi gerada para pedido pendente de pagamento!';
  END IF;

  RAISE NOTICE '=== TEST 7: Confirmar Pagamento do Pedido e Processar Comissão ===';
  UPDATE public.pedidos SET payment_check_status = 'pago', status_pedido = 'pago' WHERE id = v_pedido_id;

  v_comm_res := public.fn_processar_comissao_pedido_pago(v_pedido_id);
  IF (v_comm_res->>'sucesso')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST FAILED: Erro ao processar comissão para pedido pago: %', v_comm_res;
  END IF;

  RAISE NOTICE '=== TEST 8: Teste de Reprocessamento Idempotente (Mesmos Valores = Sucesso) ===';
  v_comm_res := public.fn_processar_comissao_pedido_pago(v_pedido_id);
  IF (v_comm_res->>'sucesso')::BOOLEAN IS NOT TRUE OR (v_comm_res->>'idempotente')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST FAILED: Reprocessamento com valores idênticos deveria ser reconhecido como idempotente!';
  END IF;

  RAISE NOTICE '=== TEST 9: Teste de Reprocessamento com Divergência (Alerta Auditado sem Rollback) ===';
  -- Alterar temporariamente os snapshots do pedido para forçar divergência
  PERFORM set_config('bryza.allow_order_snapshot_update', 'true', true);
  UPDATE public.pedidos SET commissionable_amount_snapshot = 999.99 WHERE id = v_pedido_id;

  v_comm_res := public.fn_processar_comissao_pedido_pago(v_pedido_id);
  IF (v_comm_res->>'sucesso')::BOOLEAN IS TRUE OR (v_comm_res->>'erro') != 'divergencia_idempotencia' THEN
    RAISE EXCEPTION 'TEST FAILED: Divergência de idempotência deveria ter retornado erro estruturado!';
  END IF;

  SELECT COUNT(*) INTO v_audit_cnt FROM public.audit_logs WHERE action = 'commission_idempotency_mismatch_alert';
  IF v_audit_cnt = 0 THEN
    RAISE EXCEPTION 'TEST FAILED: Auditoria de divergência não foi gravada em audit_logs!';
  END IF;

  RAISE NOTICE '=== TODOS OS TESTES DE INTEGRAÇÃO DO PROMPT 07 PASSARAM COM SUCESSO ===';
END $$;

ROLLBACK;
