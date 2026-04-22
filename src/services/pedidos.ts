import { createClient } from '@/utils/supabase/server';
import { Pedido, PedidoItem, StatusPedido } from '@/models/types';

export const fetchPedidos = async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      *,
      cliente:clientes(nome, telefone, bairro, cidade, estado, endereco, numero),
      vendedor:profiles(nome)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Pedido[];
};

export const fetchPedidoById = async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      *,
      cliente:clientes(nome, telefone, bairro, cidade, estado, endereco, numero),
      vendedor:profiles(nome),
      itens:pedido_itens(
        *,
        produto:produtos(nome_produto, codigo_produto)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
};

export const createPedido = async (
  pedido: Omit<Pedido, 'id' | 'numero_pedido' | 'created_at' | 'updated_at'>,
  itens: Omit<PedidoItem, 'id' | 'pedido_id' | 'created_at'>[]
) => {
  const supabase = await createClient();
  // 1. Inserir o pedido
  const { data: pedidoData, error: pedidoError } = await supabase
    .from('pedidos')
    .insert([pedido])
    .select()
    .single();

  if (pedidoError) throw pedidoError;

  // 2. Inserir os itens vinculados ao ID do pedido criado
  const itensComId = itens.map(item => ({
    ...item,
    pedido_id: pedidoData.id
  }));

  const { error: itensError } = await supabase
    .from('pedido_itens')
    .insert(itensComId);

  if (itensError) {
    // Se der erro nos itens, deveríamos deletar o pedido (rollback manual simples)
    await supabase.from('pedidos').delete().eq('id', pedidoData.id);
    throw itensError;
  }

  return pedidoData;
};

export const updateStatusPedido = async (id: string, status: StatusPedido) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pedidos')
    .update({ status_pedido: status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const fetchPedidosStats = async () => {
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select('status_pedido, created_at')
    .gte('created_at', today.toISOString());

  if (error) throw error;

  const stats = {
    total: pedidos.length,
    preparacao: pedidos.filter(p => p.status_pedido === 'aguardando_preparacao').length,
    rota: pedidos.filter(p => p.status_pedido === 'em_rota').length,
    entregues: pedidos.filter(p => p.status_pedido === 'entregue').length,
    finalizados: pedidos.filter(p => p.status_pedido === 'finalizado').length,
  };

  return stats;
};

/**
 * Finaliza um pedido convertendo-o em venda e dando baixa no estoque.
 */
export const finalizarPedido = async (pedidoId: string) => {
  // O banco de dados (Trigger trg_confirmar_baixa_estoque_pedido) cuida de:
  // 1. Abater o estoque físico
  // 2. Limpar a reserva
  // 3. Criar o registro na tabela de vendas
  // 4. Copiar os itens para venda_itens
  return await updateStatusPedido(pedidoId, 'finalizado');
};

/**
 * Cancela um pedido e libera o estoque reservado.
 */
export const cancelarPedido = async (pedidoId: string) => {
  const pedido = await fetchPedidoById(pedidoId);
  if (!pedido) throw new Error('Pedido não encontrado');
  // Se o pedido foi finalizado, a trigger agora cuida de devolver o estoque físico.
  // if (pedido.status_pedido === 'finalizado') throw new Error('Não é possível cancelar um pedido finalizado');
  if (pedido.status_pedido === 'cancelado') return { success: true };

  // O banco de dados (Trigger trg_confirmar_baixa_estoque_pedido) cuida de:
  // 1. Liberar o estoque reservado
  return await updateStatusPedido(pedidoId, 'cancelado');
};

/**
 * Edita um pedido que ainda está em 'aguardando_preparacao'.
 * Substitui os itens antigos pelos novos — as triggers de reserva cuidam do estoque.
 */
export const updatePedido = async (
  pedidoId: string,
  pedidoData: Partial<Omit<Pedido, 'id' | 'numero_pedido' | 'created_at' | 'updated_at' | 'status_pedido'>>,
  itens: Omit<PedidoItem, 'id' | 'pedido_id' | 'created_at'>[]
) => {
  const supabase = await createClient();

  // Verificar se ainda está em aguardando_preparacao
  const { data: pedido, error: fetchError } = await supabase
    .from('pedidos')
    .select('status_pedido')
    .eq('id', pedidoId)
    .single();

  if (fetchError) throw fetchError;
  if (pedido.status_pedido !== 'aguardando_preparacao') {
    throw new Error('Só é possível editar pedidos com status "Aguardando Preparação".');
  }

  // Calcular valor total dos novos itens
  const valorTotal = itens.reduce((acc, item) => acc + item.subtotal, 0);

  // Atualizar meta dados do pedido
  const { error: updateError } = await supabase
    .from('pedidos')
    .update({ ...pedidoData, valor_total: valorTotal, updated_at: new Date().toISOString() })
    .eq('id', pedidoId);

  if (updateError) throw updateError;

  // Remover todos os itens antigos (trigger libera reserva automaticamente via DELETE)
  const { error: deleteError } = await supabase
    .from('pedido_itens')
    .delete()
    .eq('pedido_id', pedidoId);

  if (deleteError) throw deleteError;

  // Inserir novos itens (trigger reserva estoque automaticamente via INSERT)
  const novosItens = itens.map(item => ({ ...item, pedido_id: pedidoId }));
  const { error: insertError } = await supabase
    .from('pedido_itens')
    .insert(novosItens);

  if (insertError) throw insertError;

  return { success: true };
};
