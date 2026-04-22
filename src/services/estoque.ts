import { createClient } from '@/utils/supabase/server';
import { Produto, EstoqueMovimentacao, TipoMovimento, OrigemMovimento } from '@/models/types';

export const getItensEstoque = async (filtros?: { 
  nome?: string; 
  categoria?: string; 
  status?: 'ok' | 'baixo' | 'critico' 
}): Promise<Produto[]> => {
  const supabase = await createClient();
  let query = supabase.from('produtos').select('*').order('nome_produto', { ascending: true });

  if (filtros?.nome) {
    query = query.ilike('nome_produto', `%${filtros.nome}%`);
  }
  
  if (filtros?.categoria) {
    query = query.eq('categoria', filtros.categoria);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar estoque:', error);
    return [];
  }

  const produtos = data as Produto[];

  if (filtros?.status) {
    return produtos.filter(p => {
      const statusActual = p.estoque_atual <= 0 ? 'critico' : p.estoque_atual <= p.estoque_minimo ? 'baixo' : 'ok';
      return statusActual === filtros.status;
    });
  }

  return produtos;
};

export const getEstoqueStats = async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('produtos').select('estoque_atual, estoque_minimo, custo_unitario');

  if (error) {
    console.error('Erro ao buscar estatísticas de estoque:', error);
    return {
      totalProdutos: 0,
      totalUnidades: 0,
      estoqueBaixo: 0,
      valorTotal: 0
    };
  }

  const stats = data.reduce((acc, curr) => {
    acc.totalProdutos += 1;
    acc.totalUnidades += curr.estoque_atual;
    if (curr.estoque_atual <= curr.estoque_minimo) {
      acc.estoqueBaixo += 1;
    }
    acc.valorTotal += (curr.estoque_atual * curr.custo_unitario);
    return acc;
  }, {
    totalProdutos: 0,
    totalUnidades: 0,
    estoqueBaixo: 0,
    valorTotal: 0
  });

  return stats;
};

export const registrarMovimentacao = async (mov: {
  produto_id: string;
  tipo: TipoMovimento;
  quantidade: number;
  origem: OrigemMovimento;
  observacoes?: string;
  usuario_id: string;
}): Promise<{ success: boolean; error?: string }> => {
  const supabase = await createClient();

  // 1. Buscar estoque atual
  const { data: produto, error: errorProd } = await supabase
    .from('produtos')
    .select('estoque_atual')
    .eq('id', mov.produto_id)
    .single();

  if (errorProd || !produto) return { success: false, error: 'Produto não encontrado' };

  // 2. Calcular novo estoque
  const novaQuantidade = mov.tipo === 'entrada' 
    ? produto.estoque_atual + mov.quantidade 
    : mov.tipo === 'saida' 
      ? produto.estoque_atual - mov.quantidade 
      : mov.quantidade; // Ajuste direto

  // 3. Registrar movimentação
  const { error: errorMov } = await supabase.from('estoque_movimentacao').insert({
    produto_id: mov.produto_id,
    usuario_id: mov.usuario_id,
    tipo_movimento: mov.tipo,
    quantidade: mov.quantidade,
    origem: mov.origem,
    observacoes: mov.observacoes
  });

  if (errorMov) return { success: false, error: 'Erro ao registrar histórico' };

  // 4. Atualizar saldo no produto
  const { error: errorUpdate } = await supabase
    .from('produtos')
    .update({ estoque_atual: novaQuantidade })
    .eq('id', mov.produto_id);

  if (errorUpdate) return { success: false, error: 'Erro ao atualizar saldo' };

  return { success: true };
};

export const getHistoricoProduto = async (produtoId: string): Promise<(EstoqueMovimentacao & { usuario?: { nome: string } })[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estoque_movimentacao')
    .select('*, usuario:profiles(nome)')
    .eq('produto_id', produtoId)
    .order('data_movimento', { ascending: false });

  if (error) {
    console.error('Erro ao buscar histórico do produto:', error);
    return [];
  }

  return data as (EstoqueMovimentacao & { usuario?: { nome: string } })[];
};
