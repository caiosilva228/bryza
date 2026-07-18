'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function alterarSenhaPrimeiroAcesso(prevState: any, formData: FormData) {
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

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

  // Obter CPF e username de embaixador (se for o caso)
  let userCpf = profile.cpf ? profile.cpf.replace(/\D/g, '') : '';
  let username = profile.username || '';

  if (!userCpf || !username) {
    const { data: amb } = await supabase
      .from('ambassadors')
      .select('cpf, username')
      .eq('user_id', user.id)
      .maybeSingle();

    if (amb) {
      if (!userCpf && amb.cpf) userCpf = amb.cpf.replace(/\D/g, '');
      if (!username && amb.username) username = amb.username;
    }
  }

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

  if (userCpf && (newPassword === userCpf || newPassword.includes(userCpf))) {
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

  // 5. Atualizar must_change_password = false no perfil usando o cliente administrativo isolado (bypassing RLS)
  const { error: updateDbError } = await adminClient
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', user.id);

  if (updateDbError) {
    console.error('Erro ao atualizar must_change_password no banco:', updateDbError);

    // Registrar falha na auditoria
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      actor_role: profile.role,
      action: 'change_password_first_access_db_failed',
      entity_type: 'profiles',
      entity_id: user.id,
      metadata: { error: updateDbError.message }
    });

    // Como must_change_password continua TRUE, o usuário permanece restrito
    return { 
      success: false, 
      error: 'Senha atualizada no login, mas ocorreu um erro no banco. Tente novamente para sincronizar.' 
    };
  }

  // Registrar sucesso na auditoria
  await adminClient.from('audit_logs').insert({
    actor_id: user.id,
    actor_role: profile.role,
    action: 'change_password_first_access_success',
    entity_type: 'profiles',
    entity_id: user.id,
    metadata: { status: 'concluido' }
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
