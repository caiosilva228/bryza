'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function isValidCPF(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCpf)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCpf.substring(i - 1, i), 10) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.substring(9, 10), 10)) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCpf.substring(i - 1, i), 10) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.substring(10, 11), 10)) return false;

  return true;
}

export async function getPrimeiroAcessoUserData() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authUserError } = await supabase.auth.getUser();

    if (authUserError || !user) {
      return { authenticated: false };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, ativo, must_change_password, username, cpf, nome')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !profile.ativo) {
      return { authenticated: false };
    }

    const admin = createAdminClient();
    const { data: amb } = await admin
      .from('ambassadors')
      .select('cpf, full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const existingCpf = (profile.cpf || amb?.cpf || '').replace(/\D/g, '');
    const hasCpf = existingCpf.length === 11;

    return {
      authenticated: true,
      mustChangePassword: profile.must_change_password,
      nome: profile.nome || amb?.full_name || '',
      existingCpf: hasCpf ? existingCpf : '',
      hasCpf,
    };
  } catch (err) {
    console.error('Erro ao buscar dados do primeiro acesso:', err);
    return { authenticated: false };
  }
}

export async function alterarSenhaPrimeiroAcesso(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authUserError } = await supabase.auth.getUser();

  if (authUserError || !user) {
    return { success: false, error: 'Sessão expirada. Faça login novamente.' };
  }

  // 1. Validar perfil e dados do embaixador no banco
  const adminClient = createAdminClient();
  const [profileRes, ambRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, ativo, must_change_password, username, cpf')
      .eq('id', user.id)
      .single(),
    adminClient
      .from('ambassadors')
      .select('cpf')
      .eq('user_id', user.id)
      .maybeSingle()
  ]);

  const profile = profileRes.data;
  if (profileRes.error || !profile) {
    return { success: false, error: 'Perfil não encontrado.' };
  }

  if (!profile.ativo) {
    return { success: false, error: 'Sua conta está inativa ou bloqueada.' };
  }

  if (!profile.must_change_password) {
    return { success: false, error: 'Esta conta já realizou a troca de senha obrigatória.' };
  }

  // Verificar se o CPF já existe cadastrado ou se veio do formulário de campos faltantes
  const existingCpf = (profile.cpf || ambRes.data?.cpf || '').replace(/\D/g, '');
  const inputCpf = (formData.get('cpf') as string || '').trim().replace(/\D/g, '');
  const finalCpf = existingCpf.length === 11 ? existingCpf : inputCpf;

  if (!finalCpf || !isValidCPF(finalCpf)) {
    return { success: false, error: 'Informe um CPF válido com 11 dígitos.' };
  }

  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;
  const username = profile.username || '';

  // 2. Validações estritas de senha
  if (!newPassword || !confirmPassword) {
    return { success: false, error: 'Preencha todos os campos de senha.' };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: 'As senhas não coincidem.' };
  }

  if (newPassword.length < 8) {
    return { success: false, error: 'A senha deve ter pelo menos 8 caracteres.' };
  }

  if (newPassword === finalCpf || newPassword.includes(finalCpf)) {
    return { success: false, error: 'A nova senha não pode ser igual ou conter o seu CPF.' };
  }

  if (username && newPassword.toLowerCase().includes(username.toLowerCase())) {
    return { success: false, error: 'A nova senha não pode conter o seu nome de usuário.' };
  }

  // 3. Executar alteração de senha no Supabase Auth
  const { error: updateAuthError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateAuthError) {
    console.error('Erro ao atualizar senha no Auth:', updateAuthError);
    
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      actor_role: profile.role,
      action: 'change_password_first_access_auth_failed',
      entity_type: 'profiles',
      entity_id: user.id,
      metadata: { error: updateAuthError.message }
    });

    return { success: false, error: `Erro no provedor de autenticação: ${updateAuthError.message}` };
  }

  // 4. Salvar CPF (se atualizado) e marcar must_change_password = false
  await Promise.all([
    adminClient
      .from('profiles')
      .update({ cpf: finalCpf, must_change_password: false })
      .eq('id', user.id),
    adminClient
      .from('ambassadors')
      .update({ cpf: finalCpf })
      .eq('user_id', user.id)
  ]);

  // Auditoria
  await adminClient.from('audit_logs').insert({
    actor_id: user.id,
    actor_role: profile.role,
    action: 'change_password_first_access_success',
    entity_type: 'profiles',
    entity_id: user.id,
    metadata: { status: 'concluido', cpf_updated: true }
  });

  revalidatePath('/', 'layout');

  let targetUrl = '/';
  if (profile.role === 'embaixador') {
    targetUrl = '/embaixador/dashboard';
  } else if (profile.role === 'logistica') {
    targetUrl = '/logistica';
  }

  redirect(targetUrl);
}
