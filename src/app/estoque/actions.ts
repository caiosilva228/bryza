'use server';

import { registrarMovimentacao, getHistoricoProduto } from '@/services/estoque';
import { TipoMovimento, OrigemMovimento } from '@/models/types';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function registrarMovimentacaoAction(formData: {
  produtoId: string;
  tipo: TipoMovimento;
  quantidade: number;
  origem: OrigemMovimento;
  observacoes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado' };
  }

  const result = await registrarMovimentacao({
    produto_id: formData.produtoId,
    tipo: formData.tipo,
    quantidade: formData.quantidade,
    origem: formData.origem,
    observacoes: formData.observacoes,
    usuario_id: user.id
  });

  if (result.success) {
    revalidatePath('/estoque');
  }

  return result;
}

export async function getHistoricoProdutoAction(produtoId: string) {
  return await getHistoricoProduto(produtoId);
}

export async function getReservasProdutoAction(produtoId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('pedido_itens')
    .select(`
      quantidade,
      pedidos (
        numero_pedido,
        nome_vendedor,
        status_pedido,
        created_at
      )
    `)
    .eq('produto_id', produtoId)
    .not('pedidos.status_pedido', 'in', '("finalizado","cancelado")');

  if (error) {
    console.error('Erro ao buscar reservas:', error);
    return [];
  }

  return data.map((item: any) => ({
    quantidade: item.quantidade,
    numero_pedido: item.pedidos.numero_pedido,
    nome_vendedor: item.pedidos.nome_vendedor,
    status_pedido: item.pedidos.status_pedido,
    data: item.pedidos.created_at
  }));
}
