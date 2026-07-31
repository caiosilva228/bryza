-- Permite vendedor_id NULL na tabela vendas para pedidos vindos do site / embaixadores
ALTER TABLE public.vendas ALTER COLUMN vendedor_id DROP NOT NULL;
