'use server';

import { getVendaById } from '@/services/vendas';

export async function getVendaByIdAction(id: string) {
  try {
    return await getVendaById(id);
  } catch (error) {
    console.error('Erro ao buscar detalhes da venda:', error);
    throw new Error('Falha ao carregar detalhes da venda.');
  }
}
