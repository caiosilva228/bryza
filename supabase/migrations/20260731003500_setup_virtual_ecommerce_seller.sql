-- -----------------------------------------------------------------------------
-- Migration: 20260731003500_setup_virtual_ecommerce_seller.sql
-- Implementação da Solução 2: Vendedor Virtual / Conta de Sistema ("Loja Online")
-- -----------------------------------------------------------------------------

-- 1. Garante que a conta de usuário auth para a Loja Virtual existe
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
    updated_at
)
VALUES (
    'e0000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'loja.online@system.local',
    '$2a$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Loja Online (E-commerce)"}',
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Garante o perfil de Vendedor Virtual em public.profiles
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

-- 3. Atualiza os registros legados sem vendedor em pedidos e vendas
UPDATE public.pedidos
SET vendedor_id = 'e0000000-0000-0000-0000-000000000001'::uuid
WHERE vendedor_id IS NULL;

UPDATE public.vendas
SET vendedor_id = 'e0000000-0000-0000-0000-000000000001'::uuid
WHERE vendedor_id IS NULL;

-- 4. Atualiza a trigger de confirmação/finalização de pedido
-- Se o vendedor_id do pedido estiver nulo, atribui automaticamente o Vendedor Virtual
CREATE OR REPLACE FUNCTION public.fn_confirmar_baixa_estoque_pedido()
RETURNS TRIGGER AS $$
DECLARE
    v_vendedor_id UUID;
BEGIN
    -- Se vendedor_id for NULL (ex.: pedido de e-commerce/embaixador sem vendedor interno),
    -- atribui ao Vendedor Virtual "Loja Online (E-commerce)"
    v_vendedor_id := COALESCE(NEW.vendedor_id, 'e0000000-0000-0000-0000-000000000001'::uuid);

    -- Se o vendedor_id original no pedido era nulo, atualiza na tabela de pedidos
    IF NEW.vendedor_id IS NULL THEN
        UPDATE public.pedidos 
        SET vendedor_id = v_vendedor_id 
        WHERE id = NEW.id;
        NEW.vendedor_id := v_vendedor_id;
    END IF;

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
        INSERT INTO public.vendas (id, cliente_id, vendedor_id, valor_total, forma_pagamento, status_venda, data_venda)
        VALUES (NEW.id, NEW.cliente_id, v_vendedor_id, NEW.valor_total, NEW.forma_pagamento, 'finalizado', now())
        ON CONFLICT (id) DO UPDATE SET
            vendedor_id = EXCLUDED.vendedor_id,
            status_venda = EXCLUDED.status_venda;

        -- Copiar itens de pedidos para itens de vendas
        INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
        SELECT pi.pedido_id, pi.produto_id, pi.quantidade, pi.preco_unitario, pi.subtotal
        FROM public.pedido_itens pi
        WHERE pi.pedido_id = NEW.id
        ON CONFLICT (id) DO NOTHING;

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
