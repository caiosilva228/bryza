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

export async function alterarSenhaPrimeiroAcesso(prevState: any, formData: FormData) {
  const cpfInput = (formData.get('cpf') as string || '').trim();
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  const cleanCpf = cpfInput.replace(/\D/g, '');

  if (!cleanCpf || !isValidCPF(cleanCpf)) {
    return { success: false, error: 'Informe um CPF válido com 11 dígitos.' };
  }

  // 1. Validar sessão real no servidor
  const supabase = await createClient();
  const { data: { user }, error: authUserError } = await supabase.auth.getUser();

  if (authUserError || !user) {
    return { success: false, error: 'Sessão expirada. Faça login novamente.' };
  }

  // 2. Validar perfil no banco (ativo e must_change_password = true)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, ativo, must_change_password, username, cpf')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: 'Perfil não encontrado.' };
  }

  if (!profile.ativo) {
    return { success: false, error: 'Sua conta está inativa ou bloqueada.' };
  }

  if (!profile.must_change_password) {
    return { success: false, error: 'Esta conta já realizou a troca de senha obrigatória.' };
  }

  const username = profile.username || '';

  // 3. Validações estritas de senha no servidor
  if (!newPassword || !confirmPassword) {
    return { success: false, error: 'Preencha todos os campos.' };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: 'As senhas não coincidem.' };
  }

  if (newPassword.length < 8) {
    return { success: false, error: 'A senha deve ter pelo menos 8 caracteres.' };
  }

  if (newPassword === cleanCpf || newPassword.includes(cleanCpf)) {
    return { success: false, error: 'A nova senha não pode ser igual ou conter o seu CPF.' };
  }

  if (username && newPassword.toLowerCase().includes(username.toLowerCase())) {
    return { success: false, error: 'A nova senha não pode conter o seu nome de usuário.' };
  }

  // 4. Executar alteração de senha no Supabase Auth
  const { error: updateAuthError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  const adminClient = createAdminClient();

  if (updateAuthError) {
    console.error('Erro ao atualizar senha no Auth:', updateAuthError);
    
    // Registrar falha na auditoria
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

  // 5. Salvar CPF na tabela ambassadors e profiles, e atualizar must_change_password = false
  await Promise.all([
    adminClient
      .from('profiles')
      .update({ cpf: cleanCpf, must_change_password: false })
      .eq('id', user.id),
    adminClient
      .from('ambassadors')
      .update({ cpf: cleanCpf })
      .eq('user_id', user.id)
  ]);

  // Registrar sucesso na auditoria
  await adminClient.from('audit_logs').insert({
    actor_id: user.id,
    actor_role: profile.role,
    action: 'change_password_first_access_success',
    entity_type: 'profiles',
    entity_id: user.id,
    metadata: { status: 'concluido', cpf_updated: true }
  });

  // Revalidar rotas e redirecionar
  revalidatePath('/', 'layout');

  let targetUrl = '/';
  if (profile.role === 'embaixador') {
    targetUrl = '/embaixador/dashboard';
  } else if (profile.role === 'logistica') {
    targetUrl = '/logistica';
  }

  // Executamos o redirect fora do bloco try-catch para não interromper a lógica do Next.js
  redirect(targetUrl);
}
