ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS desconto_tipo TEXT NOT NULL DEFAULT 'none'
CHECK (desconto_tipo IN ('none', 'percent', 'fixed'));

ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS desconto_valor NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS desconto_aplicado NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.pedido_itens
ADD COLUMN IF NOT EXISTS desconto_tipo TEXT NOT NULL DEFAULT 'none'
CHECK (desconto_tipo IN ('none', 'percent', 'fixed'));

ALTER TABLE public.pedido_itens
ADD COLUMN IF NOT EXISTS desconto_valor NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.pedido_itens
ADD COLUMN IF NOT EXISTS desconto_aplicado NUMERIC(10,2) NOT NULL DEFAULT 0;
