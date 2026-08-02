-- ============================================================
-- MIGRATION: fix_auto_log_estoque_movimentacao_on_pedido_finalizado
-- DATA: 2026-08-01
-- PROBLEMA:
--   Ao finalizar um pedido, o estoque fisico (`estoque_atual`) era baixado,
--   mas o historico de movimentacoes (`estoque_movimentacao`) nao era alimentado.
--   Isso fazia com que pedidos finalizados (ex: PV00293, PV00296, PV00258)
--   nao aparecessem na aba "Historico de Movimentacoes" dos produtos.
--
-- CORRECAO:
--   1. Atualizar fn_confirmar_baixa_estoque_pedido para inserir
--      automaticamente registros na tabela `estoque_movimentacao`
--      para cada item do pedido finalizado.
--   2. Garantir retrocompatibilidade e integridade da auditoria de estoque.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_confirmar_baixa_estoque_pedido()
RETURNS TRIGGER AS $$
DECLARE
    v_vendedor_id UUID;
    v_ecommerce_seller_id UUID := 'e0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    v_vendedor_id := COALESCE(NEW.vendedor_id, v_ecommerce_seller_id);

    -- Se o pedido foi FINALIZADO (novo insert finalizado ou transição de status)
    IF (NEW.status_pedido = 'finalizado' AND (TG_OP = 'INSERT' OR OLD.status_pedido != 'finalizado')) THEN
        -- Baixa estoque real e limpa a reserva (com GREATEST para nao ir negativo)
        UPDATE public.produtos p
        SET
            estoque_atual     = estoque_atual - pi.quantidade,
            estoque_reservado = GREATEST(0, COALESCE(estoque_reservado, 0) - pi.quantidade)
        FROM public.pedido_itens pi
        WHERE pi.pedido_id = NEW.id AND pi.produto_id = p.id;

        -- Registrar movimentacao de saida no estoque_movimentacao para cada item do pedido
        INSERT INTO public.estoque_movimentacao (
            produto_id,
            usuario_id,
            tipo_movimento,
            quantidade,
            origem,
            referencia_id,
            observacoes,
            data_movimento
        )
        SELECT
            pi.produto_id,
            v_vendedor_id,
            'saida',
            pi.quantidade,
            'venda',
            NEW.id,
            'Venda originada do pedido ' || COALESCE(NEW.numero_pedido, ''),
            COALESCE(NEW.finalized_at, NEW.updated_at, NOW())
        FROM public.pedido_itens pi
        WHERE pi.pedido_id = NEW.id
        ON CONFLICT DO NOTHING;

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

        -- Atualiza metricas do cliente automaticamente
        IF NEW.cliente_id IS NOT NULL THEN
            UPDATE public.clientes
            SET
                total_compras = (SELECT COUNT(*) FROM public.pedidos WHERE cliente_id = NEW.cliente_id AND status_pedido = 'finalizado'),
                valor_total_gasto = (SELECT COALESCE(SUM(valor_total), 0) FROM public.pedidos WHERE cliente_id = NEW.cliente_id AND status_pedido = 'finalizado'),
                ticket_medio = (SELECT ROUND(COALESCE(AVG(valor_total), 0), 2) FROM public.pedidos WHERE cliente_id = NEW.cliente_id AND status_pedido = 'finalizado'),
                data_ultima_compra = (SELECT MAX(created_at) FROM public.pedidos WHERE cliente_id = NEW.cliente_id AND status_pedido = 'finalizado'),
                dias_sem_comprar = 0,
                status_cliente = CASE
                    WHEN status_cliente IN ('lead', 'inativo') THEN 'cliente'::status_cliente
                    ELSE status_cliente
                END
            WHERE id = NEW.cliente_id;
        END IF;

    -- Se o pedido foi CANCELADO
    ELSIF (NEW.status_pedido = 'cancelado' AND OLD.status_pedido != 'cancelado' AND OLD.status_pedido != 'finalizado') THEN
        UPDATE public.produtos p
        SET estoque_reservado = GREATEST(0, COALESCE(estoque_reservado, 0) - pi.quantidade)
        FROM public.pedido_itens pi
        WHERE pi.pedido_id = NEW.id AND pi.produto_id = p.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_confirmar_baixa_estoque_pedido ON public.pedidos;
CREATE TRIGGER trg_confirmar_baixa_estoque_pedido
AFTER INSERT OR UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_confirmar_baixa_estoque_pedido();
