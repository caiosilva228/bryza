'use server';

import { revalidatePath } from 'next/cache';
import {
  fetchAgendamentos,
  fetchAgendamentosByDate,
  createAgendamento,
  converterAgendamentoEmPedido,
  cancelarAgendamento,
  AgendamentoInput,
} from '@/services/agendamentos';
import { AgendamentoItem } from '@/models/types';

export async function getAgendamentosAction() {
  try {
    return await fetchAgendamentos();
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    throw new Error('Falha ao carregar agendamentos.');
  }
}

export async function getAgendamentosByDateAction(date: string) {
  try {
    return await fetchAgendamentosByDate(date);
  } catch (error) {
    console.error('Erro ao buscar agendamentos por data:', error);
    throw new Error('Falha ao carregar agendamentos da data.');
  }
}

export async function criarAgendamentoAction(
  agendamento: AgendamentoInput,
  itens: Omit<AgendamentoItem, 'produto'>[]
) {
  try {
    const data = await createAgendamento(agendamento, itens);
    revalidatePath('/vendas/agendamentos');
    revalidatePath('/');
    return data;
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    throw new Error('Falha ao criar agendamento.');
  }
}

export async function converterAgendamentoAction(agendamentoId: string) {
  try {
    const result = await converterAgendamentoEmPedido(agendamentoId);
    revalidatePath('/vendas/agendamentos');
    revalidatePath('/vendas/pedidos');
    revalidatePath('/estoque');
    revalidatePath('/');
    return result;
  } catch (error) {
    console.error('Erro ao converter agendamento:', error);
    throw new Error(error instanceof Error ? error.message : 'Falha ao converter agendamento em pedido.');
  }
}

export async function cancelarAgendamentoAction(agendamentoId: string) {
  try {
    const result = await cancelarAgendamento(agendamentoId);
    revalidatePath('/vendas/agendamentos');
    return result;
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    throw new Error('Falha ao cancelar agendamento.');
  }
}
