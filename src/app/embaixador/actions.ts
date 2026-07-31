'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import {
  normalizeCommissionChart,
  removeGrossOrderValues,
} from '@/lib/ambassadors/portal-financial-data';

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
  phone: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  photo_path: string | null;
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
  comissao_aguardando: number | string;
  comissao_disponivel: number | string;
  total_recebido: number | string;
  first_purchase_bonus_total: number | string;
  lost_commission_total: number | string;
  lost_commission_month: number | string;
  activation: {
    status: 'qualified' | 'exception' | 'not_qualified';
    qualified: boolean;
    period_start: string;
    period_end: string;
    deadline: string;
    days_remaining: number;
    minimum_amount: number | string;
    personal_purchase_amount: number | string;
    deadline_passed: boolean;
  };
  clientes_indicados: number;
  rede_total: number;
  rede_ativos: number;
  rede_inativos: number;
  grafico_mensal: Array<{
    mes: string;
    vendas_qtd: number;
    comissao_valor: number;
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
  const safeColumns = 'id, parent_ambassador_id, full_name, display_name, username, phone, city, state, neighborhood, photo_path, status, created_at';

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
    phone: level === 1 ? item.phone : null, // Oculta WhatsApp dos níveis 2 e 3 por privacidade
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
  const admin = createAdminClient();
  const { data, error } = await supabase.rpc('fn_get_embaixador_dashboard_metrics');

  if (error) {
    console.error('Erro na RPC de dashboard do embaixador:', error);
    throw new Error(error.message || 'Erro ao carregar métricas do painel');
  }

  // Busca resumo da rede do embaixador (3 níveis)
  const { data: userAmbassador } = await supabase
    .from('ambassadors')
    .select('id')
    .single();

  let rede_total = 0;
  let rede_ativos = 0;
  let rede_inativos = 0;

  if (userAmbassador?.id) {
    const { data: l1 } = await admin
      .from('ambassadors')
      .select('id, status')
      .eq('parent_ambassador_id', userAmbassador.id);
    const l1Data = l1 || [];
    const l1Ids = l1Data.map((r) => r.id);

    const l2Data = l1Ids.length > 0
      ? (await admin.from('ambassadors').select('id, status').in('parent_ambassador_id', l1Ids)).data || []
      : [];
    const l2Ids = l2Data.map((r) => r.id);

    const l3Data = l2Ids.length > 0
      ? (await admin.from('ambassadors').select('id, status').in('parent_ambassador_id', l2Ids)).data || []
      : [];

    const all = [...l1Data, ...l2Data, ...l3Data];
    rede_total = all.length;
    rede_ativos = all.filter((m) => m.status === 'ativo').length;
    rede_inativos = all.filter((m) => m.status !== 'ativo').length;
  }

  const raw = data as AmbassadorDashboardMetrics & {
    vendas_mes_valor?: number | string;
    grafico_mensal?: Array<{
      mes: string;
      vendas_qtd?: number | string;
      vendas_valor?: number | string;
      comissao_valor: number | string;
    }>;
  };
  const safeData = { ...raw };
  Reflect.deleteProperty(safeData, 'vendas_mes_valor');

  return {
    ...safeData,
    grafico_mensal: normalizeCommissionChart(raw.grafico_mensal),
    rede_total,
    rede_ativos,
    rede_inativos,
  } as AmbassadorDashboardMetrics;
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

  const result = data as { items: Record<string, unknown>[]; total: number };
  return {
    ...result,
    items: removeGrossOrderValues(result.items),
  };
}

// 4. Minhas Comissões Paginadas
export type AmbassadorOwnOrder = {
  entity_type: 'pedido' | 'agendamento';
  entity_id: string;
  numero: string;
  created_at: string;
  valor_total: number | string;
  fulfillment_status: string;
  payment_timing: 'agora' | 'na_entrega';
  payment_status:
    | 'pendente'
    | 'processando'
    | 'aprovado'
    | 'recusado'
    | 'cancelado'
    | 'expirado'
    | 'reembolsado'
    | 'chargeback'
    | 'em_analise';
  payment_source: 'mercado_pago' | 'entrega' | 'manual';
  paid_at: string | null;
  can_pay_now: boolean;
};

export type AmbassadorOwnOrdersData = {
  items: AmbassadorOwnOrder[];
  total: number;
};

export async function getMeusPedidos(
  params?: { page?: number; limit?: number; status?: string },
): Promise<AmbassadorOwnOrdersData> {
  const { supabase } = await getAuthenticatedUser();
  const limit = Math.min(Math.max(params?.limit || 10, 1), 50);
  const page = Math.max(params?.page || 1, 1);
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc('fn_embaixador_meus_pedidos', {
    p_limit: limit,
    p_offset: offset,
    p_status: params?.status || null,
  });

  if (error) {
    console.error('Erro na RPC de pedidos próprios do embaixador:', error.code);
    throw new Error(error.message || 'Erro ao carregar seus pedidos');
  }

  const result = data as AmbassadorOwnOrdersData | null;
  return {
    items: Array.isArray(result?.items) ? result.items : [],
    total: Number(result?.total || 0),
  };
}

export async function getMinhasComissoes(params?: { page?: number; limit?: number; status?: string }) {
  const { supabase } = await getAuthenticatedUser();
  const limit = Math.min(Math.max(params?.limit || 10, 1), 100);
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

export type WithdrawalRequestSummary = {
  id: string;
  amount: number | string;
  created_at: string;
  commission_count: number;
};

export type WithdrawalOverview = {
  available_amount: number | string;
  available_commission_count: number;
  minimum_payment_amount: number | string;
  payment_frequency: 'semanal' | 'quinzenal' | 'mensal';
  program_status: string;
  pix_key_type: string | null;
  pix_key_masked: string | null;
  can_request: boolean;
  blocked_reason:
    | 'program_inactive'
    | 'pending_request'
    | 'pix_missing'
    | 'below_minimum'
    | 'no_available_commissions'
    | null;
  pending_request: WithdrawalRequestSummary | null;
};

export type AmbassadorPayment = {
  id: string;
  created_at: string;
  paid_at: string | null;
  amount: number | string;
  payment_method: string;
  status: 'pendente' | 'processando' | 'paga' | 'cancelada' | 'estornada';
  notes: string | null;
  is_withdrawal_request: boolean;
  has_receipt: boolean;
};

export type AmbassadorPaymentsData = {
  items: AmbassadorPayment[];
  total: number;
  withdrawal: WithdrawalOverview;
};

// 5. Meus Pagamentos e Solicitações de Saque
export async function getMeusPagamentos(
  params?: { page?: number; limit?: number },
): Promise<AmbassadorPaymentsData> {
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

  return data as AmbassadorPaymentsData;
}

export async function solicitarSaqueComissoes() {
  const { supabase } = await getAuthenticatedUser();
  const { data, error } = await supabase.rpc('fn_solicitar_saque_comissoes');

  if (error) {
    console.error('Erro ao solicitar saque:', error.code);
    throw new Error(error.message || 'Não foi possível solicitar o saque.');
  }

  revalidatePath('/embaixador/pagamentos');
  revalidatePath('/embaixador/dashboard');
  return data as {
    success: boolean;
    request_id: string;
    amount: number | string;
    message: string;
    idempotent?: boolean;
  };
}

export async function cancelarSolicitacaoSaque(requestId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error('Solicitação inválida.');
  }

  const { supabase } = await getAuthenticatedUser();
  const { data, error } = await supabase.rpc('fn_cancelar_solicitacao_saque', {
    p_request_id: requestId,
  });

  if (error) {
    console.error('Erro ao cancelar solicitação de saque:', error.code);
    throw new Error(error.message || 'Não foi possível cancelar a solicitação.');
  }

  revalidatePath('/embaixador/pagamentos');
  revalidatePath('/embaixador/dashboard');
  return data as { success: boolean; message: string };
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
  pix_type?: string | null;
  pix_key?: string | null;
  photo_path?: string | null;
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

  if (normalizedPhone) {
    const { data: identityResult, error: identityError } = await supabase.rpc(
      'fn_update_my_profile_canonical',
      {
        p_full_name: null,
        p_phone: normalizedPhone,
      }
    );
    if (identityError) throw new Error(identityError.message);
    if ((identityResult as { status?: string })?.status === 'manual_review_required') {
      throw new Error('O telefone informado exige revisão administrativa.');
    }
  }

  const { data, error } = await supabase.rpc('fn_update_meu_perfil', {
    p_phone: null,
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

export async function getPublicPromotionalMaterialsAction(): Promise<{
  success: boolean;
  materials?: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    file_url: string;
    file_name: string | null;
    file_type: string | null;
    created_at: string;
  }>;
  error?: string;
}> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('promotional_materials')
      .select('id, title, description, category, file_url, file_name, file_type, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar materiais de divulgação públicos:', error);
      return { success: false, error: 'Erro ao carregar materiais.' };
    }

    return { success: true, materials: data || [] };
  } catch (err: any) {
    console.error('Erro inesperado em getPublicPromotionalMaterialsAction:', err);
    return { success: false, error: 'Erro inesperado ao carregar materiais.' };
  }
}
