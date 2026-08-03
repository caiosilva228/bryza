import type { SupabaseClient } from '@supabase/supabase-js';

export function normalizeCustomerPhone(value: unknown): string {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

export function normalizeCustomerCpf(value: unknown): string | null {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  return digits || null;
}

export function normalizeCustomerEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function normalizeCustomerIdentity(input: {
  phone?: unknown;
  cpf?: unknown;
  email?: unknown;
}) {
  return {
    phone: normalizeCustomerPhone(input.phone),
    cpf: normalizeCustomerCpf(input.cpf),
    email: normalizeCustomerEmail(input.email),
  };
}

export async function findCustomerByCanonicalIdentity(
  client: SupabaseClient,
  input: { phone?: unknown; cpf?: unknown; email?: unknown },
) {
  const identity = normalizeCustomerIdentity(input);
  const filters: string[] = [];
  if (identity.phone) filters.push(`telefone.eq.${identity.phone}`);
  if (identity.cpf) filters.push(`cpf.eq.${identity.cpf}`);
  if (filters.length > 0) {
    const { data, error } = await client
      .from('clientes')
      .select('*')
      .or(filters.join(','))
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (!identity.email) return null;
  const { data, error } = await client
    .from('clientes')
    .select('*')
    .eq('email', identity.email)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findAmbassadorByCanonicalIdentity(
  client: SupabaseClient,
  input: { phone?: unknown; cpf?: unknown; email?: unknown },
) {
  const identity = normalizeCustomerIdentity(input);
  const filters: string[] = [];
  if (identity.phone) filters.push(`phone.eq.${identity.phone}`);
  if (identity.cpf) filters.push(`cpf.eq.${identity.cpf}`);
  if (filters.length > 0) {
    const { data, error } = await client
      .from('ambassadors')
      .select('*')
      .or(filters.join(','))
      .eq('status', 'ativo')
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (!identity.email) return null;
  const { data, error } = await client
    .from('ambassadors')
    .select('*')
    .eq('email', identity.email)
    .eq('status', 'ativo')
    .not('user_id', 'is', null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertPublicCustomerCanonical(
  client: SupabaseClient,
  input: {
    fullName: string;
    phone: unknown;
    cpf?: unknown;
    email?: unknown;
    address?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    cep?: string;
    origin: string;
    referralCode?: string | null;
    source?: string;
  },
): Promise<{ customerId: string; personId: string; phone: string; cpf: string | null; email: string | null }> {
  const identity = normalizeCustomerIdentity(input);
  const { data, error } = await client.rpc('fn_upsert_public_customer_canonical', {
    p_customer_data: {
      nome: input.fullName.trim(),
      telefone: identity.phone,
      cpf: identity.cpf,
      email: identity.email,
      endereco: input.address || '',
      numero: input.number || '',
      bairro: input.neighborhood || '',
      cidade: input.city || '',
      estado: (input.state || '').trim().toUpperCase(),
      cep: input.cep || null,
      origem: input.origin,
    },
    p_referral_code: input.referralCode || null,
    p_source: input.source || 'public_checkout',
  });

  if (error || !data) {
    throw new Error(error?.message || 'Não foi possível resolver o cadastro canônico do cliente.');
  }

  const result = data as {
    status?: string;
    code?: string;
    customer_id?: string;
    person_id?: string;
  };
  if (result.status === 'manual_review_required') {
    throw new Error(`customer_identity_review_required:${result.code || 'identity_conflict'}`);
  }
  const customerId = String(result.customer_id || '');
  const personId = String(result.person_id || '');
  if (!customerId) throw new Error('canonical_customer_id_missing');
  if (!personId) throw new Error('canonical_person_id_missing');

  return {
    customerId,
    personId,
    phone: identity.phone,
    cpf: identity.cpf,
    email: identity.email,
  };
}
