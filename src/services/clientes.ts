import { createClient } from '@/utils/supabase/server';
import { Cliente } from '@/models/types';

export const getClientes = async (): Promise<Cliente[]> => {
  const supabase = await createClient();
  // Pela política de RLS:
  // - Vendedor só vê seus próprios clientes
  // - Admin vê todos
  const { data, error } = await supabase
    .from('clientes')
    .select('*, vendedor:profiles(nome, codigo_vendedor)')
    .order('data_cadastro', { ascending: false });

  if (error) {
    console.error('Erro ao buscar clientes detalhado:', JSON.stringify(error));
    return [];
  }

  return data as Cliente[];
};

export const getClienteById = async (id: string): Promise<Cliente | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Erro ao buscar cliente ${id}:`, error);
    return null;
  }

  return data as Cliente;
};

export const createCliente = async (cliente: Partial<Cliente>): Promise<Cliente | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clientes')
    .insert(cliente)
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar cliente:', error);
    return null;
  }

  return data as Cliente;
};

export const updateCliente = async (id: string, cliente: Partial<Cliente>): Promise<Cliente | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clientes')
    .update(cliente)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Erro ao atualizar cliente ${id}:`, error);
    return null;
  }

  return data as Cliente;
};
