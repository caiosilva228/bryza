'use server';

import { revalidatePath } from 'next/cache';
import * as pedidoService from '@/services/pedidos';
import { DeliveryProblemType } from '@/models/types';

export async function getPedidosLogistica() {
  try {
    return await pedidoService.fetchPedidosLogistica();
  } catch (error) {
    console.error('Erro ao buscar pedidos logísticos:', error);
    throw new Error('Falha ao carregar pedidos da logística.');
  }
}

export async function marcarEmRota(orderId: string) {
  try {
    await pedidoService.markOrderAsInRoute(orderId);
    revalidatePath('/logistica');
    revalidatePath('/vendas/pedidos');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Erro ao marcar em rota:', error);
    throw new Error(error instanceof Error ? error.message : 'Falha ao atualizar o pedido.');
  }
}

export async function marcarEntregue(orderId: string) {
  try {
    await pedidoService.markOrderAsDelivered(orderId);
    revalidatePath('/logistica');
    revalidatePath('/vendas/pedidos');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Erro ao marcar como entregue:', error);
    throw new Error(error instanceof Error ? error.message : 'Falha ao atualizar o pedido.');
  }
}

export async function confirmarPagamento(params: {
  orderId: string;
  expectedAmount: number;
  receivedAmount: number;
  paymentMethod: string;
  notes?: string;
}) {
  try {
    const result = await pedidoService.confirmOrderPayment(params);
    revalidatePath('/logistica');
    revalidatePath('/vendas/pedidos');
    revalidatePath('/vendas');
    revalidatePath('/estoque');
    revalidatePath('/');
    return result;
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error);
    throw new Error(error instanceof Error ? error.message : 'Falha ao confirmar o pagamento.');
  }
}

export async function registrarProblema(params: {
  orderId: string;
  problemType: DeliveryProblemType;
  notes: string;
  nextAction: 'keep' | 'back_to_ready' | 'cancel';
}) {
  try {
    await pedidoService.registerDeliveryProblem(params);
    revalidatePath('/logistica');
    revalidatePath('/vendas/pedidos');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Erro ao registrar problema:', error);
    throw new Error(error instanceof Error ? error.message : 'Falha ao registrar o problema.');
  }
}
