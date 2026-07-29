'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { generateIpHash } from '@/lib/referral/ip-hash';
import { getSyntheticEmail } from '@/utils/env';

// Helpers de Mascaramento
function maskCPF(cpf: string): string {
  if (!cpf || cpf.length !== 11) return cpf;
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`;
}

function maskPix(key: string, type: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (type === 'email') {
    const parts = trimmed.split('@');
    if (parts.length === 2) {
      const name = parts[0];
      const domain = parts[1];
      if (name.length > 2) {
        return `${name[0]}***${name[name.length - 1]}@${domain}`;
      }
      return `***@${domain}`;
    }
  } else if (type === 'telefone') {
    if (trimmed.length > 4) {
      return `${trimmed.slice(0, 5)}****${trimmed.slice(trimmed.length - 4)}`;
    }
  } else if (type === 'cpf') {
    return maskCPF(trimmed);
  }
  if (trimmed.length > 6) {
    return `${trimmed.slice(0, 3)}****${trimmed.slice(trimmed.length - 3)}`;
  }
  return '********';
}

function getIpHash(reqHeaders: Headers): string {
  const ip = reqHeaders.get('x-nf-client-connection-ip') || reqHeaders.get('client-ip') || 'unknown-ip';
  return generateIpHash(ip);
}

// Validar se o usuário logado é Admin Ativo
async function checkAdminAccess() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Não autorizado');

  // A identidade vem da sessão validada acima. A leitura administrativa do
  // perfil não deve depender das policies de SELECT da tabela profiles.
  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Erro ao validar perfil administrativo:', profileError);
    throw new Error('Não foi possível validar o acesso administrativo');
  }

  if (!profile || profile.ativo !== true || profile.role !== 'admin') {
    throw new Error('Acesso negado');
  }

  return user;
}

// 1. Listagem Paginada Segura (Server Action)
export async function getEmbaixadoresPaginados(params: {
  limit: number;
  offset: number;
  search?: string;
  cpf?: string;
  city?: string;
  status?: string;
  planId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const admin = await checkAdminAccess();
  const adminClient = createAdminClient();

  const cleanCpf = params.cpf ? params.cpf.replace(/\D/g, '') : null;

  // Invocar RPC via service_role
  const { data, error } = await adminClient.rpc('fn_get_embaixadores_paginados', {
    p_limit: params.limit,
    p_offset: params.offset,
    p_search: params.search || null,
    p_cpf: cleanCpf || null,
    p_city: params.city || null,
    p_status: params.status || null,
    p_plan_id: params.planId || null,
    p_start_date: params.startDate || null,
    p_end_date: params.endDate || null,
    p_sort_by: params.sortBy || null,
    p_sort_order: params.sortOrder || 'desc',
  });

  if (error) {
    console.error('Erro na RPC de paginação:', error);
    throw new Error('Erro ao listar embaixadores');
  }

  const result = data as { items: any[]; total: number };

  // Retornar items com CPF mascarado por padrão
  const maskedItems = (result.items || []).map((item: any) => ({
    ...item,
    cpf: item.cpf ? maskCPF(item.cpf) : undefined
  }));

  return {
    items: maskedItems,
    total: result.total || 0
  };
}

// 2. Detalhes de Embaixador Mascarado
export async function getEmbaixadorDetails(id: string) {
  await checkAdminAccess();
  const adminClient = createAdminClient();

  const { data: amb, error } = await adminClient
    .from('ambassadors')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Erro ao consultar embaixador:', error);
    throw new Error('Falha ao carregar os dados do embaixador');
  }

  if (!amb) {
    throw new Error('Embaixador não encontrado');
  }

  const [planResult, parentResult] = await Promise.all([
    amb.commission_plan_id
      ? adminClient
          .from('commission_plans')
          .select('id, name, direct_percentage, level_2_percentage, level_3_percentage, multilevel_enabled')
          .eq('id', amb.commission_plan_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    amb.parent_ambassador_id
      ? adminClient
          .from('ambassadors')
          .select('id, full_name, username')
          .eq('id', amb.parent_ambassador_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (planResult.error || parentResult.error) {
    console.error('Erro ao consultar relacionamentos do embaixador:', planResult.error || parentResult.error);
    throw new Error('Falha ao carregar o plano ou a indicação do embaixador');
  }

  const commissionPlan = planResult.data
    ? {
        ...planResult.data,
        base_commission_percentage: planResult.data.direct_percentage
      }
    : null;

  // Mascarar dados sensíveis
  return {
    ...amb,
    cpf_masked: maskCPF(amb.cpf),
    pix_type: amb.pix_key_type,
    pix_key_masked: maskPix(amb.pix_key, amb.pix_key_type),
    commission_plans: commissionPlan,
    parent: parentResult.data
  };
}

// 3. Revelar CPF/Pix (Auditado)
export async function revelarDadosSensiveis(ambassadorId: string, campo: 'cpf' | 'pix') {
  const admin = await checkAdminAccess();
  const adminClient = createAdminClient();

  const { data: amb, error } = await adminClient
    .from('ambassadors')
    .select('cpf, pix_key, pix_key_type, username')
    .eq('id', ambassadorId)
    .single();

  if (error || !amb) throw new Error('Embaixador não encontrado');

  const reqHeaders = await headers();
  const ipHash = getIpHash(reqHeaders);

  // Registrar revelação na auditoria
  await adminClient.from('audit_logs').insert({
    actor_id: admin.id,
    actor_role: 'admin',
    action: `admin_revealed_sensitive_${campo}`,
    entity_type: 'ambassadors',
    entity_id: ambassadorId,
    ip_hash: ipHash,
    metadata: { target_username: amb.username }
  });

  if (campo === 'cpf') {
    return { value: amb.cpf };
  } else {
    return { value: amb.pix_key };
  }
}

// 4. Redefinir Acesso (Auditado)
export async function redefinirAcesso(ambassadorId: string): Promise<
  | { success: true; accountCreated: boolean }
  | { success: false; message: string }
> {
  let admin;
  try {
    admin = await checkAdminAccess();
  } catch {
    return {
      success: false,
      message: 'Sua sessão administrativa não é válida. Entre novamente.',
    };
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ambassadorId)) {
    return { success: false, message: 'Cadastro de embaixador inválido.' };
  }

  const adminClient = createAdminClient();

  const { data: amb, error } = await adminClient
    .from('ambassadors')
    .select('user_id, phone, username, full_name')
    .eq('id', ambassadorId)
    .single();

  if (error || !amb) {
    return { success: false, message: 'Embaixador não encontrado.' };
  }

  const cleanPhone = amb.phone ? amb.phone.replace(/\D/g, '') : '';
  if (!/^\d{10,11}$/.test(cleanPhone)) {
    return {
      success: false,
      message: 'Cadastre um telefone válido com DDD antes de redefinir o acesso.',
    };
  }
  const syntheticEmail = getSyntheticEmail(amb.username);

  const reqHeaders = await headers();
  const ipHash = getIpHash(reqHeaders);
  let userId = amb.user_id;
  let accountCreated = false;

  if (!userId) {
    const { data: authData, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password: cleanPhone,
      email_confirm: true,
      user_metadata: { nome: amb.full_name },
    });

    if (createAuthError || !authData.user) {
      console.error('Erro ao criar acesso Auth do embaixador:', createAuthError);
      return {
        success: false,
        message: createAuthError?.code === 'email_exists'
          ? 'O e-mail interno deste embaixador já está vinculado a outra conta.'
          : 'Não foi possível criar a conta de primeiro acesso.',
      };
    }

    userId = authData.user.id;
    const { data: provisionData, error: provisionError } = await adminClient.rpc(
      'fn_service_provision_ambassador_access',
      {
        p_ambassador_id: ambassadorId,
        p_auth_user_id: userId,
        p_actor_id: admin.id,
      },
    );

    const provisionResult = provisionData as { status?: string; code?: string } | null;
    if (provisionError || provisionResult?.status !== 'linked') {
      console.error('Erro ao vincular acesso canônico do embaixador:', {
        provisionError,
        provisionResult,
      });
      await adminClient.auth.admin.deleteUser(userId);
      return {
        success: false,
        message: 'A identidade do embaixador não pôde ser vinculada automaticamente.',
      };
    }

    accountCreated = true;
  }

  const { data: currentProfile, error: currentProfileError } = await adminClient
    .from('profiles')
    .select('must_change_password, ativo')
    .eq('id', userId)
    .single();

  if (currentProfileError || !currentProfile) {
    return {
      success: false,
      message: 'Perfil do embaixador não encontrado para redefinir o acesso.',
    };
  }

  // 1. Restaurar somente o estado de acesso. Os identificadores já foram
  // sincronizados no provisionamento canônico e são protegidos por trigger.
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      must_change_password: true,
      ativo: true
    })
    .eq('id', userId);

  if (profileError) {
    return {
      success: false,
      message: 'Falha ao restaurar o status de primeiro acesso no perfil.',
    };
  }

  // 2. Sincronizar o identificador Auth e usar o telefone como senha temporária.
  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    email: syntheticEmail,
    password: cleanPhone,
    email_confirm: true
  });

  if (authError) {
    // Compensar a alteração do perfil caso o provedor de autenticação falhe.
    await adminClient
      .from('profiles')
      .update({
        must_change_password: currentProfile.must_change_password,
        ativo: currentProfile.ativo
      })
      .eq('id', userId);

    return {
      success: false,
      message: 'O provedor de autenticação não aceitou a redefinição das credenciais.',
    };
  }

  // 3. Registrar log de auditoria completo (sem expor a senha ou CPF)
  await adminClient.from('audit_logs').insert({
    actor_id: admin.id,
    actor_role: 'admin',
    action: 'reset_ambassador_access',
    entity_type: 'profiles',
    entity_id: userId,
    ip_hash: ipHash,
    metadata: {
      target_username: amb.username,
      reason: 'redefinir acesso',
      temporary_credential_source: 'registered_phone'
    }
  });

  revalidatePath('/embaixadores');
  revalidatePath(`/embaixadores/${ambassadorId}`);
  return { success: true, accountCreated };
}

// 5. Alterar Plano (Sem alterar histórico)
export async function alterarPlano(ambassadorId: string, planId: string) {
  const admin = await checkAdminAccess();
  const adminClient = createAdminClient();

  const { data: amb } = await adminClient
    .from('ambassadors')
    .select('username')
    .eq('id', ambassadorId)
    .single();

  const { error } = await adminClient
    .from('ambassadors')
    .update({ commission_plan_id: planId })
    .eq('id', ambassadorId);

  if (error) throw new Error('Falha ao alterar plano');

  const reqHeaders = await headers();
  const ipHash = getIpHash(reqHeaders);

  await adminClient.from('audit_logs').insert({
    actor_id: admin.id,
    actor_role: 'admin',
    action: 'change_ambassador_plan',
    entity_type: 'ambassadors',
    entity_id: ambassadorId,
    ip_hash: ipHash,
    metadata: { target_username: amb?.username || '', plan_id: planId }
  });

  revalidatePath('/embaixadores');
  return { success: true };
}

// 6. Editar Embaixador
export async function editarEmbaixador(ambassadorId: string, data: any) {
  await checkAdminAccess();
  const supabase = await createClient();

  const { 
    full_name, 
    display_name, 
    phone, 
    email, 
    instagram, 
    city, 
    state, 
    pix_type, 
    pix_key, 
    notes, 
    photo_path,
    cep,
    address,
    number,
    neighborhood,
    latitude,
    longitude
  } = data;

  const cleanPhone = typeof phone === 'string' ? phone.replace(/\D/g, '') : '';
  if (!/^\d{10,11}$/.test(cleanPhone)) {
    throw new Error('Informe um telefone válido com DDD.');
  }

  const normalizedState = state && state.trim() ? state.trim().toUpperCase() : null;
  let normalizedPixType: string | null = pix_type || null;
  if (normalizedPixType === 'pix' || normalizedPixType === 'outro') {
    normalizedPixType = 'chave_aleatoria';
  }

  const updateData: Record<string, any> = {
    full_name,
    display_name: display_name || full_name,
    phone: phone || null,
    email: email.trim().toLowerCase(),
    instagram: instagram || null,
    city: city ? city.trim() : null,
    state: normalizedState,
    notes: notes || null,
    photo_path: photo_path || null,
    cep: cep || null,
    address: address || null,
    number: number || null,
    neighborhood: neighborhood || null,
    latitude: latitude ? String(Number(latitude)) : null,
    longitude: longitude ? String(Number(longitude)) : null
  };

  // Uma chave mascarada/omitida significa "preservar a chave atual".
  if (typeof pix_key === 'string' && pix_key.trim() && !pix_key.includes('*')) {
    updateData.pix_key_type = normalizedPixType;
    updateData.pix_key = pix_key.trim();
  }

  const { data: result, error } = await supabase.rpc('fn_admin_update_ambassador_canonical', {
    p_ambassador_id: ambassadorId,
    p_data: updateData,
  });

  if (error) throw new Error('Falha ao atualizar dados do embaixador');
  if ((result as { status?: string })?.status === 'manual_review_required') {
    throw new Error('Os dados informados exigem revisão administrativa.');
  }

  revalidatePath('/embaixadores');
  return { success: true };
}

// 7. Alterar Status (Ativar/Inativar/Bloquear)
export async function alterarStatus(ambassadorId: string, newStatus: string) {
  const admin = await checkAdminAccess();
  const adminClient = createAdminClient();

  const allowedStatuses = ['pendente', 'ativo', 'inativo', 'bloqueado'];
  if (!allowedStatuses.includes(newStatus)) {
    throw new Error('Status de embaixador inválido');
  }

  const { data: amb, error: findError } = await adminClient
    .from('ambassadors')
    .select('user_id, username')
    .eq('id', ambassadorId)
    .maybeSingle();

  if (findError) throw new Error('Falha ao consultar o embaixador');
  if (!amb) throw new Error('Embaixador não encontrado');

  const { error } = await adminClient
    .from('ambassadors')
    .update({ status: newStatus })
    .eq('id', ambassadorId)
    .select('id')
    .single();

  if (error) throw new Error('Falha ao atualizar status');

  const reqHeaders = await headers();
  const ipHash = getIpHash(reqHeaders);

  await adminClient.from('audit_logs').insert({
    actor_id: admin.id,
    actor_role: 'admin',
    action: `change_ambassador_status_${newStatus}`,
    entity_type: 'ambassadors',
    entity_id: ambassadorId,
    ip_hash: ipHash,
    metadata: { target_username: amb?.username || '' }
  });

  revalidatePath('/embaixadores');
  return { success: true };
}

// 8. Obter Signed URL de foto privada
export async function getSignedPhotoUrl(photoPath: string) {
  await checkAdminAccess();
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.storage
    .from('ambassador-photos')
    .createSignedUrl(photoPath, 300); // URL válida por 5 minutos

  if (error || !data) {
    console.error('Erro ao gerar signed URL:', error);
    return null;
  }

  return data.signedUrl;
}

// 9. Obter Rede Multinível do Embaixador (Níveis 1, 2 e 3)
export async function getEmbaixadorNetwork(ambassadorId: string) {
  await checkAdminAccess();
  const admin = createAdminClient();
  const safeColumns = 'id, parent_ambassador_id, full_name, display_name, username, phone, city, state, status, created_at';

  // Buscar dados do embaixador dono da rede
  const { data: owner } = await admin
    .from('ambassadors')
    .select('id, full_name, display_name')
    .eq('id', ambassadorId)
    .maybeSingle();

  if (!owner) {
    return {
      items: [],
      counts: { total: 0, level1: 0, level2: 0, level3: 0 }
    };
  }

  async function getChildren(parentIds: string[]) {
    if (parentIds.length === 0) return [];

    const { data, error } = await admin
      .from('ambassadors')
      .select(safeColumns)
      .in('parent_ambassador_id', parentIds)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao carregar nível da rede do embaixador:', error);
      return [];
    }

    return data || [];
  }

  const level1Rows = await getChildren([owner.id]);
  const level2Rows = await getChildren(level1Rows.map((item) => item.id));
  const level3Rows = await getChildren(level2Rows.map((item) => item.id));

  const names = new Map<string, string>([
    [owner.id, owner.display_name || owner.full_name],
    ...level1Rows.map((item) => [item.id, item.display_name || item.full_name] as [string, string]),
    ...level2Rows.map((item) => [item.id, item.display_name || item.full_name] as [string, string]),
  ]);

  const withLevel = (rows: any[], level: 1 | 2 | 3) => rows.map((item) => ({
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
    }
  };
}

// 10. Listar o histórico completo de clientes indicados por embaixadores
export async function getClientesIndicadosPaginados(params: {
  limit: number;
  offset: number;
  search?: string;
  ambassadorId?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  await checkAdminAccess();
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.rpc('fn_get_clientes_indicados', {
    p_limit: params.limit,
    p_offset: params.offset,
    p_search: params.search || null,
    p_ambassador_id: params.ambassadorId || null,
    p_status: params.status || null,
    p_sort_by: params.sortBy || null,
    p_sort_order: params.sortOrder || 'desc',
  });

  if (error) {
    console.error('Erro na RPC de clientes indicados:', error);
    throw new Error('Erro ao listar clientes indicados');
  }

  const result = data as { items: any[]; total: number };
  return {
    items: result.items || [],
    total: result.total || 0,
  };
}

// 11. Stats de rede de embaixadores (batch)
export async function getEmbaixadoresNetworkStats(ambassadorIds: string[]) {
  await checkAdminAccess();
  if (!ambassadorIds.length) return [];
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.rpc('fn_get_ambassador_network_stats', {
    p_ambassador_ids: ambassadorIds,
  });

  if (error) {
    console.error('Erro ao buscar stats de rede:', error);
    return [];
  }

  return (data || []) as {
    ambassador_id: string;
    clients_active: number;
    clients_inactive: number;
    sub_ambassadors_active: number;
    sub_ambassadors_inactive: number;
  }[];
}

export type AmbassadorActivationStatus = {
  ambassador_id: string;
  status: 'qualified' | 'exception' | 'not_qualified';
  qualified: boolean;
  code?: string;
  period_start?: string;
  period_end?: string;
  deadline?: string;
  minimum_amount?: number | string;
  personal_purchase_amount?: number | string;
};

export async function getEmbaixadoresActivationStatus(ambassadorIds: string[]) {
  await checkAdminAccess();
  if (!ambassadorIds.length) return [];
  if (ambassadorIds.length > 100) {
    throw new Error('Consulte no máximo 100 embaixadores por vez.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_admin_get_ambassador_activation_status', {
    p_ambassador_ids: ambassadorIds,
  });

  if (error) {
    console.error('Erro ao consultar ativação mensal:', error);
    throw new Error('Não foi possível consultar a ativação mensal.');
  }

  return (data || []) as AmbassadorActivationStatus[];
}

export async function ativarComissoesMensais(
  ambassadorId: string,
  reason: string
) {
  await checkAdminAccess();

  const normalizedReason = reason.trim();
  if (normalizedReason.length < 5 || normalizedReason.length > 500) {
    throw new Error('Informe um motivo entre 5 e 500 caracteres.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    'fn_admin_activate_current_month_commissions',
    {
      p_ambassador_id: ambassadorId,
      p_reason: normalizedReason,
    }
  );

  if (error) {
    console.error('Erro ao ativar comissões administrativamente:', error);
    throw new Error('Não foi possível ativar as comissões deste mês.');
  }

  const result = data as {
    activation_result?: 'activated' | 'already_active';
    qualified?: boolean;
    valid_until?: string;
  };

  if (!result?.qualified) {
    throw new Error('A ativação não foi confirmada pelo sistema.');
  }

  revalidatePath('/embaixadores');
  revalidatePath('/embaixador/dashboard');
  return result;
}

// 12. Promover Cliente para Embaixador (Admin)
export async function promoverClienteParaEmbaixador(params: {
  clienteId: string;
  planId?: string;
  initialStatus?: 'pendente' | 'ativo';
}): Promise<
  | {
      success: true;
      status: string;
      ambassador_id?: string;
      referral_code?: string;
      username?: string;
    }
  | { success: false; message: string }
> {
  try {
    await checkAdminAccess();
  } catch {
    return {
      success: false,
      message: 'Sua sessão administrativa não é válida. Entre novamente.',
    };
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(params.clienteId) || (params.planId && !uuidPattern.test(params.planId))) {
    return { success: false, message: 'Cliente ou plano de comissão inválido.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_admin_promote_client_to_ambassador', {
    p_customer_id: params.clienteId,
    p_plan_id: params.planId || null,
    p_initial_status: params.initialStatus || 'pendente',
  });

  if (error) {
    console.error('Erro ao promover cliente para embaixador:', error);
    return {
      success: false,
      message: error.code === '42501'
        ? 'Sua sessão não possui permissão para realizar esta promoção.'
        : 'Não foi possível promover o cliente. Tente novamente.',
    };
  }

  const result = data as { status: string; ambassador_id?: string; referral_code?: string; username?: string };

  if (result.status === 'customer_not_found') {
    return { success: false, message: 'Cliente não encontrado.' };
  }
  if (result.status === 'already_ambassador') {
    return { success: false, message: 'Este cliente já é um embaixador.' };
  }

  revalidatePath('/embaixadores');
  revalidatePath('/clientes');
  return { success: true, ...result };
}

export type NovoEmbaixadorOptions = {
  plans: Array<{ id: string; name: string }>;
  sponsors: Array<{ id: string; full_name: string; referral_code: string }>;
  commercialProfiles: Array<{ id: string; nome: string; role: string }>;
};

export async function getNovoEmbaixadorOptions(): Promise<NovoEmbaixadorOptions> {
  await checkAdminAccess();
  const admin = createAdminClient();
  const [plans, sponsors, profiles] = await Promise.all([
    admin.from('commission_plans').select('id, name').eq('status', 'ativo').order('created_at'),
    admin.from('ambassadors').select('id, full_name, referral_code').eq('status', 'ativo').eq('lifecycle_status', 'active').order('full_name'),
    admin.from('profiles').select('id, nome, role').eq('ativo', true).in('role', ['admin', 'vendedor']).order('nome'),
  ]);

  const error = plans.error || sponsors.error || profiles.error;
  if (error) {
    console.error('Erro ao carregar opções do novo embaixador:', error);
    throw new Error('Não foi possível carregar as opções do cadastro.');
  }

  return {
    plans: plans.data || [],
    sponsors: sponsors.data || [],
    commercialProfiles: profiles.data || [],
  };
}

export type CriarEmbaixadorParams = {
  fullName: string;
  phone: string;
  email?: string;
  cpf: string;
  cep?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  commercialProfileId: string;
  sponsorAmbassadorId?: string;
  planId: string;
  initialStatus: 'pendente' | 'ativo';
  latitude?: number | null;
  longitude?: number | null;
  idempotencyKey: string;
};

export async function criarEmbaixadorComCliente(params: CriarEmbaixadorParams): Promise<
  | { success: true; customerCreated: boolean; customerCode: string; ambassadorId: string; username: string }
  | { success: false; message: string }
> {
  try {
    await checkAdminAccess();
  } catch {
    return { success: false, message: 'Sua sessão administrativa não é válida. Entre novamente.' };
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const phone = params.phone.replace(/\D/g, '');
  const cpf = params.cpf.replace(/\D/g, '');
  const email = params.email?.trim().toLowerCase() || '';
  const state = params.state?.trim().toUpperCase() || '';

  if (params.fullName.trim().length < 2 || params.fullName.trim().length > 200) {
    return { success: false, message: 'Informe o nome completo.' };
  }
  if (!/^\d{10,15}$/.test(phone) || !/^\d{11}$/.test(cpf)) {
    return { success: false, message: 'Telefone ou CPF inválido.' };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: 'E-mail inválido.' };
  }
  if (state && !/^[A-Z]{2}$/.test(state)) {
    return { success: false, message: 'Estado inválido. Use a sigla com duas letras.' };
  }
  if (
    !uuidPattern.test(params.commercialProfileId)
    || !uuidPattern.test(params.planId)
    || !uuidPattern.test(params.idempotencyKey)
    || (params.sponsorAmbassadorId && !uuidPattern.test(params.sponsorAmbassadorId))
  ) {
    return { success: false, message: 'Plano, responsável, patrocinador ou chave da operação inválido.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_admin_create_or_promote_ambassador', {
    p_customer_id: null,
    p_full_name: params.fullName.trim(),
    p_phone: phone,
    p_email: email || null,
    p_cpf: cpf,
    p_cep: params.cep?.trim() || null,
    p_address: params.address?.trim() || null,
    p_number: params.number?.trim() || null,
    p_neighborhood: params.neighborhood?.trim() || null,
    p_city: params.city?.trim() || null,
    p_state: state || null,
    p_commercial_profile_id: params.commercialProfileId,
    p_sponsor_ambassador_id: params.sponsorAmbassadorId || null,
    p_plan_id: params.planId,
    p_initial_status: params.initialStatus,
    p_latitude: params.latitude ?? null,
    p_longitude: params.longitude ?? null,
    p_idempotency_key: params.idempotencyKey,
  });

  if (error) {
    console.error('Erro ao criar embaixador com cliente canônico:', error);
    return {
      success: false,
      message: error.message.includes('ambassador_cannot_refer_self')
        ? 'O embaixador não pode indicar a si próprio.'
        : error.message.includes('active_sponsor_required')
          ? 'O patrocinador selecionado não está ativo.'
          : error.code === '42501'
            ? 'Sua sessão não possui permissão para realizar este cadastro.'
            : 'Não foi possível concluir o cadastro. Revise os dados e tente novamente.',
    };
  }

  const result = data as {
    status?: string;
    customer_created?: boolean;
    customer_code?: string;
    ambassador_id?: string;
    username?: string;
    referral_code?: string;
  };

  if (result.status === 'manual_review_required') {
    return { success: false, message: 'Encontramos mais de um cliente com estes dados. O cadastro não foi duplicado e precisa de revisão de identidade.' };
  }
  if (result.status === 'idempotency_conflict') {
    return { success: false, message: 'Esta operação já foi enviada com outros dados. Atualize a página e tente novamente.' };
  }
  if (!result.ambassador_id || !result.customer_code) {
    return { success: false, message: 'O sistema não confirmou o vínculo entre cliente e embaixador.' };
  }

  revalidatePath('/embaixadores');
  revalidatePath('/clientes');
  revalidatePath('/embaixadores/novo');
  return {
    success: true,
    customerCreated: result.customer_created === true,
    customerCode: result.customer_code,
    ambassadorId: result.ambassador_id,
    username: result.username || result.referral_code || '',
  };
}

