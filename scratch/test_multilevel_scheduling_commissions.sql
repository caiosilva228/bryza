-- BRYZA - verificacao nao destrutiva do checkout publico e comissoes 4% / 2% / 1%.
-- Pre-requisito: migrations ate 20260718044648 aplicadas em um banco de homologacao.
-- A suite consulta catalogos e executa apenas calculos puros. Toda a sessao termina em ROLLBACK.

BEGIN;

DO $suite$
DECLARE
  v_definition TEXT;
  v_plan RECORD;
  v_direct NUMERIC(12,2);
  v_level_2 NUMERIC(12,2);
  v_level_3 NUMERIC(12,2);
BEGIN
  -- Estrutura do CRM e do agendamento publico.
  IF to_regclass('public.agendamentos') IS NULL
     OR to_regclass('public.agendamento_itens') IS NULL
     OR to_regclass('public.commissions') IS NULL THEN
    RAISE EXCEPTION 'FAIL structure: tabelas centrais ausentes';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes'
      AND column_name = 'cpf' AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes'
      AND column_name = 'own_ambassador_id' AND data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'FAIL structure: clientes sem cpf/own_ambassador_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agendamentos'
      AND column_name = 'submission_id' AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agendamentos'
      AND column_name = 'commission_plan_id_snapshot' AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agendamentos'
      AND column_name = 'commissionable_amount_snapshot'
  ) THEN
    RAISE EXCEPTION 'FAIL structure: snapshots/idempotencia do agendamento ausentes';
  END IF;

  IF to_regclass('public.uq_clientes_cpf_normalizado') IS NULL
     OR to_regclass('public.uq_clientes_own_ambassador') IS NULL
     OR to_regclass('public.uq_agendamentos_submission') IS NULL
     OR to_regclass('public.uq_commission_payments_reference') IS NULL THEN
    RAISE EXCEPTION 'FAIL idempotency: indices unicos esperados ausentes';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indexrelid = 'public.uq_agendamentos_submission'::regclass
      AND i.indisunique AND i.indpred IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL idempotency: submission_id nao possui indice unico parcial';
  END IF;

  -- Plano ativo 4/2/1, sem alterar o plano historico de 7%.
  SELECT direct_percentage, level_2_percentage, level_3_percentage,
         multilevel_enabled, status
    INTO v_plan
  FROM public.commission_plans
  WHERE id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID;

  IF NOT FOUND OR v_plan.direct_percentage <> 4.00
     OR v_plan.level_2_percentage <> 2.00
     OR v_plan.level_3_percentage <> 1.00
     OR v_plan.multilevel_enabled IS NOT TRUE
     OR v_plan.status <> 'ativo' THEN
    RAISE EXCEPTION 'FAIL plan: plano multinivel esperado 4/2/1 ativo, encontrado %', row_to_json(v_plan);
  END IF;

  -- Calculo financeiro puro e arredondamento por beneficiario.
  v_direct := round(79.80::NUMERIC * v_plan.direct_percentage / 100.0, 2);
  v_level_2 := round(79.80::NUMERIC * v_plan.level_2_percentage / 100.0, 2);
  v_level_3 := round(79.80::NUMERIC * v_plan.level_3_percentage / 100.0, 2);
  IF v_direct <> 3.19 OR v_level_2 <> 1.60 OR v_level_3 <> 0.80
     OR v_direct + v_level_2 + v_level_3 <> 5.59 THEN
    RAISE EXCEPTION 'FAIL calculation: esperado 3.19/1.60/0.80 (total 5.59), obtido %/%/%',
      v_direct, v_level_2, v_level_3;
  END IF;

  -- Assinaturas e propriedades de seguranca das RPCs.
  IF to_regprocedure('public.fn_criar_agendamento_publico(jsonb,jsonb,jsonb,uuid)') IS NULL
     OR to_regprocedure('public.fn_gerar_comissoes_multinivel(uuid)') IS NULL
     OR to_regprocedure('public.fn_converter_agendamento_em_pedido(uuid)') IS NULL
     OR to_regprocedure('public.fn_admin_criar_pagamento_comissoes(uuid,uuid[],text,text,boolean,text)') IS NULL THEN
    RAISE EXCEPTION 'FAIL functions: uma ou mais RPCs esperadas estao ausentes';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = 'public.fn_criar_agendamento_publico(jsonb,jsonb,jsonb,uuid)'::regprocedure
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=public, pg_temp']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'FAIL security: checkout nao e SECURITY DEFINER com search_path fixo';
  END IF;

  IF has_function_privilege('anon', 'public.fn_criar_agendamento_publico(jsonb,jsonb,jsonb,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_criar_agendamento_publico(jsonb,jsonb,jsonb,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.fn_criar_agendamento_publico(jsonb,jsonb,jsonb,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL security: privilegios do checkout publico incorretos';
  END IF;

  -- Idempotencia conceitual: chave unica do checkout e conflito composto das comissoes.
  SELECT pg_get_functiondef('public.fn_criar_agendamento_publico(jsonb,jsonb,jsonb,uuid)'::regprocedure)
    INTO v_definition;
  IF position('submission_id = p_idempotency_key' IN v_definition) = 0
     OR position('EXCEPTION WHEN unique_violation' IN v_definition) = 0
     OR position('''valor_total'', v_existing.valor_total' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'FAIL idempotency: checkout nao trata repeticao/concorrencia da submission_id';
  END IF;

  SELECT pg_get_functiondef('public.fn_gerar_comissoes_multinivel(uuid)'::regprocedure)
    INTO v_definition;
  IF position('FOR v_level IN 1..3 LOOP' IN v_definition) = 0
     OR position('ON CONFLICT (order_id, ambassador_id, commission_level) DO NOTHING' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'FAIL idempotency: motor nao percorre 3 niveis ou nao evita duplicacao';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.commissions'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (order_id, ambassador_id, commission_level)'
  ) THEN
    RAISE EXCEPTION 'FAIL idempotency: constraint composta de comissao ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.commissions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%commission_level%1%3%'
  ) THEN
    RAISE EXCEPTION 'FAIL constraints: commission_level nao esta limitado a 1..3';
  END IF;

  -- Triggers novos presentes e validacao legada substituida por versao multinivel.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.pedidos'::regclass
      AND tgname = 'trg_generate_order_commissions' AND NOT tgisinternal AND tgenabled <> 'D'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.pedidos'::regclass
      AND tgname = 'trg_sync_commission_status' AND NOT tgisinternal AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'FAIL triggers: geracao/sincronismo de comissoes ausente ou desabilitado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.commissions'::regclass
      AND tgname = 'trg_valida_comissao_pedido' AND NOT tgisinternal AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'FAIL compatibility: trigger de validacao de beneficiario ausente';
  END IF;

  SELECT pg_get_functiondef('public.fn_trg_valida_comissao_pedido()'::regprocedure)
    INTO v_definition;
  IF position('NEW.commission_level NOT BETWEEN 1 AND 3' IN v_definition) = 0
     OR position('v_order.status_pedido NOT IN' IN v_definition) > 0
     OR position('NEW.ambassador_id != v_order.ambassador_id' IN v_definition) > 0 THEN
    RAISE EXCEPTION 'FAIL compatibility: validacao de comissao ainda restringe indevidamente L2/L3 ou pedido novo';
  END IF;

  SELECT pg_get_functiondef('public.fn_amb_protect_seller_overrides()'::regprocedure)
    INTO v_definition;
  IF position('bryza.allow_seller_referral_snapshots' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'FAIL compatibility: protecao de vendedor nao reconhece a conversao atomica autorizada';
  END IF;
  SELECT pg_get_functiondef('public.fn_converter_agendamento_em_pedido(uuid)'::regprocedure)
    INTO v_definition;
  IF position('set_config(''bryza.allow_seller_referral_snapshots'', ''true'', TRUE)' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'FAIL compatibility: conversao por vendedor nao habilita snapshots apenas na transacao';
  END IF;

  -- O motor precisa representar todos os estados financeiros previstos.
  SELECT pg_get_functiondef('public.fn_gerar_comissoes_multinivel(uuid)'::regprocedure)
    INTO v_definition;
  IF position('aguardando_entrega' IN v_definition) = 0
     OR position('aguardando_pagamento' IN v_definition) = 0
     OR position('liberada' IN v_definition) = 0
     OR position('cancelada' IN v_definition) = 0
     OR position('payment_check_status = ''confirmado''' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'FAIL states: motor nao cobre estados de entrega/pagamento/cancelamento';
  END IF;

  -- RLS: policies abertas antigas nao podem permanecer ativas.
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid IN ('public.agendamentos'::regclass, 'public.agendamento_itens'::regclass)
      AND (
        COALESCE(pg_get_expr(polqual, polrelid), '') IN ('true', '(true)')
        OR COALESCE(pg_get_expr(polwithcheck, polrelid), '') IN ('true', '(true)')
      )
  ) THEN
    RAISE EXCEPTION 'FAIL RLS: policy de leitura/alteracao irrestrita ainda presente em agendamentos';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.agendamentos'::regclass
      AND polname = 'agendamentos_delete_admin_only' AND polcmd = 'd'
  ) THEN
    RAISE EXCEPTION 'FAIL RLS: policy administrativa esperada ausente';
  END IF;

  RAISE NOTICE 'PASS: estrutura, plano 4/2/1, calculos, idempotencia, estados, triggers e RLS validados';
END
$suite$;

-- Matriz pura dos estados, independente de dados de negocio.
DO $states$
DECLARE
  v_failure_count INTEGER;
BEGIN
  WITH cases(status_pedido, payment_status, expected) AS (
    VALUES
      ('aguardando_preparacao', 'pendente', 'aguardando_entrega'),
      ('em_rota',              'pendente', 'aguardando_entrega'),
      ('entregue',             'pendente', 'aguardando_pagamento'),
      ('entregue',             'confirmado', 'liberada'),
      ('finalizado',           'confirmado', 'liberada'),
      ('cancelado',            'pendente', 'cancelada')
  ), evaluated AS (
    SELECT expected,
      CASE
        WHEN status_pedido = 'cancelado' THEN 'cancelada'
        WHEN status_pedido IN ('entregue', 'finalizado') AND payment_status = 'confirmado' THEN 'liberada'
        WHEN status_pedido IN ('entregue', 'finalizado') THEN 'aguardando_pagamento'
        ELSE 'aguardando_entrega'
      END AS actual
    FROM cases
  )
  SELECT count(*) INTO v_failure_count FROM evaluated WHERE actual <> expected;

  IF v_failure_count <> 0 THEN
    RAISE EXCEPTION 'FAIL states: % transicoes puras divergentes', v_failure_count;
  END IF;
  RAISE NOTICE 'PASS: matriz pura de estados validada';
END
$states$;

ROLLBACK;
