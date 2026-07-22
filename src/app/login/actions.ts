'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getSyntheticEmail } from '@/utils/env';
import { createAdminClient } from '@/utils/supabase/admin';
import { headers } from 'next/headers';
import crypto from 'crypto';

function getIpHash(reqHeaders: Headers): string {
  // Obter cabeçalho seguro de borda do Netlify
  const ip = reqHeaders.get('x-nf-client-connection-ip') || reqHeaders.get('client-ip') || 'unknown-ip';
  const secret = process.env.IP_HASH_SECRET || 'fallback_secret_key_123';
  return crypto.createHmac('sha256', secret).update(ip).digest('hex');
}

export async function login(formData: FormData) {
  const identifier = (formData.get('identifier') as string || '').trim();
  const password = formData.get('password') as string;

  if (!identifier || !password) {
    redirect('/login?error=InvalidCredentials');
  }

  const normalizedUsername = identifier.toLowerCase();
  const reqHeaders = await headers();
  const ipHash = getIpHash(reqHeaders);

  const adminClient = createAdminClient();

  // 1. Verificar Rate Limit (executado via service_role)
  const rateCheckPromise = adminClient.rpc('fn_check_login_rate_limit', {
    p_ip_hash: ipHash,
    p_username: normalizedUsername
  });

  // 2. Resolução do Username para e-mail sintético (Código Bryza, CPF, Telefone ou E-mail)
  let resolvedEmail = normalizedUsername;
  const digitsOnly = normalizedUsername.replace(/\D/g, '');

  if (digitsOnly.length === 11) {
    // 2a. Tentar resolver por Telefone
    const { data: phoneEmail } = await adminClient.rpc('fn_resolve_login_phone', {
      p_phone: digitsOnly,
    });

    if (typeof phoneEmail === 'string' && phoneEmail) {
      resolvedEmail = phoneEmail;
    } else {
      // 2b. Tentar resolver por CPF
      const { data: cpfEmail } = await adminClient.rpc('fn_resolve_login_cpf', {
        p_cpf: digitsOnly,
      });

      if (typeof cpfEmail === 'string' && cpfEmail) {
        resolvedEmail = cpfEmail;
      } else {
        resolvedEmail = getSyntheticEmail(`identificador-invalido-${digitsOnly}`);
      }
    }
  } else if (/^bryza\d+$/.test(normalizedUsername)) {
    resolvedEmail = getSyntheticEmail(normalizedUsername);
  }

  const { data: isBlocked, error: rateCheckError } = await rateCheckPromise;

  if (rateCheckError) {
    console.error('Erro ao verificar rate limit no banco:', rateCheckError);
  }

  if (isBlocked === true) {
    redirect('/login?error=RateLimit');
  }

  // 3. Autenticação no Supabase Auth
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password
  });

  // 4. Registrar tentativa no banco de dados (executado via service_role, sucesso=true ou false)
  const success = !authError && !!authData.user;
  const registerAttemptPromise = adminClient.rpc('fn_register_login_attempt', {
    p_ip_hash: ipHash,
    p_username: normalizedUsername,
    p_success: success
  });

  if (authError || !authData.user) {
    const { error: registerError } = await registerAttemptPromise;
    if (registerError) {
      console.error('Erro ao registrar tentativa de login:', registerError);
    }
    redirect('/login?error=InvalidCredentials');
  }

  // 5. Verificar o perfil do usuário logado
  const [{ error: registerError }, { data: profile, error: profileError }] = await Promise.all([
    registerAttemptPromise,
    adminClient
      .from('profiles')
      .select('role, ativo, must_change_password')
      .eq('id', authData.user.id)
      .single(),
  ]);

  if (registerError) {
    console.error('Erro ao registrar tentativa de login:', registerError);
  }

  if (profileError || !profile || !profile.ativo) {
    // Deslogar imediatamente se a conta estiver desativada ou não tiver perfil
    await supabase.auth.signOut();
    redirect('/login?error=BlockedUser');
  }

  // Se for embaixador, checar status na tabela ambassadors
  if (profile.role === 'embaixador') {
    const { data: amb, error: ambError } = await adminClient
      .from('ambassadors')
      .select('status')
      .eq('user_id', authData.user.id)
      .single();

    if (ambError || !amb || amb.status !== 'ativo') {
      await supabase.auth.signOut();
      redirect('/login?error=BlockedUser');
    }
  }

  // Redirecionamentos com base no estado e papel
  revalidatePath('/', 'layout');

  if (profile.must_change_password) {
    redirect('/primeiro-acesso');
  }

  if (profile.role === 'embaixador') {
    redirect('/embaixador/dashboard');
  }

  if (profile.role === 'logistica') {
    redirect('/logistica');
  }

  redirect('/');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
