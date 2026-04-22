'use server';

import { revalidatePath } from 'next/cache';
import * as produtoService from '@/services/produtos';
import { Produto } from '@/models/types';

export async function fetchProdutos() {
  return await produtoService.getProdutos();
}

export async function saveProduto(produto: Partial<Produto>) {
  try {
    const data = await produtoService.upsertProduto(produto);
    revalidatePath('/produtos');
    revalidatePath('/estoque'); // Revalida estoque pois produtos aparecem lá
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Erro ao salvar produto' };
  }
}

export async function toggleStatusProduto(id: string, ativo: boolean) {
  try {
    await produtoService.toggleProdutoAtivo(id, ativo);
    revalidatePath('/produtos');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro ao alterar status do produto' };
  }
}
