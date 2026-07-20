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
    numero_pedido: item.pedidos?.numero_pedido,
    nome_vendedor: item.pedidos?.nome_vendedor,
    status_pedido: item.pedidos?.status_pedido,
    data: item.pedidos?.created_at
  }));
}

export async function getPedidosDoProdutoAction(produtoId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('pedido_itens')
    .select(`
      id,
      quantidade,
      preco_unitario,
      subtotal,
      pedidos (
        id,
        numero_pedido,
        status_pedido,
        created_at,
        nome_cliente,
        nome_vendedor
      )
    `)
    .eq('produto_id', produtoId);

  if (error) {
    console.error('Erro ao buscar pedidos do produto:', error.message, error.details);
    return [];
  }

  return (data || [])
    .filter((item: any) => {
      const status = item.pedidos?.status_pedido;
      // Apenas pedidos que reservam estoque ativamente
      // Excluir: finalizado (baixou estoque físico), cancelado (liberou reserva), entregue (liberou reserva)
      return item.pedidos !== null &&
        item.pedidos !== undefined &&
        status !== 'finalizado' &&
        status !== 'cancelado' &&
        status !== 'entregue';
    })
    .sort((a: any, b: any) => {
      const dateA = a.pedidos?.created_at ? new Date(a.pedidos.created_at).getTime() : 0;
      const dateB = b.pedidos?.created_at ? new Date(b.pedidos.created_at).getTime() : 0;
      return dateB - dateA;
    })
    .map((item: any) => ({
      id: item.id,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario || 0,
      valor_total: item.subtotal || ((item.quantidade || 0) * (item.preco_unitario || 0)),
      pedido_id: item.pedidos?.id,
      numero_pedido: item.pedidos?.numero_pedido,
      status_pedido: item.pedidos?.status_pedido,
      created_at: item.pedidos?.created_at,
      cliente_nome: item.pedidos?.nome_cliente || 'Cliente não informado',
      vendedor_nome: item.pedidos?.nome_vendedor || 'Vendedor'
    }));
}
