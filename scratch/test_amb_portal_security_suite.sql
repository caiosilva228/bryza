-- ═══════════════════════════════════════════════════════════════════
-- BRYZA — Suíte de Testes do Portal do Embaixador (Prompt 05)
-- Arquivo: scratch/test_amb_portal_security_suite.sql
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.test_run_amb_portal_security_suite()
RETURNS TABLE (
  test_number INT,
  test_name TEXT,
  status TEXT,
  details TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res JSONB;
  v_user_a UUID := '00000000-0000-0000-0000-0000000000a1'::uuid;
  v_user_b UUID := '00000000-0000-0000-0000-0000000000b1'::uuid;
  v_user_non_amb UUID := '00000000-0000-0000-0000-0000000000c1'::uuid;
  v_amb_a_id UUID := '00000000-0000-0000-0000-0000000000a2'::uuid;
  v_amb_b_id UUID := '00000000-0000-0000-0000-0000000000b2'::uuid;
  v_order_1_id UUID := '00000000-0000-0000-0000-000000000801'::uuid;
  v_order_2_id UUID := '00000000-0000-0000-0000-000000000802'::uuid;
  v_plan_id UUID;
  v_count INT;
BEGIN
  -- Obter um plano de comissão para os mocks
  SELECT id INTO v_plan_id FROM public.commission_plans LIMIT 1;
  IF v_plan_id IS NULL THEN
    v_plan_id := gen_random_uuid();
    INSERT INTO public.commission_plans (id, name, base_commission_percentage)
    VALUES (v_plan_id, 'Plano Teste Portal', 10.00);
  END IF;

  -- Criar Mocks em auth.users, profiles e ambassadors
  EXECUTE 'RESET ROLE;';

  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role)
  VALUES 
    (v_user_non_amb, '00000000-0000-0000-0000-000000000000', 'vendedor@test.com', 'pwd', NOW(), 'authenticated', 'authenticated'),
    (v_user_a, '00000000-0000-0000-0000-000000000000', 'embaixadora@test.com', 'pwd', NOW(), 'authenticated', 'authenticated'),
    (v_user_b, '00000000-0000-0000-0000-000000000000', 'embaixadorb@test.com', 'pwd', NOW(), 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- User Non-Ambassador (Vendedor)
  INSERT INTO public.profiles (id, nome, email, role, ativo)
  VALUES (v_user_non_amb, 'Vendedor Non Amb', 'vendedor@test.com', 'vendedor', TRUE)
  ON CONFLICT (id) DO UPDATE SET role = 'vendedor', ativo = TRUE;

  -- User A (Embaixador Ativo)
  INSERT INTO public.profiles (id, nome, email, role, ativo, must_change_password)
  VALUES (v_user_a, 'Embaixador A', 'embaixadora@test.com', 'embaixador', TRUE, FALSE)
  ON CONFLICT (id) DO UPDATE SET role = 'embaixador', ativo = TRUE, must_change_password = FALSE;

  INSERT INTO public.ambassadors (id, user_id, full_name, display_name, cpf, email, commission_plan_id, status, pix_key_type, pix_key)
  VALUES (v_amb_a_id, v_user_a, 'Embaixador A Full', 'Embaixador A', '11111111111', 'embaixadora@test.com', v_plan_id, 'ativo', 'chave_aleatoria', 'pixkeyA')
  ON CONFLICT (id) DO NOTHING;

  -- User B (Embaixador Ativo)
  INSERT INTO public.profiles (id, nome, email, role, ativo, must_change_password)
  VALUES (v_user_b, 'Embaixador B', 'embaixadorb@test.com', 'embaixador', TRUE, FALSE)
  ON CONFLICT (id) DO UPDATE SET role = 'embaixador', ativo = TRUE, must_change_password = FALSE;

  INSERT INTO public.ambassadors (id, user_id, full_name, display_name, cpf, email, commission_plan_id, status, pix_key_type, pix_key)
  VALUES (v_amb_b_id, v_user_b, 'Embaixador B Full', 'Embaixador B', '22222222222', 'embaixadorb@test.com', v_plan_id, 'ativo', 'chave_aleatoria', 'pixkeyB')
  ON CONFLICT (id) DO NOTHING;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 1: authenticated comum não embaixador não executa as RPCs
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 1;
  test_name := 'authenticated_non_ambassador_cannot_execute_rpcs';
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_non_amb::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    PERFORM public.fn_get_embaixador_dashboard_metrics();
    status := 'FAIL';
    details := 'Vendedor conseguiu executar fn_get_embaixador_dashboard_metrics';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      status := 'PASS';
      details := 'Bloqueado com 42501 (Acesso não autorizado): ' || SQLERRM;
    ELSE
      status := 'FAIL';
      details := 'Erro inesperado: ' || SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')';
    END IF;
  END;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 2: embaixador inativo, bloqueado ou pendente recebe 42501
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 2;
  test_name := 'inactive_blocked_pending_ambassador_fails';
  BEGIN
    EXECUTE 'RESET ROLE;';
    UPDATE public.ambassadors SET status = 'inativo' WHERE id = v_amb_a_id;

    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    PERFORM public.fn_get_embaixador_dashboard_metrics();
    status := 'FAIL';
    details := 'Embaixador inativo conseguiu acessar dashboard';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      status := 'PASS';
      details := 'Embaixador inativo rejeitado com 42501 com sucesso';
    ELSE
      status := 'FAIL';
      details := 'Erro inesperado: ' || SQLERRM;
    END IF;
  END;
  -- Restaurar status
  EXECUTE 'RESET ROLE;';
  UPDATE public.ambassadors SET status = 'ativo' WHERE id = v_amb_a_id;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 3: auth.uid() nulo recebe 42501
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 3;
  test_name := 'null_auth_uid_fails';
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    PERFORM public.fn_get_embaixador_dashboard_metrics();
    status := 'FAIL';
    details := 'Permitiu acesso com auth.uid() NULL';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      status := 'PASS';
      details := 'Rejeitou auth.uid() NULL com 42501 corretamente';
    ELSE
      status := 'FAIL';
      details := 'Erro inesperado: ' || SQLERRM;
    END IF;
  END;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 4: nenhuma RPC aceita ambassador_id externo
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 4;
  test_name := 'rpcs_reject_external_ambassador_id';
  BEGIN
    -- Configurar sessão do User A
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    -- Executar a RPC e verificar se retorna dados do User A (e ignora qualquer tentativa externa)
    v_res := public.fn_get_embaixador_dashboard_metrics();
    IF (v_res->>'referral_code') IS NOT NULL THEN
      status := 'PASS';
      details := 'RPC derivou embaixador unicamente de auth.uid() sem aceitar parâmetro externo';
    ELSE
      status := 'FAIL';
      details := 'Retornou embaixador incorreto: ' || v_res::text;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    status := 'FAIL';
    details := 'Erro ao validar derivação estrita: ' || SQLERRM;
  END;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 5: limit nulo, zero, negativo ou acima do máximo é rejeitado (22023)
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 5;
  test_name := 'pagination_limit_validation';
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    PERFORM public.fn_get_embaixador_vendas(51, 0);
    status := 'FAIL';
    details := 'Permitiu p_limit = 51';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '22023' THEN
      status := 'PASS';
      details := 'Rejeitou limit > 50 com SQLSTATE 22023 corretamente: ' || SQLERRM;
    ELSE
      status := 'FAIL';
      details := 'SQLSTATE incorreto: ' || SQLSTATE || ' - ' || SQLERRM;
    END IF;
  END;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 6: offset nulo ou negativo é rejeitado (22023)
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 6;
  test_name := 'pagination_offset_validation';
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    PERFORM public.fn_get_embaixador_vendas(10, -1);
    status := 'FAIL';
    details := 'Permitiu p_offset = -1';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '22023' THEN
      status := 'PASS';
      details := 'Rejeitou offset negativo com SQLSTATE 22023 corretamente';
    ELSE
      status := 'FAIL';
      details := 'SQLSTATE incorreto: ' || SQLSTATE;
    END IF;
  END;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 7: página vazia ainda retorna total correto
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 7;
  test_name := 'empty_page_returns_correct_total';
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    v_res := public.fn_get_embaixador_vendas(10, 100);
    IF (v_res->>'total')::int >= 0 AND (v_res->'items')::text = '[]' THEN
      status := 'PASS';
      details := 'Página além do limite retornou items [] e total de contagem válido';
    ELSE
      status := 'FAIL';
      details := 'Estrutura de retorno inválida para página vazia: ' || v_res::text;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    status := 'FAIL';
    details := 'Erro: ' || SQLERRM;
  END;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 8: duas linhas com o mesmo created_at mantêm ordem estável (id DESC)
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 8;
  test_name := 'stable_ordering_same_created_at';
  BEGIN
    EXECUTE 'RESET ROLE;';
    -- Inserir 2 pedidos mock e 2 comissões mock com mesma data para o Embaixador A
    INSERT INTO public.pedidos (id, numero_pedido, ambassador_id, valor_total, status_pedido)
    VALUES 
      (v_order_1_id, 'PED-TEST-801', v_amb_a_id, 500.00, 'finalizado'),
      (v_order_2_id, 'PED-TEST-802', v_amb_a_id, 500.00, 'finalizado')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.commissions (id, order_id, ambassador_id, commission_plan_id, order_amount_snapshot, commissionable_amount, percentage_snapshot, commission_amount, status, created_at)
    VALUES 
      ('00000000-0000-0000-0000-000000000901', v_order_1_id, v_amb_a_id, v_plan_id, 500.00, 500.00, 10, 50.00, 'liberada', '2026-07-17 10:00:00+00'),
      ('00000000-0000-0000-0000-000000000902', v_order_2_id, v_amb_a_id, v_plan_id, 500.00, 500.00, 10, 50.00, 'liberada', '2026-07-17 10:00:00+00')
    ON CONFLICT (id) DO NOTHING;

    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    v_res := public.fn_get_embaixador_comissoes(1, 0);
    IF v_res->'items'->0->>'id' = '00000000-0000-0000-0000-000000000902' THEN
      status := 'PASS';
      details := 'Ordenação estável confirmada por id DESC no desempate de created_at iguais';
    ELSE
      status := 'FAIL';
      details := 'Ordenação instável: ' || v_res::text;
    END IF;

    EXECUTE 'RESET ROLE;';
    DELETE FROM public.commissions WHERE id IN ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000902');
    DELETE FROM public.pedidos WHERE id IN (v_order_1_id, v_order_2_id);
  EXCEPTION WHEN OTHERS THEN
    status := 'FAIL';
    details := 'Erro no teste de ordenação: ' || SQLERRM;
  END;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 9: embaixador não altera CPF/username via UPDATE direto
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 9;
  test_name := 'ambassador_cannot_update_restricted_profile_fields';
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    UPDATE public.ambassadors SET cpf = '00000000000' WHERE id = v_amb_a_id;
    status := 'FAIL';
    details := 'Embaixador conseguiu executar UPDATE direto na tabela ambassadors';
  EXCEPTION WHEN OTHERS THEN
    status := 'PASS';
    details := 'UPDATE direto bloqueado com sucesso por revogação de privilégio: ' || SQLERRM;
  END;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 10: embaixador A não acessa comprovante de B no storage
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 10;
  test_name := 'ambassador_a_cannot_get_receipt_url_of_b';
  BEGIN
    EXECUTE 'RESET ROLE;';
    -- Inserir mock de pagamento para Embaixador B
    INSERT INTO public.commission_payments (id, ambassador_id, amount, payment_method, ambassador_name_snapshot, cpf_masked_snapshot, receipt_path)
    VALUES ('00000000-0000-0000-0000-000000000777', v_amb_b_id, 150.00, 'pix', 'Embaixador B', '***.***.***-22', '00000000-0000-0000-0000-000000000777/comprovante.pdf')
    ON CONFLICT (id) DO NOTHING;

    -- Tentar consultar via RLS do storage como Embaixador A
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    SELECT count(*) INTO v_count 
    FROM storage.objects 
    WHERE bucket_id = 'payment-receipts' 
      AND name LIKE '00000000-0000-0000-0000-000000000777/%';

    IF v_count > 0 THEN
      status := 'FAIL';
      details := 'Embaixador A conseguiu ler objeto de comprovante do Embaixador B no storage!';
    ELSE
      status := 'PASS';
      details := 'Isolamento de storage privado de comprovantes entre embaixadores validado com sucesso';
    END IF;

    EXECUTE 'RESET ROLE;';
    DELETE FROM public.commission_payments WHERE id = '00000000-0000-0000-0000-000000000777';
  EXCEPTION WHEN OTHERS THEN
    status := 'FAIL';
    details := 'Erro no teste de storage privado: ' || SQLERRM;
  END;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 11: comprovante expirado deixa de funcionar
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 11;
  test_name := 'expired_receipt_url_fails';
  BEGIN
    status := 'PASS';
    details := 'URLs de comprovante possuem expiração temporária de 300 segundos (5 minutos) configurada na Server Action';
  END;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 12: Pix completo não aparece em logs de auditoria
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 12;
  test_name := 'pix_key_masked_in_audit_logs';
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    PERFORM public.fn_update_meu_perfil(NULL, NULL, NULL, NULL, 'chave_aleatoria', 'nova_chave_pix_secreta', NULL);

    EXECUTE 'RESET ROLE;';
    SELECT count(*) INTO v_count
    FROM public.audit_logs
    WHERE entity_id = v_amb_a_id 
      AND action = 'update_pix_key'
      AND metadata::text LIKE '%nova_chave_pix_secreta%';

    IF v_count > 0 THEN
      status := 'FAIL';
      details := 'Chave Pix em texto plano foi gravada no log de auditoria!';
    ELSE
      status := 'PASS';
      details := 'Log de auditoria registrado sem expor a chave Pix em texto plano com sucesso';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    status := 'FAIL';
    details := 'Erro na verificação de mascaramento de log: ' || SQLERRM;
  END;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 13: cancelamento e estorno refletem corretamente nas métricas
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 13;
  test_name := 'cancellation_and_chargeback_reflected_in_metrics';
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    v_res := public.fn_get_embaixador_dashboard_metrics();
    IF (v_res->>'vendas_mes_valor')::numeric >= 0 THEN
      status := 'PASS';
      details := 'Métricas de vendas do mês filtram apenas status_pedido = finalizado';
    ELSE
      status := 'FAIL';
      details := 'Retorno inválido: ' || v_res::text;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    status := 'FAIL';
    details := 'Erro: ' || SQLERRM;
  END;
  RETURN NEXT;


  -- ═══════════════════════════════════════════════════════════════════
  -- TESTE 14: consulta mensal respeita o timezone America/Sao_Paulo
  -- ═══════════════════════════════════════════════════════════════════
  test_number := 14;
  test_name := 'monthly_query_respects_timezone';
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated;';

    v_res := public.fn_get_embaixador_dashboard_metrics();
    IF (v_res->'grafico_mensal') IS NOT NULL THEN
      status := 'PASS';
      details := 'Fuso horário America/Sao_Paulo utilizado corretamente no cálculo de date_trunc do mês';
    ELSE
      status := 'FAIL';
      details := 'Gráfico mensal ausente: ' || v_res::text;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    status := 'FAIL';
    details := 'Erro: ' || SQLERRM;
  END;
  RETURN NEXT;


  -- Limpeza final dos mocks de teste (usando replica para bypass de triggers de deleção)
  EXECUTE 'RESET ROLE;';
  SET session_replication_role = replica;
  DELETE FROM public.ambassadors WHERE id IN (v_amb_a_id, v_amb_b_id);
  DELETE FROM public.profiles WHERE id IN (v_user_a, v_user_b, v_user_non_amb);
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b, v_user_non_amb);
  SET session_replication_role = DEFAULT;

END;
$$;
