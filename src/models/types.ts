export type Role = 'admin' | 'vendedor' | 'logistica';
export type StatusCliente = 'lead' | 'cliente' | 'recorrente' | 'inativo';
export type TipoMovimento = 'entrada' | 'saida' | 'ajuste';
export type StatusAgendamento = 'agendado' | 'convertido' | 'cancelado';
export type OrigemMovimento = 'producao' | 'venda' | 'perda' | 'ajuste_manual';
export type StatusVenda = 'pendente' | 'pago' | 'em_entrega' | 'finalizado' | 'cancelado';
export type StatusEntrega = 'aguardando' | 'separado' | 'em_rota' | 'entregue' | 'nao_entregue';
export type EtapaFunil = 'amostra_entregue' | 'entrou_whatsapp' | 'testando' | 'contato_dia_3' | 'comprou' | 'recorrente';
export type StatusPedido = 'aguardando_preparacao' | 'pronto_para_entrega' | 'em_rota' | 'entregue' | 'finalizado' | 'cancelado';
export type TipoMeta = 'faturamento' | 'vendas' | 'clientes' | 'conversao' | 'entregas';

// ── Logística ─────────────────────────────────────────────────────────────────
export type DeliveryProblemType =
  | 'cliente_nao_estava'
  | 'endereco_errado'
  | 'cliente_recusou'
  | 'sem_dinheiro'
  | 'pediu_reagendamento'
  | 'produto_avariado'
  | 'outro';

export type PaymentCheckStatus = 'pendente' | 'confirmado' | 'divergente';

export type DeliveryNextAction = 'keep' | 'back_to_ready' | 'cancel';

export type RouteStatus =
  | 'Planejada'
  | 'Separando Produtos'
  | 'Pronta para Sair'
  | 'Em Andamento'
  | 'Finalizada'
  | 'Finalizada com Pendências'
  | 'Cancelada';

export type RouteOrderStatus =
  | 'Pendente'
  | 'Em Rota'
  | 'Entregue'
  | 'Não Entregue'
  | 'Cancelado';

export interface DeliveryRoute {
  id: string;
  name: string;
  date: string;
  status: RouteStatus;
  driver_id?: string | null;
  driver_name?: string | null;
  city?: string | null;
  neighborhoods?: string[] | null;
  departure_time?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  
  // Agregados calculados no front/queries
  totalOrders?: number;
  totalAmount?: number;
  totalDelivered?: number;
  totalPending?: number;
  totalProblems?: number;
}

export interface RouteOrder {
  id: string;
  route_id: string;
  order_id: string;
  sequence: number;
  status: RouteOrderStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Join com o pedido
  pedido?: Pedido;
}

export type NivelComissao = 'Bronze' | 'Prata' | 'Ouro';
export type TipoDesconto = 'none' | 'percent' | 'fixed';

export interface Profile {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  role: Role;
  ativo: boolean;
  created_at: string;
  
  codigo_vendedor?: number | null;
  // Dados operacionais e pessoais (Vendedor)
  cpf?: string | null;
  data_nascimento?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  regiao_atuacao?: string | null;
  data_entrada?: string | null;
  observacoes?: string | null;
  
  // Dados comerciais (Vendedor)
  nivel_comissao?: NivelComissao;
  percentual_comissao?: number;
  meta_diaria?: number;
  meta_semanal?: number;
  meta_mensal?: number;
}

export interface VendedorMetricas extends Profile {
  vendas_dia: number;
  vendas_semana: number;
  vendas_mes: number;
  comissao_acumulada: number;
}

export interface Cliente {
  id: string;
  codigo_cliente?: number;
  nome: string;
  telefone: string;
  cep?: string;
  endereco: string;
  numero?: string;
  bairro: string;
  cidade: string;
  estado: string;
  origem: string;
  status_cliente: StatusCliente;
  data_cadastro: string;
  vendedor_responsavel_id?: string | null;
  vendedor?: {
    nome: string;
    codigo_vendedor?: number;
  } | null;
  observacoes?: string | null;
  
  // Métricas
  total_compras: number;
  valor_total_gasto: number;
  ticket_medio: number;
  data_ultima_compra?: string | null;
  dias_sem_comprar: number;
}

export interface Produto {
  id: string;
  codigo_produto?: number | string;
  nome_produto: string;
  categoria: string;
  unidade: string;
  custo_unitario: number;
  preco_venda: number;
  estoque_atual: number;
  estoque_minimo: number;
  estoque_reservado: number;
  ativo: boolean;
  created_at?: string;
}

export interface Venda {
  id: string;
  cliente_id: string;
  vendedor_id: string;
  data_venda: string;
  valor_total: number;
  forma_pagamento: string;
  status_venda: StatusVenda;
  observacoes?: string | null;
}

export interface VendaItem {
  id: string;
  venda_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

export interface EstoqueMovimentacao {
  id: string;
  produto_id: string;
  usuario_id: string; // ID do usuário que realizou a ação
  tipo_movimento: TipoMovimento;
  quantidade: number;
  origem: OrigemMovimento;
  referencia_id?: string | null;
  data_movimento: string;
  observacoes?: string | null;
}

export interface Entrega {
  id: string;
  venda_id: string;
  cliente_id: string;
  numero_pedido: string;
  endereco_entrega: string;
  bairro: string;
  cidade: string;
  estado: string;
  status_entrega: StatusEntrega;
  responsavel_logistica_id?: string | null;
  data_saida?: string | null;
  data_entrega?: string | null;
  rota?: string | null;
  observacoes?: string | null;
  created_at: string;
}

export interface FunilLead {
  cliente_id: string;
  etapa: EtapaFunil;
  updated_at: string;
}

export interface Meta {
  id: string;
  tipo_meta: TipoMeta;
  valor_meta: number;
  periodo: string;
  usuario_id?: string | null;
  created_at: string;
}

export interface DashboardData {
  total_clientes_mes: number;
  total_vendas_mes: number;
  faturamento_mes: number;
  pedidos_em_entrega: number;
  estoque_baixo: number;
}

export interface AdminDashboardData {
  financeiro: {
    faturamento_dia: number;
    faturamento_semana: number;
    faturamento_mes: number;
    ticket_medio: number;
    variacoes: {
      dia: number; // percentual em relação a ontem
      semana: number; // percentual em relação a semana passada
      mes: number; // percentual em relação ao mês passado
    };
  };
  pedidos: {
    aguardando_preparacao: number;
    pronto_para_entrega: number;
    em_rota: number;
    entregue_hoje: number;
    finalizados_hoje: number;
    pendentes_total: number; // total não finalizado/cancelado
  };
  clientes: {
    novos_hoje: number;
    ativos_mes: number;
    recorrentes: number;
    inativos: number; // > 30 dias sem comprar
  };
  vendedores: {
    ranking: {
      vendedor_id: string;
      nome: string;
      faturamento: number;
      vendas_count: number;
    }[];
  };
  estoque: {
    itens_baixo_estoque: number;
    top_produtos: {
      produto_id: string;
      nome_produto: string;
      quantidade_vendida: number;
    }[];
    itens_parados: number; // sem venda há > 60 dias
  };
  logistica: {
    taxa_sucesso_entrega: number;
    pedidos_atrasados: number;
    tempo_medio_preparacao_minutos: number;
  };
}

export interface Pedido {
  id: string;
  numero_pedido: string;
  cliente_id: string;
  vendedor_id: string;
  valor_total: number;
  desconto_tipo?: TipoDesconto;
  desconto_valor?: number;
  desconto_aplicado?: number;
  forma_pagamento: 'dinheiro' | 'pix' | 'cartao';
  status_pedido: StatusPedido;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
  
  // Dados desnormalizados do cliente
  nome_cliente?: string;
  telefone_cliente?: string;
  endereco_entrega?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  complemento?: string;
  data_criacao?: string;
  
  // Dados desnormalizados do vendedor
  nome_vendedor?: string;
  codigo_vendedor?: number;
  
  // Relacionais (opcionais para quando houver join)
  cliente?: {
    nome: string;
    telefone: string;
    bairro: string;
    cidade: string;
    estado: string;
    endereco: string;
    numero: string;
  };
  vendedor?: {
    nome: string;
  };
  // Itens do pedido (presente quando há join com pedido_itens)
  itens?: PedidoItem[];

  // ── Campos de Logística (opcionais — requerem ALTER TABLE no Supabase) ──────
  // ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS motorista TEXT;
  // ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS rota TEXT;
  // ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS delivery_started_at TIMESTAMPTZ;
  // ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
  // ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
  // ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS payment_check_status TEXT DEFAULT 'pendente';
  // ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS amount_received NUMERIC;
  // ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS delivery_problem_type TEXT;
  // ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
  motorista?: string | null;
  rota?: string | null;
  delivery_started_at?: string | null;
  delivered_at?: string | null;
  finalized_at?: string | null;
  payment_check_status?: PaymentCheckStatus | null;
  amount_received?: number | null;
  delivery_problem_type?: DeliveryProblemType | null;
  delivery_notes?: string | null;
}


export interface PedidoItem {
  id: string;
  pedido_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  desconto_tipo?: TipoDesconto;
  desconto_valor?: number;
  desconto_aplicado?: number;
  subtotal: number;
  created_at?: string;
  
  // Relacional
  produto?: {
    codigo_produto?: number | string;
    nome_produto: string;
  };
}

export type Usuario = Profile;
export type Driver = Profile;

export interface PedidoStats {
  total: number;
  preparacao: number;
  rota: number;
  entregues: number;
  finalizados: number;
}

// ── Agendamento ───────────────────────────────────────────────────────────────
export interface AgendamentoItem {
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  desconto_tipo?: TipoDesconto;
  desconto_valor?: number;
  desconto_aplicado?: number;
  produto?: { nome_produto: string; codigo_produto?: number | string };
}

export interface Agendamento {
  id: string;
  data_agendamento: string;   // ISO datetime — data/hora agendada
  status: StatusAgendamento;
  cliente_id: string;
  vendedor_id: string;
  valor_total: number;
  desconto_tipo?: TipoDesconto;
  desconto_valor?: number;
  desconto_aplicado?: number;
  forma_pagamento: 'dinheiro' | 'pix' | 'cartao';
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
  pedido_id?: string | null;

  // Desnormalizados
  nome_cliente?: string;
  telefone_cliente?: string;
  endereco_entrega?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  nome_vendedor?: string;
  codigo_vendedor?: number;

  // Relacionais
  cliente?: { nome: string; telefone: string };
  vendedor?: { nome: string };
  itens?: AgendamentoItem[];
}

