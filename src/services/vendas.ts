import { createClient } from '@/utils/supabase/server';
import { Venda } from '@/models/types';

interface VendaWithCliente extends Venda {
  cliente: {
    nome: string;
  };
}

export const getVendas = async (startDate?: string, endDate?: string): Promise<VendaWithCliente[]> => {
  const supabase = await createClient();
  
  let query = supabase
    .from('vendas')
    .select(`
      *,
      cliente:clientes(nome)
    `);

  if (startDate) {
    query = query.gte('data_venda', `${startDate}T00:00:00`);
  }
  if (endDate) {
    query = query.lte('data_venda', `${endDate}T23:59:59.999`);
  }

  const { data, error } = await query.order('data_venda', { ascending: false });

  if (error) {
    console.error('Erro ao buscar vendas:', error);
    return [];
  }

  return data as VendaWithCliente[];
};

export interface VendaWithItens extends Venda {
  origem?: 'venda' | 'pedido';
  numero_pedido?: string;
  status_pedido?: string;
  created_at?: string;
  venda_itens: {
    id: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
    produto: {
      nome_produto: string;
    };
  }[];
}

export const getVendasByCliente = async (clienteId: string): Promise<VendaWithItens[]> => {
  const supabase = await createClient();

  const { data: vendasData, error: vendasError } = await supabase
    .from('vendas')
    .select(`
      *,
      venda_itens(
        id,
        quantidade,
        preco_unitario,
        subtotal,
        produto:produtos(nome_produto)
      )
    `)
    .eq('cliente_id', clienteId)
    .order('data_venda', { ascending: false });

  if (vendasError) {
    console.error('Erro ao buscar vendas do cliente:', vendasError);
    return [];
  }

  if (vendasData && vendasData.length > 0) {
    return (vendasData as VendaWithItens[]).map(venda => ({
      ...venda,
      origem: 'venda',
      venda_itens: venda.venda_itens || [],
    }));
  }

  const { data: pedidosData, error: pedidosError } = await supabase
    .from('pedidos')
    .select(`
      id,
      cliente_id,
      valor_total,
      forma_pagamento,
      status_pedido,
      observacoes,
      created_at,
      updated_at,
      numero_pedido,
      nome_cliente,
      telefone_cliente,
      endereco_entrega,
      bairro,
      cidade,
      estado,
      cep,
      complemento,
      pedido_itens(
        id,
        quantidade,
        preco_unitario,
        subtotal,
        produto:produtos(nome_produto)
      )
    `)
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false });

  if (pedidosError) {
    console.error('Erro ao buscar pedidos do cliente:', pedidosError);
    return [];
  }

  return (pedidosData || []).map((pedido: any) => ({
    id: pedido.id,
    cliente_id: pedido.cliente_id,
    vendedor_id: '',
    data_venda: pedido.created_at,
    valor_total: pedido.valor_total,
    forma_pagamento: pedido.forma_pagamento,
    status_venda: pedido.status_pedido || 'finalizado',
    observacoes: pedido.observacoes,
    created_at: pedido.created_at,
    updated_at: pedido.updated_at || pedido.created_at,
    numero_pedido: pedido.numero_pedido,
    nome_cliente: pedido.nome_cliente,
    telefone_cliente: pedido.telefone_cliente,
    endereco_entrega: pedido.endereco_entrega,
    bairro: pedido.bairro,
    cidade: pedido.cidade,
    estado: pedido.estado,
    cep: pedido.cep,
    complemento: pedido.complemento,
    status_pedido: pedido.status_pedido,
    origem: 'pedido',
    venda_itens: (pedido.pedido_itens || []).map((item: any) => ({
      id: item.id,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      subtotal: item.subtotal,
      produto: item.produto,
    })),
  })) as VendaWithItens[];
};

export const getVendaById = async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vendas')
    .select(`
      *,
      cliente:clientes(nome, telefone, endereco, numero, bairro, cidade, estado, cep),
      vendedor:profiles(nome, codigo_vendedor),
      itens:venda_itens(
        *,
        produto:produtos(nome_produto, codigo_produto)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
};

