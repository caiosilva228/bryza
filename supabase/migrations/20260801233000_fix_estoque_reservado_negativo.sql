-- ============================================================
-- MIGRATION: fix_estoque_reservado_negativo
-- DATA: 2026-08-01
-- PROBLEMA:
--   O campo estoque_reservado ficou negativo em alguns produtos
--   porque fn_confirmar_baixa_estoque_pedido subtraia sem
--   protecao GREATEST(0, ...). Alem disso, itens com subtotal=0
--   nao geravam reserva pelo trigger fn_gerenciar_reserva_estoque
--   (que usava GREATEST), mas a baixa final sempre subtraia.
--
-- CORRECOES:
--   1. Corrigir fn_confirmar_baixa_estoque_pedido para usar
--      GREATEST(0, ...) ao abater estoque_reservado
--   2. Recalcular e corrigir todos os estoque_reservado desincronizados
-- ============================================================

-- ---------------------------------------------------------------
-- CORRECAO 1: Proteger fn_confirmar_baixa_estoque_pedido
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_confirmar_baixa_estoque_pedido()
RETURNS TRIGGER AS $$
DECLARE
    v_vendedor_id UUID;
    v_ecommerce_seller_id UUID := 'e0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    -- Usa o vendedor do pedido; se NULL (pedido de site/embaixador), usa o Vendedor Virtual
    v_vendedor_id := COALESCE(NEW.vendedor_id, v_ecommerce_seller_id);

    -- Se o pedido foi FINALIZADO
    IF (NEW.status_pedido = 'finalizado' AND OLD.status_pedido != 'finalizado') THEN
        -- Baixa estoque real e limpa a reserva (com GREATEST para nao ir negativo)
        UPDATE public.produtos p
        SET
            estoque_atual     = estoque_atual - pi.quantidade,
            estoque_reservado = GREATEST(0, COALESCE(estoque_reservado, 0) - pi.quantidade)
        FROM public.pedido_itens pi
        WHERE pi.pedido_id = NEW.id AND pi.produto_id = p.id;

        -- Insere na tabela de vendas usando v_vendedor_id (nunca NULL)
        INSERT INTO public.vendas (id, cliente_id, vendedor_id, valor_total, forma_pagamento, status_venda, data_venda)
        VALUES (NEW.id, NEW.cliente_id, v_vendedor_id, NEW.valor_total, NEW.forma_pagamento, 'finalizado', now())
        ON CONFLICT (id) DO UPDATE
            SET vendedor_id  = EXCLUDED.vendedor_id,
                status_venda = EXCLUDED.status_venda;

        -- Copia itens do pedido para venda_itens
        INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
        SELECT pi.pedido_id, pi.produto_id, pi.quantidade, pi.preco_unitario, pi.subtotal
        FROM public.pedido_itens pi
        WHERE pi.pedido_id = NEW.id
        ON CONFLICT DO NOTHING;

    -- Se o pedido foi CANCELADO
    ELSIF (NEW.status_pedido = 'cancelado' AND OLD.status_pedido != 'cancelado' AND OLD.status_pedido != 'finalizado') THEN
        -- Libera reserva (com GREATEST para nao ir negativo)
        UPDATE public.produtos p
        SET estoque_reservado = GREATEST(0, COALESCE(estoque_reservado, 0) - pi.quantidade)
        FROM public.pedido_itens pi
        WHERE pi.pedido_id = NEW.id AND pi.produto_id = p.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------
-- CORRECAO 2: Recalcular estoque_reservado para todos os produtos
-- Reserva correta = SUM das quantidades em pedidos ATIVOS
-- (nao finalizado e nao cancelado)
-- ---------------------------------------------------------------
WITH reserva_correta AS (
    SELECT
        pi.produto_id,
        COALESCE(SUM(pi.quantidade), 0) AS reserva_real
    FROM public.pedido_itens pi
    JOIN public.pedidos p ON p.id = pi.pedido_id
    WHERE p.status_pedido NOT IN ('finalizado', 'cancelado')
    GROUP BY pi.produto_id
),
produtos_fora_de_sync AS (
    SELECT
        pr.id,
        pr.nome_produto,
        pr.estoque_reservado AS reserva_atual,
        COALESCE(rc.reserva_real, 0) AS reserva_correta
    FROM public.produtos pr
    LEFT JOIN reserva_correta rc ON rc.produto_id = pr.id
    WHERE pr.estoque_reservado != COALESCE(rc.reserva_real, 0)
)
UPDATE public.produtos p
SET estoque_reservado = pfs.reserva_correta
FROM produtos_fora_de_sync pfs
WHERE p.id = pfs.id;

-- ---------------------------------------------------------------
-- VERIFICACAO FINAL: Confirmar que nao ha mais reservas negativas
-- ---------------------------------------------------------------
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.produtos
    WHERE estoque_reservado < 0;

    IF v_count > 0 THEN
        RAISE WARNING 'ATENCAO: Ainda existem % produto(s) com estoque_reservado negativo apos a correcao!', v_count;
    ELSE
        RAISE NOTICE 'OK: Nenhum produto com estoque_reservado negativo. Correcao aplicada com sucesso.';
    END IF;
END;
$$;
