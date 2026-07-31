-- =============================================================================
-- FIX DEFINITIVO: null value in column "vendedor_id" of relation "vendas"
-- =============================================================================
-- Execute este script completo no SQL Editor do Supabase.
-- =============================================================================

-- PASSO 1: Remove a restrição NOT NULL da coluna vendedor_id na tabela vendas
ALTER TABLE public.vendas ALTER COLUMN vendedor_id DROP NOT NULL;

-- PASSO 2: Cria o usuário auth virtual para a Loja Online (E-commerce)
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_super_admin
)
VALUES (
    'e0000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'loja.online@system.local',
    crypt('SISTEMA_NAO_FAZ_LOGIN_' || gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Loja Online (E-commerce)"}'::jsonb,
    now(),
    now(),
    false
)
ON CONFLICT (id) DO NOTHING;

-- PASSO 3: Cria o perfil de Vendedor Virtual em public.profiles
INSERT INTO public.profiles (
    id,
    nome,
    email,
    role,
    ativo,
    created_at
)
VALUES (
    'e0000000-0000-0000-0000-000000000001'::uuid,
    'Loja Online (E-commerce)',
    'loja.online@system.local',
    'vendedor',
    true,
    now()
)
ON CONFLICT (id) DO UPDATE
SET nome = 'Loja Online (E-commerce)', ativo = true;

-- PASSO 4: Corrige a trigger para usar o Vendedor Virtual quando vendedor_id for NULL
CREATE OR REPLACE FUNCTION public.fn_confirmar_baixa_estoque_pedido()
RETURNS TRIGGER AS $$
DECLARE
    v_vendedor_id UUID;
    v_ecommerce_seller_id UUID := 'e0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    -- Usa o vendedor do pedido; se NULL (pedido de site/embaixador), usa o Vendedor Virtual
    v_vendedor_id := COALESCE(NEW.vendedor_id, v_ecommerce_seller_id);

    -- Se o pedido foi FINALIZADO (Baixa estoque real e limpa reserva)
    IF (NEW.status_pedido = 'finalizado' AND OLD.status_pedido != 'finalizado') THEN
        -- Abate o estoque real e limpa a reserva para todos os itens deste pedido
        UPDATE public.produtos p
        SET
            estoque_atual    = estoque_atual    - pi.quantidade,
            estoque_reservado = estoque_reservado - pi.quantidade
        FROM public.pedido_itens pi
        WHERE pi.pedido_id = NEW.id AND pi.produto_id = p.id;

        -- Gerar registro no histórico de vendas usando o vendedor correto (nunca NULL)
        INSERT INTO public.vendas (
            id, cliente_id, vendedor_id, valor_total,
            forma_pagamento, status_venda, data_venda
        )
        VALUES (
            NEW.id, NEW.cliente_id, v_vendedor_id, NEW.valor_total,
            NEW.forma_pagamento, 'finalizado', now()
        )
        ON CONFLICT (id) DO UPDATE
            SET vendedor_id  = EXCLUDED.vendedor_id,
                status_venda = EXCLUDED.status_venda;

        -- Copiar itens de pedidos para itens de vendas
        INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
        SELECT pi.pedido_id, pi.produto_id, pi.quantidade, pi.preco_unitario, pi.subtotal
        FROM public.pedido_itens pi
        WHERE pi.pedido_id = NEW.id
        ON CONFLICT DO NOTHING;

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

-- Confirma que o trigger existe (idempotente)
DROP TRIGGER IF EXISTS trg_confirmar_baixa_estoque_pedido ON public.pedidos;
CREATE TRIGGER trg_confirmar_baixa_estoque_pedido
AFTER UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_confirmar_baixa_estoque_pedido();
