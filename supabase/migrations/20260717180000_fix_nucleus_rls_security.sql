-- Migration: 20260717180000_fix_nucleus_rls_security.sql
-- Descrição: Configuração de RLS, Triggers Consolidados, Constraints e Grants das tabelas do Núcleo
-- Autor: Antigravity

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. CORREÇÃO DA FUNÇÃO get_user_role()
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.ativo = true;
$$;

REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 2. VALIDAÇÃO E ALTERAÇÃO DE pedido_id PARA NOT NULL
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.pedido_itens
    WHERE pedido_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Migration interrompida: existem pedido_itens sem pedido_id.';
  END IF;
END;
$$;

ALTER TABLE public.pedido_itens ALTER COLUMN pedido_id SET NOT NULL;


-- ═══════════════════════════════════════════════════════════════════
-- 3. CHECK CONSTRAINTS DE STATUS
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_status_pedido_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_status_pedido_check
  CHECK (status_pedido IN ('aguardando_preparacao', 'pronto_para_entrega', 'em_rota', 'entregue', 'finalizado', 'cancelado'));

ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_payment_check_status_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_payment_check_status_check
  CHECK (payment_check_status IN ('pendente', 'confirmado', 'divergente'));


-- ═══════════════════════════════════════════════════════════════════
-- 4. CRIAÇÃO DA FUNÇÃO CONSOLIDADA DE TRIGGER DE SEGURANÇA E MATRIZ EM pedidos
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_pedidos_security_before_update()
RETURNS TRIGGER AS $$
DECLARE
  v_role public.app_role;
BEGIN
  v_role := public.get_user_role();

  -- A. VALIDAÇÃO DE ESTADO TERMINAL (BLOQUEIA SAÍDA DE STATUS FINALIZADO/CANCELADO)
  IF OLD.status_pedido IN ('finalizado', 'cancelado') AND NEW.status_pedido IS DISTINCT FROM OLD.status_pedido THEN
    RAISE EXCEPTION 'Pedidos com status finalizado ou cancelado não podem ser alterados para outros status.';
  END IF;

  -- B. RESTRIÇÕES DE PAPEL VENDEDOR (APLICA-SE NO UPDATE)
  IF v_role = 'vendedor'::public.app_role THEN
    -- Vendedor somente pode editar se status atual e novo forem 'aguardando_preparacao'
    IF OLD.status_pedido <> 'aguardando_preparacao' OR NEW.status_pedido <> 'aguardando_preparacao' THEN
      RAISE EXCEPTION 'Vendedores não podem alterar o status de pedidos ou modificar pedidos fora da fase de preparação.';
    END IF;

    -- Bloquear alteração se tentar modificar qualquer campo que não seja explicitamente comercial editável
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.numero_pedido IS DISTINCT FROM OLD.numero_pedido OR
       NEW.vendedor_id IS DISTINCT FROM OLD.vendedor_id OR
       NEW.nome_vendedor IS DISTINCT FROM OLD.nome_vendedor OR
       NEW.codigo_vendedor IS DISTINCT FROM OLD.codigo_vendedor OR
       NEW.created_at IS DISTINCT FROM OLD.created_at OR
       NEW.status_pedido IS DISTINCT FROM OLD.status_pedido OR
       NEW.motorista IS DISTINCT FROM OLD.motorista OR
       NEW.rota IS DISTINCT FROM OLD.rota OR
       NEW.delivery_started_at IS DISTINCT FROM OLD.delivery_started_at OR
       NEW.delivered_at IS DISTINCT FROM OLD.delivered_at OR
       NEW.finalized_at IS DISTINCT FROM OLD.finalized_at OR
       NEW.payment_check_status IS DISTINCT FROM OLD.payment_check_status OR
       NEW.amount_received IS DISTINCT FROM OLD.amount_received OR
       NEW.delivery_problem_type IS DISTINCT FROM OLD.delivery_problem_type OR
       NEW.delivery_notes IS DISTINCT FROM OLD.delivery_notes OR
       NEW.forma_pagamento IS DISTINCT FROM OLD.forma_pagamento OR
       NEW.ambassador_id IS DISTINCT FROM OLD.ambassador_id OR
       NEW.referral_code_snapshot IS DISTINCT FROM OLD.referral_code_snapshot OR
       NEW.commission_plan_id_snapshot IS DISTINCT FROM OLD.commission_plan_id_snapshot OR
       NEW.commission_percentage_snapshot IS DISTINCT FROM OLD.commission_percentage_snapshot OR
       NEW.commissionable_amount_snapshot IS DISTINCT FROM OLD.commissionable_amount_snapshot OR
       NEW.commission_amount_snapshot IS DISTINCT FROM OLD.commission_amount_snapshot
    THEN
      RAISE EXCEPTION 'Vendedores não possuem permissão para alterar o status, dados de logística, pagamento, embaixador ou vendedor do pedido.';
    END IF;
  END IF;

  -- C. PROTEÇÃO DE COLUNAS PARA PAPEL LOGÍSTICA
  IF v_role = 'logistica'::public.app_role THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.numero_pedido IS DISTINCT FROM OLD.numero_pedido OR
       NEW.cliente_id IS DISTINCT FROM OLD.cliente_id OR
       NEW.vendedor_id IS DISTINCT FROM OLD.vendedor_id OR
       NEW.valor_total IS DISTINCT FROM OLD.valor_total OR
       NEW.observacoes IS DISTINCT FROM OLD.observacoes OR
       NEW.created_at IS DISTINCT FROM OLD.created_at OR
       NEW.nome_cliente IS DISTINCT FROM OLD.nome_cliente OR
       NEW.telefone_cliente IS DISTINCT FROM OLD.telefone_cliente OR
       NEW.endereco_entrega IS DISTINCT FROM OLD.endereco_entrega OR
       NEW.bairro IS DISTINCT FROM OLD.bairro OR
       NEW.cidade IS DISTINCT FROM OLD.cidade OR
       NEW.estado IS DISTINCT FROM OLD.estado OR
       NEW.cep IS DISTINCT FROM OLD.cep OR
       NEW.nome_vendedor IS DISTINCT FROM OLD.nome_vendedor OR
       NEW.codigo_vendedor IS DISTINCT FROM OLD.codigo_vendedor OR
       NEW.complemento IS DISTINCT FROM OLD.complemento OR
       NEW.desconto_tipo IS DISTINCT FROM OLD.desconto_tipo OR
       NEW.desconto_valor IS DISTINCT FROM OLD.desconto_valor OR
       NEW.desconto_aplicado IS DISTINCT FROM OLD.desconto_aplicado OR
       NEW.ambassador_id IS DISTINCT FROM OLD.ambassador_id OR
       NEW.referral_code_snapshot IS DISTINCT FROM OLD.referral_code_snapshot OR
       NEW.commission_plan_id_snapshot IS DISTINCT FROM OLD.commission_plan_id_snapshot OR
       NEW.commission_percentage_snapshot IS DISTINCT FROM OLD.commission_percentage_snapshot OR
       NEW.commissionable_amount_snapshot IS DISTINCT FROM OLD.commissionable_amount_snapshot OR
       NEW.commission_amount_snapshot IS DISTINCT FROM OLD.commission_amount_snapshot
    THEN
      RAISE EXCEPTION 'A logística não possui permissão para alterar dados comerciais, do cliente ou de comissão do pedido.';
    END IF;
  END IF;

  -- D. VALIDAÇÃO DA MATRIZ DE TRANSIÇÃO DE STATUS
  IF NEW.status_pedido IS DISTINCT FROM OLD.status_pedido THEN
    IF NOT (
      (OLD.status_pedido = 'aguardando_preparacao' AND NEW.status_pedido IN ('pronto_para_entrega', 'cancelado')) OR
      (OLD.status_pedido = 'pronto_para_entrega' AND NEW.status_pedido IN ('em_rota', 'cancelado')) OR
      (OLD.status_pedido = 'em_rota' AND NEW.status_pedido IN ('entregue', 'pronto_para_entrega', 'cancelado')) OR
      (OLD.status_pedido = 'entregue' AND NEW.status_pedido IN ('finalizado', 'cancelado'))
    ) THEN
      RAISE EXCEPTION 'Transição de status inválida: de % para %.', OLD.status_pedido, NEW.status_pedido;
    END IF;

    -- Restrições operacionais específicas de papel
    IF v_role = 'logistica'::public.app_role AND OLD.status_pedido = 'aguardando_preparacao' AND NEW.status_pedido = 'cancelado' THEN
      RAISE EXCEPTION 'A logística não possui permissão para cancelar pedidos em fase de preparação.';
    END IF;

    -- Vendedor não pode alterar status diretamente (segurança extra)
    IF v_role = 'vendedor'::public.app_role THEN
      RAISE EXCEPTION 'Vendedores não possuem permissão para alterar status de pedidos diretamente.';
    END IF;
    
    -- O cancelamento de pedido em aguardando_preparacao deve ser permitido somente para admin
    IF OLD.status_pedido = 'aguardando_preparacao' AND NEW.status_pedido = 'cancelado' AND v_role <> 'admin'::public.app_role THEN
      RAISE EXCEPTION 'Apenas administradores podem cancelar pedidos em fase de preparação.';
    END IF;
  END IF;

  -- E. REGRAS DEFINITIVAS DE PAGAMENTO
  -- Confirmação de Pagamento (confirmado)
  IF NEW.payment_check_status = 'confirmado' AND OLD.payment_check_status IS DISTINCT FROM 'confirmado' THEN
    IF OLD.status_pedido <> 'entregue' THEN
      RAISE EXCEPTION 'A confirmação de pagamento só é permitida para pedidos com status "entregue". Status atual: %.', OLD.status_pedido;
    END IF;
    IF NEW.amount_received IS NULL THEN
      RAISE EXCEPTION 'Para confirmar o pagamento, o valor recebido deve ser informado.';
    END IF;
    IF ABS(NEW.amount_received - NEW.valor_total) > 0.01 THEN
      RAISE EXCEPTION 'Para confirmar o pagamento, o valor recebido (%) deve ser igual ao valor total do pedido (%).', NEW.amount_received, NEW.valor_total;
    END IF;
    IF NEW.forma_pagamento IS NULL OR NEW.forma_pagamento = '' THEN
      RAISE EXCEPTION 'Para confirmar o pagamento, a forma de pagamento deve ser informada.';
    END IF;

    NEW.status_pedido := 'finalizado';
    NEW.finalized_at := now();
  END IF;

  -- Impedir modificações isoladas após confirmado
  IF OLD.payment_check_status = 'confirmado' THEN
    IF NEW.payment_check_status = 'confirmado' AND (
       NEW.amount_received IS DISTINCT FROM OLD.amount_received OR
       NEW.forma_pagamento IS DISTINCT FROM OLD.forma_pagamento
    ) THEN
      RAISE EXCEPTION 'Não é permitido modificar a forma de pagamento ou valor recebido de um pagamento já confirmado.';
    END IF;
  END IF;

  -- Status Divergente (divergente)
  IF NEW.payment_check_status = 'divergente' AND OLD.payment_check_status IS DISTINCT FROM 'divergente' THEN
    IF OLD.status_pedido <> 'entregue' THEN
      RAISE EXCEPTION 'Status divergente só é permitido para pedidos com status "entregue". Status atual: %.', OLD.status_pedido;
    END IF;
    IF NEW.amount_received IS NULL THEN
      RAISE EXCEPTION 'Para marcar como divergente, o valor recebido deve ser informado.';
    END IF;
    IF ABS(NEW.amount_received - NEW.valor_total) <= 0.01 THEN
      RAISE EXCEPTION 'Para marcar como divergente, o valor recebido (%) deve ser diferente do valor total do pedido (%).', NEW.amount_received, NEW.valor_total;
    END IF;
    IF NEW.forma_pagamento IS NULL OR NEW.forma_pagamento = '' THEN
      RAISE EXCEPTION 'Para marcar como divergente, a forma de pagamento deve ser informada.';
    END IF;
    
    -- Logística não pode reverter/alterar confirmado para divergente
    IF OLD.payment_check_status = 'confirmado' AND v_role = 'logistica'::public.app_role THEN
      RAISE EXCEPTION 'A logística não pode alterar um pagamento já confirmado para divergente.';
    END IF;
  END IF;

  -- Reversão para Pendente
  IF NEW.payment_check_status = 'pendente' AND OLD.payment_check_status IN ('confirmado', 'divergente') THEN
    IF v_role = 'logistica'::public.app_role THEN
      RAISE EXCEPTION 'A logística não pode reverter uma conferência de pagamento para pendente.';
    END IF;
    
    -- Não permitir reversão se o pedido estiver finalizado (bloqueio definitivo)
    IF OLD.status_pedido = 'finalizado' THEN
      RAISE EXCEPTION 'Não é permitido reverter o pagamento de um pedido já finalizado.';
    END IF;

    NEW.amount_received := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Revogar acesso público à função executada por trigger
REVOKE ALL ON FUNCTION public.fn_pedidos_security_before_update() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_pedidos_security_update ON public.pedidos;
CREATE TRIGGER trg_pedidos_security_update
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_pedidos_security_before_update();


-- ═══════════════════════════════════════════════════════════════════
-- 5. HABILITAÇÃO E CONFIGURAÇÃO RLS DE public.pedidos
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedidos_select_policy" ON public.pedidos;
CREATE POLICY "pedidos_select_policy" ON public.pedidos
  FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('admin', 'logistica')
    OR (get_user_role() = 'vendedor' AND vendedor_id = auth.uid())
  );

DROP POLICY IF EXISTS "pedidos_insert_policy" ON public.pedidos;
CREATE POLICY "pedidos_insert_policy" ON public.pedidos
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'vendedor' 
      AND vendedor_id = auth.uid() 
      AND status_pedido = 'aguardando_preparacao'
      AND motorista IS NULL
      AND rota IS NULL
      AND delivery_started_at IS NULL
      AND delivered_at IS NULL
      AND finalized_at IS NULL
      AND payment_check_status = 'pendente'
      AND amount_received IS NULL
      AND delivery_problem_type IS NULL
      AND delivery_notes IS NULL
      AND ambassador_id IS NULL
      AND referral_code_snapshot IS NULL
      AND commission_plan_id_snapshot IS NULL
      AND commission_percentage_snapshot IS NULL
      AND commissionable_amount_snapshot IS NULL
      AND commission_amount_snapshot IS NULL
    )
  );

DROP POLICY IF EXISTS "pedidos_update_policy" ON public.pedidos;
CREATE POLICY "pedidos_update_policy" ON public.pedidos
  FOR UPDATE TO authenticated
  USING (
    get_user_role() IN ('admin', 'logistica')
    OR (get_user_role() = 'vendedor' AND vendedor_id = auth.uid() AND status_pedido = 'aguardando_preparacao')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'logistica')
    OR (get_user_role() = 'vendedor' AND vendedor_id = auth.uid() AND status_pedido = 'aguardando_preparacao')
  );

DROP POLICY IF EXISTS "pedidos_delete_policy" ON public.pedidos;
CREATE POLICY "pedidos_delete_policy" ON public.pedidos
  FOR DELETE TO authenticated
  USING (
    get_user_role() = 'admin'
    OR (get_user_role() = 'vendedor' AND vendedor_id = auth.uid() AND status_pedido = 'aguardando_preparacao')
  );


-- ═══════════════════════════════════════════════════════════════════
-- 6. HABILITAÇÃO E CONFIGURAÇÃO RLS DE public.pedido_itens
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedido_itens_select_policy" ON public.pedido_itens;
CREATE POLICY "pedido_itens_select_policy" ON public.pedido_itens
  FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('admin', 'logistica')
    OR (
      get_user_role() = 'vendedor'
      AND EXISTS (
        SELECT 1 FROM public.pedidos p
        WHERE p.id = pedido_itens.pedido_id AND p.vendedor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "pedido_itens_insert_policy" ON public.pedido_itens;
CREATE POLICY "pedido_itens_insert_policy" ON public.pedido_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'vendedor'
      AND EXISTS (
        SELECT 1 FROM public.pedidos p
        WHERE p.id = pedido_itens.pedido_id AND p.vendedor_id = auth.uid() AND p.status_pedido = 'aguardando_preparacao'
      )
    )
  );

DROP POLICY IF EXISTS "pedido_itens_update_policy" ON public.pedido_itens;
CREATE POLICY "pedido_itens_update_policy" ON public.pedido_itens
  FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'vendedor'
      AND EXISTS (
        SELECT 1 FROM public.pedidos p
        WHERE p.id = pedido_itens.pedido_id AND p.vendedor_id = auth.uid() AND p.status_pedido = 'aguardando_preparacao'
      )
    )
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'vendedor'
      AND EXISTS (
        SELECT 1 FROM public.pedidos p
        WHERE p.id = pedido_itens.pedido_id AND p.vendedor_id = auth.uid() AND p.status_pedido = 'aguardando_preparacao'
      )
    )
  );

DROP POLICY IF EXISTS "pedido_itens_delete_policy" ON public.pedido_itens;
CREATE POLICY "pedido_itens_delete_policy" ON public.pedido_itens
  FOR DELETE TO authenticated
  USING (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'vendedor'
      AND EXISTS (
        SELECT 1 FROM public.pedidos p
        WHERE p.id = pedido_itens.pedido_id AND p.vendedor_id = auth.uid() AND p.status_pedido = 'aguardando_preparacao'
      )
    )
  );


-- ═══════════════════════════════════════════════════════════════════
-- 7. HABILITAÇÃO E CONFIGURAÇÃO RLS DE ROTAS (delivery_routes e delivery_route_orders)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delivery_routes_all_policy" ON public.delivery_routes;
CREATE POLICY "delivery_routes_all_policy" ON public.delivery_routes
  AS PERMISSIVE TO authenticated
  USING (get_user_role() IN ('admin', 'logistica'))
  WITH CHECK (get_user_role() IN ('admin', 'logistica'));

ALTER TABLE public.delivery_route_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delivery_route_orders_all_policy" ON public.delivery_route_orders;
CREATE POLICY "delivery_route_orders_all_policy" ON public.delivery_route_orders
  AS PERMISSIVE TO authenticated
  USING (get_user_role() IN ('admin', 'logistica'))
  WITH CHECK (get_user_role() IN ('admin', 'logistica'));


-- ═══════════════════════════════════════════════════════════════════
-- 8. REVOLUÇÃO E CONCESSÃO DE GRANTS
-- ═══════════════════════════════════════════════════════════════════
-- Revogações de anon
REVOKE ALL ON public.pedidos FROM anon;
REVOKE ALL ON public.pedido_itens FROM anon;
REVOKE ALL ON public.delivery_routes FROM anon;
REVOKE ALL ON public.delivery_route_orders FROM anon;

-- Revogações de authenticated
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.pedidos FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.pedido_itens FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.delivery_routes FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.delivery_route_orders FROM authenticated;

-- Concessões mínimas e necessárias para authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_routes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_route_orders TO authenticated;

COMMIT;
