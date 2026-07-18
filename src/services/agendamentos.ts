import { createClient } from '@/utils/supabase/server';
import { Agendamento, AgendamentoItem, TipoDesconto } from '@/models/types';

const AGENDAMENTO_SELECT = `
  *,
  cliente:clientes(nome, telefone),
  vendedor:profiles(nome),
  itens:agendamento_itens(
    *,
    produto:produtos(nome_produto, codigo_produto)
  )
`;

export const fetchAgendamentos = async (): Promise<Agendamento[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agendamentos')
    .select(AGENDAMENTO_SELECT)
    .order('data_agendamento', { ascending: true });

  if (error) throw error;
  return data as Agendamento[];
};

export const fetchAgendamentosByDate = async (date: string): Promise<Agendamento[]> => {
  const supabase = await createClient();
  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59`;

  const { data, error } = await supabase
    .from('agendamentos')
    .select(AGENDAMENTO_SELECT)
    .gte('data_agendamento', start)
    .lte('data_agendamento', end)
    .eq('status', 'agendado')
    .order('data_agendamento', { ascending: true });

  if (error) throw error;
  return data as Agendamento[];
};

export interface AgendamentoInput {
  data_agendamento: string;
  cliente_id: string;
  vendedor_id: string;
  valor_total: number;
  desconto_tipo?: TipoDesconto;
  desconto_valor?: number;
  desconto_aplicado?: number;
  forma_pagamento: 'dinheiro' | 'pix' | 'cartao';
  observacoes?: string | null;
  nome_cliente?: string;
  telefone_cliente?: string;
  endereco_entrega?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  nome_vendedor?: string;
  codigo_vendedor?: number;
}

export const createAgendamento = async (
  agendamento: AgendamentoInput,
  itens: Omit<AgendamentoItem, 'produto'>[]
): Promise<Agendamento> => {
  const supabase = await createClient();

  const { data: agendamentoData, error: agendamentoError } = await supabase
    .from('agendamentos')
    .insert([{ ...agendamento, status: 'agendado' }])
    .select()
    .single();

  if (agendamentoError) throw agendamentoError;

  const itensComId = itens.map(item => ({ ...item, agendamento_id: agendamentoData.id }));
  const { error: itensError } = await supabase
    .from('agendamento_itens')
    .insert(itensComId);

  if (itensError) {
    await supabase.from('agendamentos').delete().eq('id', agendamentoData.id);
    throw itensError;
  }

  return agendamentoData as Agendamento;
};

export const converterAgendamentoEmPedido = async (agendamentoId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_converter_agendamento_em_pedido', {
    p_agendamento_id: agendamentoId,
  });

  if (error) throw new Error(error.message || 'Não foi possível converter o agendamento');
  if (!data?.sucesso || !data?.pedido_id) throw new Error('Conversão não confirmada pelo servidor');

  const { data: pedidoData, error: pedidoError } = await supabase
    .from('pedidos')
    .select('*')
    .eq('id', data.pedido_id)
    .single();

  if (pedidoError || !pedidoData) throw new Error('Pedido convertido, mas não foi possível carregar os dados');
  return pedidoData;
};

export const retornarPedidoParaAgendamento = async (pedidoId: string, dataAgendamentoIso: string) => {
  const supabase = await createClient();

  // 1. Verificar se existe um agendamento original convertido para este pedido
  const { data: agendamentoOriginal, error: searchOriginalError } = await supabase
    .from('agendamentos')
    .select('id')
    .eq('pedido_id', pedidoId)
    .single();

  if (!searchOriginalError && agendamentoOriginal) {
    // 2a. Reutilizar o agendamento original: atualizar para 'agendado', nova data e limpar pedido_id
    const { error: updateOriginalError } = await supabase
      .from('agendamentos')
      .update({
        status: 'agendado',
        data_agendamento: dataAgendamentoIso,
        pedido_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', agendamentoOriginal.id);

    if (updateOriginalError) throw updateOriginalError;

    // Deletar o pedido para liberar o estoque reservado
    const { error: deleteError } = await supabase
      .from('pedidos')
      .delete()
      .eq('id', pedidoId);

    if (deleteError) {
      // Reverter alteração do agendamento em caso de erro na deleção
      await supabase
        .from('agendamentos')
        .update({
          status: 'convertido',
          pedido_id: pedidoId,
          updated_at: new Date().toISOString()
        })
        .eq('id', agendamentoOriginal.id);
      throw deleteError;
    }

    return { id: agendamentoOriginal.id };
  }

  // 1b. Caso não haja agendamento original (pedido direto), buscar dados do pedido
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select(`
      *,
      itens:pedido_itens(*)
    `)
    .eq('id', pedidoId)
    .single();

  if (pedidoError || !pedido) throw new Error('Pedido não encontrado para retorno.');

  // 2b. Criar novo agendamento
  const agendamentoPayload = {
    data_agendamento: dataAgendamentoIso,
    status: 'agendado',
    cliente_id: pedido.cliente_id,
    vendedor_id: pedido.vendedor_id,
    valor_total: pedido.valor_total,
    desconto_tipo: pedido.desconto_tipo,
    desconto_valor: pedido.desconto_valor,
    desconto_aplicado: pedido.desconto_aplicado,
    forma_pagamento: pedido.forma_pagamento,
    observacoes: pedido.observacoes,
    nome_cliente: pedido.nome_cliente,
    telefone_cliente: pedido.telefone_cliente,
    endereco_entrega: pedido.endereco_entrega,
    bairro: pedido.bairro,
    cidade: pedido.cidade,
    estado: pedido.estado,
    cep: pedido.cep,
    nome_vendedor: pedido.nome_vendedor,
    codigo_vendedor: pedido.codigo_vendedor,
  };

  const { data: agendamentoData, error: agendamentoError } = await supabase
    .from('agendamentos')
    .insert([agendamentoPayload])
    .select()
    .single();

  if (agendamentoError) throw agendamentoError;

  // 3b. Criar os itens de agendamento
  const agendamentoItens = (pedido.itens || []).map((item: any) => ({
    agendamento_id: agendamentoData.id,
    produto_id: item.produto_id,
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
    subtotal: item.subtotal,
    desconto_tipo: item.desconto_tipo,
    desconto_valor: item.desconto_valor,
    desconto_aplicado: item.desconto_aplicado,
  }));

  if (agendamentoItens.length > 0) {
    const { error: itensError } = await supabase
      .from('agendamento_itens')
      .insert(agendamentoItens);

    if (itensError) {
      await supabase.from('agendamentos').delete().eq('id', agendamentoData.id);
      throw itensError;
    }
  }

  // 4b. Deletar o pedido
  const { error: deleteError } = await supabase
    .from('pedidos')
    .delete()
    .eq('id', pedidoId);

  if (deleteError) {
    await supabase.from('agendamentos').delete().eq('id', agendamentoData.id);
    throw deleteError;
  }

  return agendamentoData;
};

export const cancelarAgendamento = async (agendamentoId: string) => {
  const supabase = await createClient();
  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', agendamentoId);

  if (error) throw error;
  return { success: true };
};

export const reagendarAgendamento = async (agendamentoId: string, novaDataIso: string) => {
  const supabase = await createClient();
  const { error } = await supabase
    .from('agendamentos')
    .update({
      data_agendamento: novaDataIso,
      updated_at: new Date().toISOString()
    })
    .eq('id', agendamentoId);

  if (error) throw error;
  return { success: true };
};

export const updateAgendamento = async (
  agendamentoId: string,
  agendamentoData: Partial<AgendamentoInput>,
  itens: Omit<AgendamentoItem, 'produto'>[]
): Promise<{ success: boolean }> => {
  const supabase = await createClient();
  
  // 1. Atualizar agendamento
  const { error: updateError } = await supabase
    .from('agendamentos')
    .update({ ...agendamentoData, updated_at: new Date().toISOString() })
    .eq('id', agendamentoId);
    
  if (updateError) throw updateError;
  
  // 2. Deletar itens antigos
  const { error: deleteError } = await supabase
    .from('agendamento_itens')
    .delete()
    .eq('agendamento_id', agendamentoId);
    
  if (deleteError) throw deleteError;
  
  // 3. Inserir novos itens
  const itensComId = itens.map(item => ({ ...item, agendamento_id: agendamentoId }));
  const { error: insertError } = await supabase
    .from('agendamento_itens')
    .insert(itensComId);
    
  if (insertError) throw insertError;
  
  return { success: true };
};
