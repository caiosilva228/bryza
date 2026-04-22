-- Role Enum
CREATE TYPE app_role AS ENUM ('admin', 'vendedor', 'logistica');

-- StatusCliente Enum
CREATE TYPE status_cliente AS ENUM ('lead', 'cliente', 'recorrente', 'inativo');

-- TipoMovimento Enum
CREATE TYPE tipo_movimento AS ENUM ('entrada', 'saida', 'ajuste');

-- OrigemMovimento Enum
CREATE TYPE origem_movimento AS ENUM ('producao', 'venda', 'perda', 'ajuste_manual');

-- StatusVenda Enum
CREATE TYPE status_venda AS ENUM ('pendente', 'pago', 'em_entrega', 'finalizado', 'cancelado');

-- StatusEntrega Enum
CREATE TYPE status_entrega AS ENUM ('aguardando', 'separado', 'em_rota', 'entregue', 'nao_entregue');

-- EtapaFunil Enum
CREATE TYPE etapa_funil AS ENUM ('amostra_entregue', 'entrou_whatsapp', 'testando', 'contato_dia_3', 'comprou', 'recorrente');

-- TipoMeta Enum
CREATE TYPE tipo_meta AS ENUM ('faturamento', 'vendas', 'clientes', 'conversao', 'entregas');

-- PROFILES
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  role app_role NOT NULL DEFAULT 'vendedor',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CLIENTES
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  endereco TEXT NOT NULL,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  origem TEXT NOT NULL,
  status_cliente status_cliente NOT NULL DEFAULT 'lead',
  data_cadastro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vendedor_responsavel_id UUID REFERENCES profiles(id),
  observacoes TEXT,
  -- Métricas (serão atualizadas via trigger/rotina)
  total_compras INTEGER DEFAULT 0,
  valor_total_gasto NUMERIC(10,2) DEFAULT 0,
  ticket_medio NUMERIC(10,2) DEFAULT 0,
  data_ultima_compra TIMESTAMPTZ,
  dias_sem_comprar INTEGER DEFAULT 0
);

-- PRODUTOS
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_produto TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidade TEXT NOT NULL,
  custo_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_venda NUMERIC(10,2) NOT NULL DEFAULT 0,
  estoque_atual INTEGER NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- VENDAS
CREATE TABLE vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) NOT NULL,
  vendedor_id UUID REFERENCES profiles(id) NOT NULL,
  data_venda TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  forma_pagamento TEXT NOT NULL,
  status_venda status_venda NOT NULL DEFAULT 'pendente',
  observacoes TEXT
);

-- VENDA ITENS
CREATE TABLE venda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE NOT NULL,
  produto_id UUID REFERENCES produtos(id) NOT NULL,
  quantidade INTEGER NOT NULL,
  preco_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL
);

-- ESTOQUE MOVIMENTAÇÃO
CREATE TABLE estoque_movimentacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES produtos(id) NOT NULL,
  tipo_movimento tipo_movimento NOT NULL,
  quantidade INTEGER NOT NULL,
  origem origem_movimento NOT NULL,
  referencia_id UUID, -- id da venda ou ordem de producao (opcional)
  data_movimento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacoes TEXT
);

-- ENTREGAS
CREATE TABLE entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID REFERENCES vendas(id) NOT NULL,
  cliente_id UUID REFERENCES clientes(id) NOT NULL,
  numero_pedido TEXT NOT NULL,
  endereco_entrega TEXT NOT NULL,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  status_entrega status_entrega NOT NULL DEFAULT 'aguardando',
  responsavel_logistica_id UUID REFERENCES profiles(id),
  data_saida TIMESTAMPTZ,
  data_entrega TIMESTAMPTZ,
  rota TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FUNIL LEAD
CREATE TABLE funil_leads (
  cliente_id UUID REFERENCES clientes(id) PRIMARY KEY,
  etapa etapa_funil NOT NULL DEFAULT 'amostra_entregue',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- METAS
CREATE TABLE metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_meta tipo_meta NOT NULL,
  valor_meta NUMERIC(10,2) NOT NULL,
  periodo TEXT NOT NULL, -- e.g. '2026-04'
  usuario_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE funil_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas ENABLE ROW LEVEL SECURITY;

-- Helper Function to check role 
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS app_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Admin tem acesso total" ON profiles FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Vendedor/Logistica podem ver perfis ativos" ON profiles FOR SELECT TO authenticated USING (ativo = TRUE);

-- Clientes Policies
CREATE POLICY "Admin acesso total clientes" ON clientes FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Vendedor vê apenas seus clientes" ON clientes FOR ALL TO authenticated 
USING (public.get_user_role() = 'vendedor' AND vendedor_responsavel_id = auth.uid());
CREATE POLICY "Logística vê apenas leitura de clientes" ON clientes FOR SELECT TO authenticated 
USING (public.get_user_role() = 'logistica');

-- Produtos Policies
CREATE POLICY "Admin acesso total produtos" ON produtos FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Leitura geral produtos" ON produtos FOR SELECT TO authenticated USING (ativo = TRUE);

-- Vendas Policies
CREATE POLICY "Admin total vendas" ON vendas FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Vendedor ve/edita suas vendas" ON vendas FOR ALL TO authenticated 
USING (public.get_user_role() = 'vendedor' AND vendedor_id = auth.uid());
CREATE POLICY "Logística precisa ler vendas (opcional, para cruzar dados)" ON vendas FOR SELECT TO authenticated 
USING (public.get_user_role() = 'logistica');

-- Venda Itens Policies
CREATE POLICY "Admin total venda_itens" ON venda_itens FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Vendedor ve/edita itens de suas vendas" ON venda_itens FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM vendas WHERE vendas.id = venda_itens.venda_id AND vendas.vendedor_id = auth.uid())
);
CREATE POLICY "Logística le itens" ON venda_itens FOR SELECT TO authenticated USING (public.get_user_role() = 'logistica');

-- Estoque Movimentacao Policies
CREATE POLICY "Admin total estoque_movimentacao" ON estoque_movimentacao FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Leitura de estoque por logistica/vendas" ON estoque_movimentacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inserção automática permite authenticated" ON estoque_movimentacao FOR INSERT TO authenticated WITH CHECK (origem IN ('venda', 'ajuste_manual'));

-- Entregas Policies
CREATE POLICY "Admin total entregas" ON entregas FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Logistica pode ver/verificar entregas delegadas" ON entregas FOR ALL TO authenticated 
USING (public.get_user_role() = 'logistica');
CREATE POLICY "Vendedor ve entregas das suas vendas" ON entregas FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM vendas WHERE vendas.id = entregas.venda_id AND vendas.vendedor_id = auth.uid())
);

-- TRIGGERS / BUSINESS RULES

-- 1. Ao atualizar vendas para "pago", baixar estoque
CREATE OR REPLACE FUNCTION processar_estoque_venda_paga()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Se mudou de pendente para pago
  IF NEW.status_venda = 'pago' AND OLD.status_venda != 'pago' THEN
    -- Para cada item da venda
    FOR v_item IN (SELECT produto_id, quantidade FROM venda_itens WHERE venda_id = NEW.id) LOOP
      -- Inserir movimentacao de saida
      INSERT INTO estoque_movimentacao (produto_id, tipo_movimento, quantidade, origem, referencia_id, observacoes)
      VALUES (v_item.produto_id, 'saida', v_item.quantidade, 'venda', NEW.id, 'Venda paga gerou saida automática');
      
      -- Atualizar estoque do produto
      UPDATE produtos SET estoque_atual = estoque_atual - v_item.quantidade WHERE id = v_item.produto_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_processar_estoque
AFTER UPDATE OF status_venda ON vendas
FOR EACH ROW EXECUTE FUNCTION processar_estoque_venda_paga();


-- 2. Ao mudar venda para 'em_entrega', gerar entrada em entregas (se não existir)
CREATE OR REPLACE FUNCTION gerar_entrega_apos_venda()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_venda = 'em_entrega' AND OLD.status_venda != 'em_entrega' THEN
    INSERT INTO entregas (venda_id, cliente_id, numero_pedido, endereco_entrega, bairro, cidade, estado, status_entrega)
    SELECT 
      NEW.id,
      NEW.cliente_id,
      substring(NEW.id::text, 1, 8),
      c.endereco,
      c.bairro,
      c.cidade,
      c.estado,
      'aguardando'
    FROM clientes c
    WHERE c.id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_gerar_entrega
AFTER UPDATE OF status_venda ON vendas
FOR EACH ROW EXECUTE FUNCTION gerar_entrega_apos_venda();

-- 3. Atualizar metricas do cliente ao mudar compra para finalizada
CREATE OR REPLACE FUNCTION atualizar_metricas_cliente()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_entrega = 'entregue' AND OLD.status_entrega != 'entregue' THEN
    -- Mudar venda para finalizado
    UPDATE vendas SET status_venda = 'finalizado' WHERE id = NEW.venda_id;
    
    -- Atualizar cliente (total compras, gasto, etc)
    UPDATE clientes SET 
      total_compras = total_compras + 1,
      valor_total_gasto = valor_total_gasto + (SELECT valor_total FROM vendas WHERE id = NEW.venda_id),
      data_ultima_compra = NOW()
    WHERE id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_atualizar_metricas
AFTER UPDATE OF status_entrega ON entregas
FOR EACH ROW EXECUTE FUNCTION atualizar_metricas_cliente();
