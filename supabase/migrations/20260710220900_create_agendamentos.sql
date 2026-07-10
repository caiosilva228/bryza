-- Criação do enum para Status do Agendamento (se ainda não existir)
DO $$ BEGIN
    CREATE TYPE status_agendamento AS ENUM ('agendado', 'convertido', 'cancelado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela principal de agendamentos
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data_agendamento TIMESTAMP WITH TIME ZONE NOT NULL,
    status status_agendamento DEFAULT 'agendado' NOT NULL,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    valor_total DECIMAL(10, 2) NOT NULL,
    desconto_tipo VARCHAR(20) DEFAULT 'none',
    desconto_valor DECIMAL(10, 2) DEFAULT 0,
    desconto_aplicado DECIMAL(10, 2) DEFAULT 0,
    forma_pagamento VARCHAR(50) NOT NULL,
    observacoes TEXT,
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
    
    -- Campos desnormalizados
    nome_cliente VARCHAR(255),
    telefone_cliente VARCHAR(50),
    endereco_entrega TEXT,
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(20),
    nome_vendedor VARCHAR(255),
    codigo_vendedor INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de itens do agendamento
CREATE TABLE IF NOT EXISTS public.agendamento_itens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
    quantidade DECIMAL(10, 3) NOT NULL,
    preco_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    desconto_tipo VARCHAR(20) DEFAULT 'none',
    desconto_valor DECIMAL(10, 2) DEFAULT 0,
    desconto_aplicado DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamento_itens ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir leitura para todos os usuários autenticados"
ON public.agendamentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir inserção para todos os usuários autenticados"
ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir atualização para todos os usuários autenticados"
ON public.agendamentos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Permitir deleção para todos os usuários autenticados"
ON public.agendamentos FOR DELETE TO authenticated USING (true);

CREATE POLICY "Permitir leitura para itens de todos os usuários autenticados"
ON public.agendamento_itens FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir inserção para itens de todos os usuários autenticados"
ON public.agendamento_itens FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir atualização para itens de todos os usuários autenticados"
ON public.agendamento_itens FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Permitir deleção para itens de todos os usuários autenticados"
ON public.agendamento_itens FOR DELETE TO authenticated USING (true);
