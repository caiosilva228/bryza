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
  
  const payload: { ativo: boolean; ativo_loja?: boolean } = { ativo };
  if (!ativo) {
    payload.ativo_loja = false;
  }

  const { error } = await supabase
    .from('produtos')
    .update(payload)
    .eq('id', id);

  if (error) {
    console.error('Erro ao alternar status do produto:', error);
    throw error;
  }
}

export async function toggleProdutoAtivoLoja(id: string, ativo_loja: boolean) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('produtos')
    .update({ ativo_loja })
    .eq('id', id);

  if (error) {
    console.error('Erro ao alternar visibilidade na loja:', error);
    throw error;
  }
}
