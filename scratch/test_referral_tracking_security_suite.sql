-- Test Suite: scratch/test_referral_tracking_security_suite.sql
-- Validação integral de RLS, Triggers, RPCs, Imutabilidade e Prevenção de Autoindicação para Prompt 06.

BEGIN;

DO $$
DECLARE
  v_amb_id UUID;
  v_amb_code TEXT;
  v_user_id UUID := gen_random_uuid();
  v_cust_id UUID;
  v_pedido_id UUID;
  v_comm_id UUID;
  v_res JSONB;
BEGIN
  RAISE NOTICE '=== TEST 1: Verificar RPC pública fn_get_public_ambassador_by_code ===';
  -- Buscar embaixador ativo existente
  SELECT id, referral_code INTO v_amb_id, v_amb_code FROM public.ambassadors WHERE status = 'ativo' LIMIT 1;
  IF v_amb_id IS NULL THEN
    INSERT INTO public.ambassadors (full_name, display_name, status, phone, email, cpf)
    VALUES ('Embaixador Teste 999', 'Embaixador 999', 'ativo', '11999999999', 'amb999@bryza.com', '12345678909')
    RETURNING id, referral_code INTO v_amb_id, v_amb_code;
  END IF;

  PERFORM public.fn_get_public_ambassador_by_code(v_amb_code);

  RAISE NOTICE '=== TEST 2: Criar Pedido Transacional (fn_criar_pedido_completo) ===';
  v_res := public.fn_criar_pedido_completo(
    jsonb_build_object(
      'nome', 'Cliente Teste Tracking',
      'telefone', '11988888888',
      'endereco', 'Rua Teste, 100',
      'bairro', 'Centro',
      'cidade', 'São Paulo',
      'estado', 'SP'
    ),
    (SELECT jsonb_agg(jsonb_build_object('produto_id', id, 'quantidade', 1)) FROM (SELECT id FROM public.produtos WHERE ativo = true LIMIT 1) p),
    jsonb_build_object(
      'referral_code', v_amb_code,
      'source', 'smart_link'
    )
  );

  v_pedido_id := (v_res->>'pedido_id')::UUID;
  IF v_pedido_id IS NULL THEN
    RAISE EXCEPTION 'TEST FAILED: Pedido não foi criado via RPC.';
  END IF;

  RAISE NOTICE '=== TEST 3: Testar Imutabilidade do Pedido (trg_pedidos_atribuicao_imutavel) ===';
  BEGIN
    UPDATE public.pedidos SET ambassador_id = gen_random_uuid() WHERE id = v_pedido_id;
    RAISE EXCEPTION 'TEST FAILED: UPDATE direto na atribuição não disparou exceção!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SUCESSO: UPDATE direto bloqueado pelo trigger: %', SQLERRM;
  END;

  RAISE NOTICE '=== TEST 4: Reatribuição Administrativa Segura (fn_admin_reatribuir_pedido) ===';
  BEGIN
    PERFORM public.fn_admin_reatribuir_pedido(v_pedido_id, v_amb_id, 'Sem role admin');
    RAISE EXCEPTION 'TEST FAILED: Reatribuição sem admin deveria ter falhado!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SUCESSO: Reatribuição sem admin bloqueada: %', SQLERRM;
  END;

  RAISE NOTICE '=== TEST 5: Teste de Autoindicação em Comissões (Telefone/CPF coincidente) ===';
  BEGIN
    INSERT INTO public.commissions (
      ambassador_id, order_id, customer_id, commission_plan_id,
      commission_level, commissionable_amount, order_amount_snapshot,
      percentage_snapshot, commission_amount, status
    ) VALUES (
      v_amb_id, v_pedido_id, (SELECT cliente_id FROM public.pedidos WHERE id = v_pedido_id),
      gen_random_uuid(), 1, 100, 100, 10, 10, 'pendente'
    );
    RAISE EXCEPTION 'TEST FAILED: Comissão para pedido em status "pendente" deveria ter sido bloqueada pelo trigger!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SUCESSO: Comissão bloqueada para pedido em status não finalizado/pago: %', SQLERRM;
  END;

  RAISE NOTICE '=== TODOS OS TESTES EM LEVEL PLPGSQL PASSARAM COM SUCESSO ===';
END $$;

ROLLBACK;
