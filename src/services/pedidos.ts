import { createClient } from '@/utils/supabase/server';
import { Pedido, PedidoItem, StatusPedido, DeliveryProblemType, PaymentCheckStatus, DeliveryNextAction } from '@/models/types';

export const fetchPedidos = async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      *,
      cliente:clientes(nome, telefone, bairro, cidade, estado, endereco, numero),
      vendedor:profiles(nome),
      ambassador:ambassadors!pedidos_ambassador_id_fkey(id, full_name, referral_code, status)
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
      ambassador:ambassadors!pedidos_ambassador_id_fkey(id, full_name, referral_code, status),
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
  itens: Omit<PedidoItem, 'id' | 'pedido_id' | 'created_at'>[],
  idempotencyKey: string,
  client?: any
) => {
  const supabase = client || (await createClient());
  const { data, error } = await supabase.rpc('fn_create_manual_order_canonical', {
    p_order: pedido,
    p_items: itens,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;

  const result = data as {
    status?: string;
    code?: string;
    order_id?: string;
    order_number?: string;
  } | null;
  if (!result) throw new Error('O banco não retornou o resultado da criação do pedido.');
  if (result.status === 'idempotency_conflict') {
    throw new Error('Esta tentativa de pedido já foi usada com dados diferentes. Reabra o formulário e tente novamente.');
  }
  if (result.status === 'assignment_rejected') {
    if (result.code === 'self_referral_forbidden') {
      throw new Error('O cliente não pode indicar a si próprio.');
    }
    if (result.code === 'existing_official_assignment_preserved') {
      throw new Error('O cliente já possui outra indicação oficial. O vínculo original foi preservado.');
    }
    throw new Error('Não foi possível registrar a indicação oficial deste pedido.');
  }

  return result;
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
  return await updateStatusPedido(pedidoId, 'finalizado');
};

/**
 * Cancela um pedido e libera o estoque reservado.
 */
export const cancelarPedido = async (pedidoId: string) => {
  const pedido = await fetchPedidoById(pedidoId);
  if (!pedido) throw new Error('Pedido não encontrado');
  if (pedido.status_pedido === 'cancelado') return { success: true };

  return await updateStatusPedido(pedidoId, 'cancelado');
};

/**
 * Edita um pedido que ainda está em 'aguardando_preparacao'.
 */
export const updatePedido = async (
  pedidoId: string,
  pedidoData: Partial<Omit<Pedido, 'id' | 'numero_pedido' | 'created_at' | 'updated_at' | 'status_pedido'>>,
  itens: Omit<PedidoItem, 'id' | 'pedido_id' | 'created_at'>[]
) => {
  const supabase = await createClient();

  const { data: pedido, error: fetchError } = await supabase
    .from('pedidos')
    .select('status_pedido')
    .eq('id', pedidoId)
    .single();

  if (fetchError) throw fetchError;
  if (pedido.status_pedido !== 'aguardando_preparacao') {
    throw new Error('Só é possível editar pedidos com status "Aguardando Preparação".');
  }

  const valorTotal = pedidoData.valor_total ?? itens.reduce((acc, item) => acc + item.subtotal, 0);

  const { error: updateError } = await supabase
    .from('pedidos')
    .update({ ...pedidoData, valor_total: valorTotal, updated_at: new Date().toISOString() })
    .eq('id', pedidoId);

  if (updateError) throw updateError;

  const { error: deleteError } = await supabase
    .from('pedido_itens')
    .delete()
    .eq('pedido_id', pedidoId);

  if (deleteError) throw deleteError;

  const novosItens = itens.map(item => ({ ...item, pedido_id: pedidoId }));
  const { error: insertError } = await supabase
    .from('pedido_itens')
    .insert(novosItens);

  if (insertError) throw insertError;

  return { success: true };
};

// ── Funções de Logística ──────────────────────────────────────────────────────

export const fetchPedidosLogistica = async () => {
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
    .neq('status_pedido', 'aguardando_preparacao')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data as Pedido[];
};

export const markOrderAsInRoute = async (orderId: string): Promise<void> => {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    status_pedido: 'em_rota' as StatusPedido,
    updated_at: new Date().toISOString(),
  };

  try {
    updateData.delivery_started_at = new Date().toISOString();
  } catch {}

  const { error } = await supabase
    .from('pedidos')
    .update(updateData)
    .eq('id', orderId);

  if (error) throw error;
};

export const markOrderAsDelivered = async (orderId: string): Promise<void> => {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    status_pedido: 'entregue' as StatusPedido,
    updated_at: new Date().toISOString(),
  };

  try {
    updateData.delivered_at = new Date().toISOString();
  } catch {}

  const { error } = await supabase
    .from('pedidos')
    .update(updateData)
    .eq('id', orderId);

  if (error) throw error;
};

export const confirmOrderPayment = async (params: {
  orderId: string;
  expectedAmount: number;
  receivedAmount: number;
  paymentMethod: string;
  notes?: string;
}): Promise<{ finalized: boolean; divergent: boolean }> => {
  const supabase = await createClient();
  const { orderId, expectedAmount, receivedAmount, paymentMethod, notes } = params;

  const { data: currentOrder, error: fetchError } = await supabase
    .from('pedidos')
    .select('status_pedido, payment_check_status')
    .eq('id', orderId)
    .single();

  if (fetchError || !currentOrder) {
    throw new Error('Pedido não encontrado.');
  }

  if (currentOrder.status_pedido !== 'entregue' && currentOrder.status_pedido !== 'finalizado') {
    throw new Error(
      `A confirmação de pagamento só é permitida para pedidos com status "Entregue" ou "Finalizado". O status atual deste pedido é "${currentOrder.status_pedido}".`
    );
  }

  const isDivergent = Math.abs(receivedAmount - expectedAmount) > 0.01;

  const updateData: Record<string, unknown> = {
    amount_received: receivedAmount,
    payment_check_status: (isDivergent ? 'divergente' : 'confirmado') as PaymentCheckStatus,
    delivery_notes: notes || null,
    forma_pagamento: paymentMethod as 'dinheiro' | 'pix' | 'cartao',
    updated_at: new Date().toISOString(),
  };

  if (!isDivergent && currentOrder.status_pedido === 'entregue') {
    updateData.status_pedido = 'finalizado' as StatusPedido;
    updateData.finalized_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('pedidos')
    .update(updateData)
    .eq('id', orderId);

  if (error) throw error;

  return { finalized: !isDivergent, divergent: isDivergent };
};

export const registerDeliveryProblem = async (params: {
  orderId: string;
  problemType: DeliveryProblemType;
  notes: string;
  nextAction: 'keep' | 'back_to_ready' | 'cancel';
}): Promise<void> => {
  const supabase = await createClient();
  const { orderId, problemType, notes, nextAction } = params;

  const statusMap: Record<string, StatusPedido> = {
    keep: 'em_rota',
    back_to_ready: 'pronto_para_entrega',
    cancel: 'cancelado',
  };

  const updateData: Record<string, unknown> = {
    delivery_problem_type: problemType,
    delivery_notes: notes,
    updated_at: new Date().toISOString(),
  };

  if (nextAction !== 'keep') {
    updateData.status_pedido = statusMap[nextAction];
  }

  const { error } = await supabase
    .from('pedidos')
    .update(updateData)
    .eq('id', orderId);

  if (error) throw error;
};

export const updateOrderDriver = async (params: {
  orderId: string;
  motorista: string;
  rota?: string;
}): Promise<void> => {
  const supabase = await createClient();
  const { orderId, motorista, rota } = params;

  const { error } = await supabase
    .from('pedidos')
    .update({
      motorista,
      rota: rota || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) throw error;
};
