import { createClient } from '@/utils/supabase/server';
import { Produto } from '@/models/types';

export async function getProdutos() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .order('nome_produto', { ascending: true });

  if (error) {
    console.error('Erro ao buscar produtos:', error);
    return [];
  }

  return data as Produto[];
}

export async function getProdutoById(id: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Erro ao buscar produto:', error);
    return null;
  }

  return data as Produto;
}

export async function upsertProduto(produto: Partial<Produto>) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('produtos')
    .upsert(produto)
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar produto:', error);
    throw error;
  }

  return data as Produto;
}

export async function toggleProdutoAtivo(id: string, ativo: boolean) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('produtos')
    .update({ ativo })
    .eq('id', id);

  if (error) {
    console.error('Erro ao alternar status do produto:', error);
    throw error;
  }
}
