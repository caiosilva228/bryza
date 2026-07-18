'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import crypto from 'crypto';

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
  const secret = process.env.IP_HASH_SECRET || 'fallback_secret_key_123';
  return crypto.createHmac('sha256', secret).update(ip).digest('hex');
}

// Validar se o usuário logado é Admin Ativo
async function checkAdminAccess() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Não autorizado');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.ativo || profile.role !== 'admin') {
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
    p_end_date: params.endDate || null
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
    .select(`
      *,
      commission_plans (
        id,
        name,
        base_commission_percentage
      ),
      parent:parent_ambassador_id (
        id,
        full_name,
        username
      )
    `)
    .eq('id', id)
    .single();

  if (error || !amb) {
    throw new Error('Embaixador não encontrado');
  }

  // Mascarar dados sensíveis
  return {
    ...amb,
    cpf_masked: maskCPF(amb.cpf),
    pix_key_masked: maskPix(amb.pix_key, amb.pix_type)
  };
}

// 3. Revelar CPF/Pix (Auditado)
export async function revelarDadosSensiveis(ambassadorId: string, campo: 'cpf' | 'pix') {
  const admin = await checkAdminAccess();
  const adminClient = createAdminClient();

  const { data: amb, error } = await adminClient
    .from('ambassadors')
    .select('cpf, pix_key, pix_type, username')
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
export async function redefinirAcesso(ambassadorId: string) {
  const admin = await checkAdminAccess();
  const adminClient = createAdminClient();

  const { data: amb, error } = await adminClient
    .from('ambassadors')
    .select('user_id, cpf, username')
    .eq('id', ambassadorId)
    .single();

  if (error || !amb || !amb.user_id) throw new Error('Embaixador não possui usuário auth ativo');

  const cleanCpf = amb.cpf.replace(/\D/g, '');
  const reqHeaders = await headers();
  const ipHash = getIpHash(reqHeaders);

  // 1. Atualizar senha no Supabase Auth para o CPF limpo
  const { error: authError } = await adminClient.auth.admin.updateUserById(amb.user_id, {
    password: cleanCpf
  });

  if (authError) throw new Error(`Falha ao redefinir credenciais: ${authError.message}`);

  // 2. Atualizar perfil de primeiro acesso
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ must_change_password: true, ativo: true })
    .eq('id', amb.user_id);

  if (profileError) throw new Error('Falha ao restaurar status de primeiro acesso no perfil');

  // 3. Registrar log de auditoria completo (sem expor a senha ou CPF)
  await adminClient.from('audit_logs').insert({
    actor_id: admin.id,
    actor_role: 'admin',
    action: 'reset_ambassador_access',
    entity_type: 'profiles',
    entity_id: amb.user_id,
    ip_hash: ipHash,
    metadata: { target_username: amb.username, reason: 'redefinir acesso' }
  });

  revalidatePath('/embaixadores');
  return { success: true };
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
  const admin = await checkAdminAccess();
  const adminClient = createAdminClient();

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
    photo_path 
  } = data;

  const { data: oldAmb } = await adminClient
    .from('ambassadors')
    .select('user_id, username')
    .eq('id', ambassadorId)
    .single();

  const normalizedState = state && state.trim() ? state.trim().toUpperCase() : null;
  let normalizedPixType: string | null = pix_type || null;
  if (normalizedPixType === 'pix' || normalizedPixType === 'outro') {
    normalizedPixType = 'chave_aleatoria';
  }

  const { error } = await adminClient
    .from('ambassadors')
    .update({
      full_name,
      display_name: display_name || full_name,
      phone: phone || null,
      email: email.trim().toLowerCase(),
      instagram: instagram || null,
      city: city ? city.trim() : null,
      state: normalizedState,
      pix_key_type: normalizedPixType,
      pix_key: pix_key ? pix_key.trim() : null,
      notes: notes || null,
      photo_path: photo_path || null
    })
    .eq('id', ambassadorId);

  if (error) throw new Error('Falha ao atualizar dados do embaixador');

  // Sincronizar nome no perfil auth/profile se alterado
  if (oldAmb?.user_id) {
    await adminClient
      .from('profiles')
      .update({ nome: full_name })
      .eq('id', oldAmb.user_id);
  }

  const reqHeaders = await headers();
  const ipHash = getIpHash(reqHeaders);

  await adminClient.from('audit_logs').insert({
    actor_id: admin.id,
    actor_role: 'admin',
    action: 'edit_ambassador',
    entity_type: 'ambassadors',
    entity_id: ambassadorId,
    ip_hash: ipHash,
    metadata: { target_username: oldAmb?.username || '' }
  });

  revalidatePath('/embaixadores');
  return { success: true };
}

// 7. Alterar Status (Ativar/Inativar/Bloquear)
export async function alterarStatus(ambassadorId: string, newStatus: string) {
  const admin = await checkAdminAccess();
  const adminClient = createAdminClient();

  const { data: amb } = await adminClient
    .from('ambassadors')
    .select('user_id, username')
    .eq('id', ambassadorId)
    .single();

  const { error } = await adminClient
    .from('ambassadors')
    .update({ status: newStatus })
    .eq('id', ambassadorId);

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
