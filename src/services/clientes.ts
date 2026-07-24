import { createClient } from '@/utils/supabase/server';
import { AmbassadorAssignmentOption, Cliente } from '@/models/types';

export const getClientes = async (): Promise<Cliente[]> => {
  const supabase = await createClient();
  // Pela política de RLS:
  // - Vendedor só vê seus próprios clientes
  // - Admin vê todos
  const { data, error } = await supabase
    .from('clientes')
    .select(`
      *,
      vendedor:profiles!vendedor_responsavel_id(nome, codigo_vendedor),
      indicated_by:ambassadors!clientes_commissionable_ambassador_id_fkey(
        id,
        full_name,
        referral_code,
        status
      ),
      own_ambassador:ambassadors!clientes_own_ambassador_id_fkey(
        id,
        full_name,
        referral_code,
        status
      )
    `)
    .neq('lifecycle_status', 'archived')
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
    .select(`
      *,
      vendedor:profiles!vendedor_responsavel_id(nome, codigo_vendedor),
      indicated_by:ambassadors!clientes_commissionable_ambassador_id_fkey(
        id,
        full_name,
        referral_code,
        status
      ),
      own_ambassador:ambassadors!clientes_own_ambassador_id_fkey(
        id,
        full_name,
        referral_code,
        status
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Erro ao buscar cliente ${id}:`, error);
    return null;
  }

  return data as Cliente;
};

export const getActiveAmbassadorsForCustomerAssignment = async (): Promise<AmbassadorAssignmentOption[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_search_active_ambassadors', {
    p_query: '',
  });

  if (error) {
    // Sellers cannot assign ambassadors; for them the form intentionally receives no options.
    if (error.code === '42501') return [];
    console.error('Erro ao buscar embaixadores ativos:', error);
    return [];
  }

  return (data || []) as AmbassadorAssignmentOption[];
};

export const createCliente = async (cliente: Partial<Cliente>): Promise<Cliente | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_upsert_customer_canonical', {
    p_customer_id: null,
    p_full_name: cliente.nome || '',
    p_phone: cliente.telefone || '',
    p_email: cliente.email || null,
    p_cpf: cliente.cpf || null,
    p_cep: cliente.cep || null,
    p_address: cliente.endereco || '',
    p_number: cliente.numero || null,
    p_neighborhood: cliente.bairro || '',
    p_city: cliente.cidade || '',
    p_state: cliente.estado || '',
    p_origin: cliente.origem || 'cadastro_administrativo',
    p_customer_status: cliente.status_cliente || 'lead',
    p_commercial_profile_id: cliente.vendedor_responsavel_id || null,
    p_latitude: cliente.latitude || null,
    p_longitude: cliente.longitude || null,
    p_ambassador_id: null,
    p_assignment_reason: null,
    p_idempotency_key: crypto.randomUUID(),
  });

  if (error) {
    console.error('Erro ao criar cliente:', error);
    return null;
  }

  const result = data as { status?: string; customer_id?: string };
  if (!result.customer_id || result.status === 'manual_review_required') return null;
  return getClienteById(result.customer_id);
};

export const updateCliente = async (id: string, cliente: Partial<Cliente>): Promise<Cliente | null> => {
  const supabase = await createClient();
  const current = await getClienteById(id);
  if (!current) return null;
  const merged = { ...current, ...cliente };
  const { data, error } = await supabase.rpc('fn_upsert_customer_canonical', {
    p_customer_id: id,
    p_full_name: merged.nome,
    p_phone: merged.telefone,
    p_email: merged.email || null,
    p_cpf: merged.cpf || null,
    p_cep: merged.cep || null,
    p_address: merged.endereco,
    p_number: merged.numero || null,
    p_neighborhood: merged.bairro,
    p_city: merged.cidade,
    p_state: merged.estado,
    p_origin: merged.origem,
    p_customer_status: merged.status_cliente,
    p_commercial_profile_id: merged.vendedor_responsavel_id || null,
    p_latitude: merged.latitude || null,
    p_longitude: merged.longitude || null,
    p_ambassador_id: null,
    p_assignment_reason: null,
    p_idempotency_key: crypto.randomUUID(),
  });

  if (error) {
    console.error(`Erro ao atualizar cliente ${id}:`, error);
    return null;
  }

  const result = data as { status?: string; customer_id?: string };
  if (result.status === 'manual_review_required') return null;
  return getClienteById(result.customer_id || id);
};
