-- Enum Nivel Comissão
CREATE TYPE nivel_comissao AS ENUM ('Bronze', 'Prata', 'Ouro');

-- Atualização da tabela profiles
ALTER TABLE profiles
ADD COLUMN cpf TEXT,
ADD COLUMN data_nascimento DATE,
ADD COLUMN endereco TEXT,
ADD COLUMN bairro TEXT,
ADD COLUMN cidade TEXT,
ADD COLUMN estado TEXT,
ADD COLUMN regiao_atuacao TEXT,
ADD COLUMN data_entrada DATE,
ADD COLUMN observacoes TEXT,
ADD COLUMN nivel_comissao nivel_comissao DEFAULT 'Bronze',
ADD COLUMN percentual_comissao NUMERIC(5,2) DEFAULT 8.00,
ADD COLUMN meta_diaria INTEGER DEFAULT 0,
ADD COLUMN meta_semanal INTEGER DEFAULT 0,
ADD COLUMN meta_mensal INTEGER DEFAULT 0;

-- Função para listar vendedores com métricas agregadas (vendas do dia, semana, mês e comissão)
CREATE OR REPLACE FUNCTION get_vendedores_com_metricas()
RETURNS TABLE (
    id UUID,
    nome TEXT,
    email TEXT,
    telefone TEXT,
    role app_role,
    ativo BOOLEAN,
    created_at TIMESTAMPTZ,
    cpf TEXT,
    data_nascimento DATE,
    endereco TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    regiao_atuacao TEXT,
    data_entrada DATE,
    observacoes TEXT,
    nivel_comissao nivel_comissao,
    percentual_comissao NUMERIC,
    meta_diaria INTEGER,
    meta_semanal INTEGER,
    meta_mensal INTEGER,
    vendas_dia BIGINT,
    vendas_semana BIGINT,
    vendas_mes BIGINT,
    comissao_acumulada NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.telefone,
    p.role,
    p.ativo,
    p.created_at,
    p.cpf,
    p.data_nascimento,
    p.endereco,
    p.bairro,
    p.cidade,
    p.estado,
    p.regiao_atuacao,
    p.data_entrada,
    p.observacoes,
    p.nivel_comissao,
    p.percentual_comissao,
    p.meta_diaria,
    p.meta_semanal,
    p.meta_mensal,
    COUNT(v_dia.id) AS vendas_dia,
    COUNT(v_semana.id) AS vendas_semana,
    COUNT(v_mes.id) AS vendas_mes,
    COALESCE(SUM(v_mes.valor_total) * (p.percentual_comissao / 100.0), 0) AS comissao_acumulada
  FROM profiles p
  LEFT JOIN vendas v_mes ON v_mes.vendedor_id = p.id AND v_mes.data_venda >= date_trunc('month', CURRENT_DATE) AND v_mes.status_venda IN ('pago', 'finalizado')
  LEFT JOIN vendas v_semana ON v_semana.id = v_mes.id AND v_semana.data_venda >= date_trunc('week', CURRENT_DATE)
  LEFT JOIN vendas v_dia ON v_dia.id = v_semana.id AND v_dia.data_venda >= CURRENT_DATE
  WHERE p.role = 'vendedor'
  GROUP BY p.id;
$$;
