'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

// Helper de validação do usuário logado
async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Sessão inválida');
  }
  return { supabase, user };
}

export type NetworkMember = {
  id: string;
  parent_ambassador_id: string | null;
  full_name: string;
  display_name: string | null;
  username: string;
  city: string | null;
  state: string | null;
  status: 'pendente' | 'ativo' | 'inativo' | 'bloqueado';
  created_at: string;
  level: 1 | 2 | 3;
  sponsor_name: string;
};

type NetworkRow = Omit<NetworkMember, 'level' | 'sponsor_name'>;

export type AmbassadorDashboardMetrics = {
  referral_code: string | null;
  display_name: string | null;
  photo_path: string | null;
  vendas_mes_qtd: number;
  vendas_mes_valor: number | string;
  comissao_aguardando: number | string;
  comissao_disponivel: number | string;
  total_recebido: number | string;
  first_purchase_bonus_total: number | string;
  clientes_indicados: number;
  grafico_mensal: Array<{
    mes: string;
    vendas_valor: number | string;
  }>;
};

export type AmbassadorProfileData = {
  referral_code: string;
  display_name: string;
  phone: string;
  instagram: string;
  city: string;
  state: string;
  cep: string;
  address: string;
  number: string;
  neighborhood: string;
  latitude: string;
  longitude: string;
  pix_type: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'chave_aleatoria';
  pix_key_masked: string;
  photo_path: string | null;
  allow_pix_edit: boolean;
  require_pix_change_approval: boolean;
};

// Rede descendente do embaixador autenticado, limitada aos três níveis do plano.
export async function getMinhaRede() {
  const { user } = await getAuthenticatedUser();
  const admin = createAdminClient();
  const safeColumns = 'id, parent_ambassador_id, full_name, display_name, username, city, state, status, created_at';

  const { data: owner, error: ownerError } = await admin
    .from('ambassadors')
    .select('id, full_name, display_name')
    .eq('user_id', user.id)
    .single();

  if (ownerError || !owner) {
    throw new Error('Embaixador não encontrado para a sessão atual.');
  }

  async function getChildren(parentIds: string[]) {
    if (parentIds.length === 0) return [] as NetworkRow[];

    const { data, error } = await admin
      .from('ambassadors')
      .select(safeColumns)
      .in('parent_ambassador_id', parentIds)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao carregar nível da rede do embaixador:', error);
      throw new Error('Não foi possível carregar sua rede.');
    }

    return (data || []) as NetworkRow[];
  }

  const level1Rows = await getChildren([owner.id]);
  const level2Rows = await getChildren(level1Rows.map((item) => item.id));
  const level3Rows = await getChildren(level2Rows.map((item) => item.id));
  const names = new Map<string, string>([
    [owner.id, owner.display_name || owner.full_name],
    ...level1Rows.map((item) => [item.id, item.display_name || item.full_name] as [string, string]),
    ...level2Rows.map((item) => [item.id, item.display_name || item.full_name] as [string, string]),
  ]);

  const withLevel = (rows: NetworkRow[], level: 1 | 2 | 3): NetworkMember[] => rows.map((item) => ({
    ...item,
    level,
    sponsor_name: item.parent_ambassador_id ? names.get(item.parent_ambassador_id) || 'Patrocinador' : '—',
  }));

  const items = [
    ...withLevel(level1Rows, 1),
    ...withLevel(level2Rows, 2),
    ...withLevel(level3Rows, 3),
  ];

  return {
    items,
    counts: {
      total: items.length,
      level1: level1Rows.length,
      level2: level2Rows.length,
      level3: level3Rows.length,
    },
  };
}

// 1. Dashboard e Métricas do Embaixador
export async function getPortalDashboardData() {
  const { supabase } = await getAuthenticatedUser();
  const { data, error } = await supabase.rpc('fn_get_embaixador_dashboard_metrics');

  if (error) {
    console.error('Erro na RPC de dashboard do embaixador:', error);
    throw new Error(error.message || 'Erro ao carregar métricas do painel');
  }

  return data as AmbassadorDashboardMetrics;
}

function maskOwnPix(value: string | null) {
  if (!value) return '';
  if (value.length <= 6) return '******';
  return `${value.slice(0, 3)}${'*'.repeat(Math.max(value.length - 6, 4))}${value.slice(-3)}`;
}

export async function getMeuPerfilData(): Promise<AmbassadorProfileData> {
  const { user } = await getAuthenticatedUser();
  const admin = createAdminClient();
  const [{ data: ambassador, error: ambassadorError }, { data: settings, error: settingsError }] = await Promise.all([
    admin
      .from('ambassadors')
      .select('referral_code, display_name, full_name, phone, instagram, city, state, cep, address, number, neighborhood, latitude, longitude, pix_key_type, pix_key, photo_path, status')
      .eq('user_id', user.id)
      .single(),
    admin
      .from('ambassador_program_settings')
      .select('allow_pix_edit, require_pix_change_approval')
      .eq('singleton', true)
      .single(),
  ]);

  if (ambassadorError || !ambassador || ambassador.status !== 'ativo') {
    throw new Error('Perfil de embaixador não encontrado ou inativo.');
  }
  if (settingsError || !settings) {
    throw new Error('Não foi possível carregar as regras do programa.');
  }

  const pixTypes = ['cpf', 'cnpj', 'email', 'telefone', 'chave_aleatoria'] as const;
  const pixType = pixTypes.includes(ambassador.pix_key_type as typeof pixTypes[number])
    ? ambassador.pix_key_type as typeof pixTypes[number]
    : 'chave_aleatoria';

  return {
    referral_code: ambassador.referral_code,
    display_name: ambassador.display_name || ambassador.full_name,
    phone: ambassador.phone || '',
    instagram: ambassador.instagram || '',
    city: ambassador.city || '',
    state: ambassador.state || '',
    cep: ambassador.cep || '',
    address: ambassador.address || '',
    number: ambassador.number || '',
    neighborhood: ambassador.neighborhood || '',
    latitude: ambassador.latitude?.toString() || '',
    longitude: ambassador.longitude?.toString() || '',
    pix_type: pixType,
    pix_key_masked: maskOwnPix(ambassador.pix_key),
    photo_path: ambassador.photo_path || null,
    allow_pix_edit: Boolean(settings.allow_pix_edit),
    require_pix_change_approval: Boolean(settings.require_pix_change_approval),
  };
}

// 2. Minhas Indicações Paginadas
export type AmbassadorReferral = {
  id: string;
  cliente_nome_mascarado: string;
  created_at: string;
  referral_source: string | null;
  is_locked: boolean;
  total_pedidos: number;
  valor_aprovado_total: number | string;
  is_active: boolean;
  activation_status: boolean | 'ativo' | 'ativado' | 'active' | 'nao_ativo' | 'pendente' | 'inativo' | null;
  activated_at: string | null;
  activation_order_code?: string | null;
};

export async function getMinhasIndicacoes(params?: { page?: number; limit?: number; status?: string }) {
  const { supabase } = await getAuthenticatedUser();
  const limit = Math.min(Math.max(params?.limit || 10, 1), 50);
  const page = Math.max(params?.page || 1, 1);
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc('fn_get_embaixador_indicacoes', {
    p_limit: limit,
    p_offset: offset,
    p_status: params?.status || null
  });

  if (error) {
    console.error('Erro na RPC de indicações:', error);
    throw new Error(error.message || 'Erro ao carregar indicações');
  }

  return data as { items: AmbassadorReferral[]; total: number };
}

// 3. Minhas Vendas Paginadas
export async function getMinhasVendas(params?: { page?: number; limit?: number; status?: string }) {
  const { supabase } = await getAuthenticatedUser();
  const limit = Math.min(Math.max(params?.limit || 10, 1), 50);
  const page = Math.max(params?.page || 1, 1);
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc('fn_get_embaixador_vendas', {
    p_limit: limit,
    p_offset: offset,
    p_status_pedido: params?.status || null
  });

  if (error) {
    console.error('Erro na RPC de vendas:', error);
    throw new Error(error.message || 'Erro ao carregar vendas');
  }

  return data as { items: any[]; total: number };
}

// 4. Minhas Comissões Paginadas
export async function getMinhasComissoes(params?: { page?: number; limit?: number; status?: string }) {
  const { supabase } = await getAuthenticatedUser();
  const limit = Math.min(Math.max(params?.limit || 10, 1), 50);
  const page = Math.max(params?.page || 1, 1);
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc('fn_get_embaixador_comissoes', {
    p_limit: limit,
    p_offset: offset,
    p_status: params?.status || null
  });

  if (error) {
    console.error('Erro na RPC de comissões:', error);
    throw new Error(error.message || 'Erro ao carregar comissões');
  }

  return data as { items: any[]; total: number };
}

// 5. Meus Pagamentos Paginados
export async function getMeusPagamentos(params?: { page?: number; limit?: number }) {
  const { supabase } = await getAuthenticatedUser();
  const limit = Math.min(Math.max(params?.limit || 10, 1), 50);
  const page = Math.max(params?.page || 1, 1);
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc('fn_get_embaixador_pagamentos', {
    p_limit: limit,
    p_offset: offset
  });

  if (error) {
    console.error('Erro na RPC de pagamentos:', error);
    throw new Error(error.message || 'Erro ao carregar pagamentos');
  }

  return data as { items: any[]; total: number };
}

// 6. Signed URL de Comprovante de Pagamento (Com Validação Estrita em Cascata no Banco)
export async function getComprovantePaymentUrl(paymentId: string) {
  const { supabase, user } = await getAuthenticatedUser();

  // Validação em cascata no banco: paymentId pertence ao ambassador do user.id?
  const { data: cp, error: cpError } = await supabase
    .from('commission_payments')
    .select(`
      id,
      receipt_path,
      ambassador:ambassador_id!inner(user_id)
    `)
    .eq('id', paymentId)
    .single();

  if (cpError || !cp || !cp.receipt_path) {
    throw new Error('Comprovante não encontrado ou acesso não autorizado');
  }

  const ambUserId = (cp.ambassador as any)?.user_id;
  if (ambUserId !== user.id) {
    throw new Error('Acesso não autorizado ao comprovante');
  }

  // Gerar signed URL temporária de 5 minutos no storage privado payment-receipts
  const adminClient = createAdminClient();
  const { data, error: urlError } = await adminClient.storage
    .from('payment-receipts')
    .createSignedUrl(cp.receipt_path, 300);

  if (urlError || !data?.signedUrl) {
    throw new Error('Erro ao gerar link de acesso ao comprovante');
  }

  return data.signedUrl;
}

// 7. Atualização do Perfil Próprio do Embaixador (Somente campos autorizados)
export async function atualizarMeuPerfil(payload: {
  phone?: string;
  instagram?: string;
  city?: string;
  state?: string;
  cep?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  latitude?: string;
  longitude?: string;
  pix_type?: string;
  pix_key?: string;
  photo_path?: string;
}) {
  const { supabase, user } = await getAuthenticatedUser();
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from('ambassadors')
    .select('pix_key_type, pix_key')
    .eq('user_id', user.id)
    .single();
  if (currentError || !current) throw new Error('Não foi possível validar o perfil atual.');

  const normalizedPhone = payload.phone !== undefined ? payload.phone.replace(/[^0-9]/g, '') : null;
  if (normalizedPhone && !/^[0-9]{10,11}$/.test(normalizedPhone)) {
    throw new Error('Informe um telefone com DDD válido.');
  }
  const normalizedState = payload.state !== undefined ? payload.state.trim().toUpperCase() : null;
  if (normalizedState && !/^[A-Z]{2}$/.test(normalizedState)) throw new Error('Informe uma UF válida.');
  const normalizedPixType = payload.pix_type === 'pix' || payload.pix_type === 'outro'
    ? 'chave_aleatoria'
    : payload.pix_type || null;
  if (normalizedPixType && !['cpf', 'cnpj', 'email', 'telefone', 'chave_aleatoria'].includes(normalizedPixType)) {
    throw new Error('Tipo de chave Pix inválido.');
  }
  const normalizedPixKey = payload.pix_key?.trim() && !payload.pix_key.includes('*') ? payload.pix_key.trim() : null;
  const pixChanged = (normalizedPixType !== null && normalizedPixType !== current.pix_key_type)
    || (normalizedPixKey !== null && normalizedPixKey !== current.pix_key);

  if (pixChanged) {
    const { data: settings, error: settingsError } = await admin
      .from('ambassador_program_settings')
      .select('allow_pix_edit, require_pix_change_approval')
      .eq('singleton', true)
      .single();
    if (settingsError || !settings) throw new Error('Não foi possível validar a política de chave Pix.');
    if (!settings.allow_pix_edit) throw new Error('A edição da chave Pix está desativada pelo administrador.');
    if (settings.require_pix_change_approval) {
      throw new Error('Alterações de chave Pix exigem aprovação. Solicite a mudança à administração.');
    }
  }

  const { data, error } = await supabase.rpc('fn_update_meu_perfil', {
    p_phone: normalizedPhone,
    p_instagram: payload.instagram !== undefined ? payload.instagram.trim() : null,
    p_city: payload.city !== undefined ? payload.city.trim() : null,
    p_state: normalizedState,
    p_pix_type: normalizedPixType,
    p_pix_key: normalizedPixKey,
    p_photo_path: payload.photo_path || null
  });

  if (error) {
    console.error('Erro ao atualizar perfil do embaixador:', error);
    throw new Error(error.message || 'Falha ao atualizar perfil');
  }

  // Update additional address fields directly since the RPC doesn't cover them
  const { error: addressError } = await admin.from('ambassadors')
    .update({
      cep: payload.cep !== undefined ? payload.cep : null,
      address: payload.address !== undefined ? payload.address : null,
      number: payload.number !== undefined ? payload.number : null,
      neighborhood: payload.neighborhood !== undefined ? payload.neighborhood : null,
      latitude: payload.latitude ? Number(payload.latitude) : null,
      longitude: payload.longitude ? Number(payload.longitude) : null,
    })
    .eq('user_id', user.id);

  if (addressError) {
    console.error('Erro ao atualizar endereço do embaixador:', addressError);
  }

  revalidatePath('/embaixador/perfil');
  revalidatePath('/embaixador/dashboard');
  return data;
}

// 8. Signed URL de Foto Própria do Embaixador
export async function getSignedProfilePhotoUrl(photoPath: string) {
  const { user } = await getAuthenticatedUser();

  if (!photoPath.startsWith(`${user.id}/`) && !photoPath.includes(user.id)) {
    // Validação de diretório de foto própria
    const adminClient = createAdminClient();
    const { data: amb } = await adminClient
      .from('ambassadors')
      .select('photo_path')
      .eq('user_id', user.id)
      .single();

    if (!amb || amb.photo_path !== photoPath) {
      throw new Error('Acesso negado à foto solicitada');
    }
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.storage
    .from('ambassador-photos')
    .createSignedUrl(photoPath, 300);

  if (error || !data) return null;
  return data.signedUrl;
}
