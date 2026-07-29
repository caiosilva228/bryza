-- Migration: fix_null_commissionable_amount_guard
-- Problema: fn_gerar_comissoes_multinivel era chamada mesmo quando
-- commissionable_amount_snapshot era NULL, causando violação de NOT NULL
-- na tabela commissions ao confirmar pagamento de pedidos sem embaixador/plano de comissão.
-- Solução: adicionar guarda explícita contra commissionable_amount_snapshot IS NULL
-- nas funções fn_gerar_comissoes_multinivel e fn_trg_sync_commission_status.

-- ─── 1. Corrige fn_gerar_comissoes_multinivel ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_gerar_comissoes_multinivel(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_order public.pedidos%ROWTYPE;
  v_direct public.ambassadors%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_node record;
  v_amount numeric(12,2);
  v_status text;
  v_count integer := 0;
  v_rows integer := 0;
BEGIN
  SELECT * INTO v_order FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;

  -- Sai cedo se não tiver embaixador, plano ou valor comissionável definido
  IF v_order.id IS NULL
     OR v_order.ambassador_id IS NULL
     OR v_order.commission_plan_id_snapshot IS NULL
     OR v_order.commissionable_amount_snapshot IS NULL THEN
    RETURN jsonb_build_object('sucesso', true, 'criadas', 0);
  END IF;

  SELECT * INTO v_direct FROM public.ambassadors WHERE id = v_order.ambassador_id;
  SELECT * INTO v_customer FROM public.clientes WHERE id = v_order.cliente_id;

  IF v_direct.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', true, 'criadas', 0);
  END IF;

  -- Bloqueia auto-indicação
  IF v_customer.own_ambassador_id = v_direct.id
     OR (v_customer.cpf IS NOT NULL AND v_customer.cpf = v_direct.cpf)
     OR (
       regexp_replace(coalesce(v_customer.telefone, ''), '[^0-9]', '', 'g') <> ''
       AND regexp_replace(coalesce(v_customer.telefone, ''), '[^0-9]', '', 'g')
         = regexp_replace(coalesce(v_direct.phone, ''), '[^0-9]', '', 'g')
     ) THEN
    RETURN jsonb_build_object(
      'sucesso', true, 'criadas', 0, 'motivo', 'autoindicacao_bloqueada'
    );
  END IF;

  v_status := CASE
    WHEN v_order.status_pedido = 'cancelado' THEN 'cancelada'
    WHEN v_order.payment_status = 'aprovado'
      OR v_order.payment_check_status = 'confirmado' THEN 'liberada'
    WHEN v_order.status_pedido IN ('entregue', 'finalizado')
      THEN 'aguardando_pagamento'
    ELSE 'aguardando_entrega'
  END;

  FOR v_node IN
    WITH RECURSIVE chain AS (
      SELECT a.id, a.parent_ambassador_id, a.status, 1::integer level_number,
        ARRAY[a.id]::uuid[] path
      FROM public.ambassadors a WHERE a.id = v_order.ambassador_id
      UNION ALL
      SELECT parent.id, parent.parent_ambassador_id, parent.status,
        chain.level_number + 1, chain.path || parent.id
      FROM chain
      JOIN public.ambassadors parent ON parent.id = chain.parent_ambassador_id
      WHERE chain.level_number < 10 AND NOT parent.id = ANY(chain.path)
    )
    SELECT chain.id ambassador_id, chain.status, levels.level_number,
      levels.percentage
    FROM chain
    JOIN public.commission_plan_levels levels
      ON levels.commission_plan_id = v_order.commission_plan_id_snapshot
     AND levels.level_number = chain.level_number
     AND levels.enabled
    ORDER BY levels.level_number
  LOOP
    IF v_node.percentage > 0 AND v_node.status = 'ativo' THEN
      v_amount := round(
        v_order.commissionable_amount_snapshot * v_node.percentage / 100.0, 2
      );
      INSERT INTO public.commissions (
        ambassador_id, order_id, customer_id, commission_plan_id,
        commission_level, commissionable_amount, order_amount_snapshot,
        percentage_snapshot, commission_amount, commission_type, status,
        available_at, cancelled_at
      ) VALUES (
        v_node.ambassador_id, v_order.id, v_order.cliente_id,
        v_order.commission_plan_id_snapshot, v_node.level_number,
        v_order.commissionable_amount_snapshot, v_order.valor_total,
        v_node.percentage, v_amount, 'network_percentage', v_status,
        CASE WHEN v_status = 'liberada' THEN now() END,
        CASE WHEN v_status = 'cancelada' THEN now() END
      )
      ON CONFLICT (order_id, ambassador_id, commission_level, commission_type)
      DO NOTHING;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_count := v_count + v_rows;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('sucesso', true, 'criadas', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_gerar_comissoes_multinivel(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_gerar_comissoes_multinivel(uuid)
  TO service_role;

-- ─── 2. Corrige fn_trg_sync_commission_status ─────────────────────────────────
-- Garante que o sync de status só tenta liberar comissões se já existirem
-- registros na tabela commissions (criados em ordens que de fato têm embaixador
-- e commissionable_amount_snapshot preenchidos).
CREATE OR REPLACE FUNCTION public.fn_trg_sync_commission_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status_pedido = 'cancelado' THEN
    UPDATE public.commissions
    SET status = 'cancelada', cancelled_at = coalesce(cancelled_at, now())
    WHERE order_id = NEW.id
      AND status IN ('aguardando_entrega', 'aguardando_pagamento', 'liberada');
  ELSIF NEW.payment_status IN ('reembolsado', 'chargeback') THEN
    UPDATE public.commissions
    SET status = 'estornada', reversed_at = coalesce(reversed_at, now())
    WHERE order_id = NEW.id AND status <> 'estornada';
  ELSIF NEW.payment_status = 'aprovado'
     OR NEW.payment_check_status = 'confirmado' THEN
    -- Só tenta liberar comissões existentes; não cria novas aqui.
    UPDATE public.commissions
    SET status = 'liberada', available_at = coalesce(available_at, now())
    WHERE order_id = NEW.id
      AND status IN ('aguardando_entrega', 'aguardando_pagamento');
  ELSIF NEW.status_pedido IN ('entregue', 'finalizado') THEN
    UPDATE public.commissions SET status = 'aguardando_pagamento'
    WHERE order_id = NEW.id AND status = 'aguardando_entrega';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_trg_sync_commission_status()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_commission_status ON public.pedidos;
CREATE TRIGGER trg_sync_commission_status
AFTER UPDATE OF status_pedido, payment_check_status, payment_status
ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_sync_commission_status();
