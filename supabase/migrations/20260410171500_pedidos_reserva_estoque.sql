-- Sequence para numeração de pedidos formatada (PV00001)
CREATE SEQUENCE IF NOT EXISTS pedidos_numero_seq START 1;

-- Tabela de Pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_pedido TEXT UNIQUE DEFAULT ('PV' || LPAD(nextval('pedidos_numero_seq')::TEXT, 5, '0')),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    vendedor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    valor_total NUMERIC(10,2) DEFAULT 0,
    forma_pagamento TEXT CHECK (forma_pagamento IN ('dinheiro', 'pix', 'cartao')),
    status_pedido TEXT DEFAULT 'aguardando_preparacao' CHECK (status_pedido IN ('aguardando_preparacao', 'pronto_para_entrega', 'em_rota', 'entregue', 'finalizado', 'cancelado')),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Itens de Pedido
CREATE TABLE IF NOT EXISTS public.pedido_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
    quantidade INTEGER NOT NULL,
    preco_unitario NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar coluna de Reserva na tabela de Produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS estoque_reservado INTEGER DEFAULT 0;

-- Função para atualizar a reserva de estoque
CREATE OR REPLACE FUNCTION public.fn_gerenciar_reserva_estoque()
RETURNS TRIGGER AS $$
BEGIN
    -- Se for INSERT em pedido_itens
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.produtos 
        SET estoque_reservado = estoque_reservado + NEW.quantidade
        WHERE id = NEW.produto_id;
        RETURN NEW;
    
    -- Se for DELETE em pedido_itens
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.produtos 
        SET estoque_reservado = estoque_reservado - OLD.quantidade
        WHERE id = OLD.produto_id;
        RETURN OLD;

    -- Se for UPDATE em pedido_itens (ajuste de quantidade)
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE public.produtos 
        SET estoque_reservado = estoque_reservado - OLD.quantidade + NEW.quantidade
        WHERE id = NEW.produto_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para itens de pedido
CREATE TRIGGER trg_gerenciar_reserva_estoque
AFTER INSERT OR UPDATE OR DELETE ON public.pedido_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_gerenciar_reserva_estoque();

-- Função para finalizar ou cancelar o pedido (Baixa de reserva e estoque real)
CREATE OR REPLACE FUNCTION public.fn_confirmar_baixa_estoque_pedido()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o pedido foi FINALIZADO (Baixa estoque real e limpa reserva)
    IF (NEW.status_pedido = 'finalizado' AND OLD.status_pedido != 'finalizado') THEN
        -- Abate o estoque real e limpa a reserva para todos os itens deste pedido
        UPDATE public.produtos p
        SET 
            estoque_atual = estoque_atual - pi.quantidade,
            estoque_reservado = estoque_reservado - pi.quantidade
        FROM public.pedido_itens pi
        WHERE pi.pedido_id = NEW.id AND pi.produto_id = p.id;
        
        -- Gerar registro automático no histórico de vendas (vendas e venda_itens)
        -- Inserção na tabela de vendas
        INSERT INTO public.vendas (id, cliente_id, vendedor_id, valor_total, forma_pagamento, status_venda, data_venda)
        VALUES (NEW.id, NEW.cliente_id, NEW.vendedor_id, NEW.valor_total, NEW.forma_pagamento, 'finalizado', now());

        -- Copiar itens de pedidos para itens de vendas
        INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
        SELECT pi.pedido_id, pi.produto_id, pi.quantidade, pi.preco_unitario, pi.subtotal
        FROM public.pedido_itens pi
        WHERE pi.pedido_id = NEW.id;

    -- Se o pedido foi CANCELADO (Libera apenas a reserva)
    ELSIF (NEW.status_pedido = 'cancelado' AND OLD.status_pedido != 'cancelado' AND OLD.status_pedido != 'finalizado') THEN
        UPDATE public.produtos p
        SET estoque_reservado = estoque_reservado - pi.quantidade
        FROM public.pedido_itens pi
        WHERE pi.pedido_id = NEW.id AND pi.produto_id = p.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para controle final do pedido
CREATE TRIGGER trg_confirmar_baixa_estoque_pedido
AFTER UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_confirmar_baixa_estoque_pedido();

-- Job para cancelar pedidos com mais de 3 dias (pg_cron)
-- O comando ideal é: SELECT cron.schedule('cancelar-pedidos-antigos', '0 0 * * *', $$ UPDATE public.pedidos SET status_pedido = 'cancelado' WHERE status_pedido NOT IN ('finalizado', 'cancelado') AND created_at < NOW() - INTERVAL '3 days' $$);
-- Como o cron.schedule precisa ser executado separadamente se houver permissão.
