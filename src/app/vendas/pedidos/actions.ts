'use server';

import { revalidatePath } from 'next/cache';
import * as pedidoService from '@/services/pedidos';
import { getProdutos } from '@/services/produtos';
import { StatusPedido, Pedido, PedidoItem } from '@/models/types';

export async function getPedidos() {
  try {
    return await pedidoService.fetchPedidos();
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    throw new Error('Falha ao carregar lista de pedidos.');
  }
}

export async function getPedidoById(id: string) {
  try {
    return await pedidoService.fetchPedidoById(id);
  } catch (error) {
    console.error('Erro ao buscar detalhes do pedido:', error);
    throw new Error('Falha ao carregar detalhes do pedido.');
  }
}

export async function getProdutosAction() {
  try {
    return await getProdutos();
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    throw new Error('Falha ao carregar produtos.');
  }
}

export async function savePedido(
  pedido: Omit<Pedido, 'id' | 'numero_pedido' | 'created_at' | 'updated_at'>,
  itens: Omit<PedidoItem, 'id' | 'pedido_id' | 'created_at'>[]
) {
  try {
    const data = await pedidoService.createPedido(pedido, itens);
    revalidatePath('/vendas/pedidos');
    revalidatePath('/estoque');
    revalidatePath('/vendas');
    return data;
  } catch (error) {
    console.error('Erro ao salvar pedido:', error);
    throw new Error('Falha ao salvar o pedido. Verifique os dados e tente novamente.');
  }
}

export async function updatePedidoStatus(id: string, status: StatusPedido) {
  try {
    let data;
    
    if (status === 'finalizado') {
      // Se for finalizado, usamos a lógica complexa de conversão para venda e baixa de estoque
      data = await pedidoService.finalizarPedido(id);
    } else if (status === 'cancelado') {
      // Se for cancelado, liberamos o estoque reservado
      data = await pedidoService.cancelarPedido(id);
    } else {
      // Caso contrário, apenas atualizamos o status operacional
      data = await pedidoService.updateStatusPedido(id, status);
    }

    revalidatePath('/vendas/pedidos');
    revalidatePath('/estoque');
    revalidatePath('/vendas');
    revalidatePath('/vendas/historico');
    
    return data;
  } catch (error) {
    console.error('Erro ao atualizar status do pedido:', error);
    throw new Error(error instanceof Error ? error.message : 'Falha ao atualizar o status do pedido.');
  }
}

export async function getPedidosStats() {
  try {
    return await pedidoService.fetchPedidosStats();
  } catch (error) {
    console.error('Erro ao buscar estatísticas de pedidos:', error);
    return { total: 0, preparacao: 0, rota: 0, entregues: 0, finalizados: 0 };
  }
}

export async function finalizarPedidoAction(id: string) {
  try {
    const result = await pedidoService.finalizarPedido(id);
    revalidatePath('/vendas/pedidos');
    revalidatePath('/vendas');
    revalidatePath('/estoque');
    return result;
  } catch (error) {
    console.error('Erro ao finalizar pedido:', error);
    throw new Error(error instanceof Error ? error.message : 'Falha ao finalizar o pedido.');
  }
}

export async function cancelarPedidoAction(id: string) {
  try {
    const result = await pedidoService.cancelarPedido(id);
    revalidatePath('/vendas/pedidos');
    revalidatePath('/estoque');
    return result;
  } catch (error) {
    console.error('Erro ao cancelar pedido:', error);
    throw new Error(error instanceof Error ? error.message : 'Falha ao cancelar o pedido.');
  }
}

export async function updatePedidoAction(
  pedidoId: string,
  pedidoData: Partial<Omit<Pedido, 'id' | 'numero_pedido' | 'created_at' | 'updated_at' | 'status_pedido'>>,
  itens: Omit<PedidoItem, 'id' | 'pedido_id' | 'created_at'>[]
) {
  try {
    const result = await pedidoService.updatePedido(pedidoId, pedidoData, itens);
    revalidatePath('/vendas/pedidos');
    revalidatePath('/estoque');
    revalidatePath('/vendas');
    return result;
  } catch (error) {
    console.error('Erro ao editar pedido:', error);
    throw new Error(error instanceof Error ? error.message : 'Falha ao editar o pedido.');
  }
}
