'use server';

import { headers } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export type CustomerAccessState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

const GENERIC_SUCCESS =
  'Se os dados estiverem corretos, você receberá um link seguro de acesso no e-mail informado.';

function safeReturnPath(value: FormDataEntryValue | null): string {
  const path = typeof value === 'string' ? value.trim() : '';
  if (!path.startsWith('/') || path.startsWith('//')) {
    return '/loja/minha-conta';
  }
  return path;
}

export async function requestCustomerAccess(
  _previousState: CustomerAccessState,
  formData: FormData,
): Promise<CustomerAccessState> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const returnPath = safeReturnPath(formData.get('retorno'));

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return {
      status: 'error',
      message: 'Informe um e-mail válido para receber o link de acesso.',
    };
  }

  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get('x-forwarded-host');
  const host = forwardedHost || requestHeaders.get('host');
  const protocol =
    requestHeaders.get('x-forwarded-proto') ||
    (host?.startsWith('localhost') ? 'http' : 'https');
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  const origin = configuredSiteUrl || (host ? `${protocol}://${host}` : 'http://localhost:3000');
  const callbackUrl = new URL('/loja/auth/confirm', origin);
  callbackUrl.searchParams.set('next', returnPath);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Um cliente existente no cadastro comercial pode ainda não possuir
        // usuário no Auth. O vínculo canônico acontece somente após o e-mail
        // ser confirmado no callback, sem criar um segundo cliente.
        shouldCreateUser: true,
        emailRedirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      console.error('Falha ao solicitar acesso da conta do cliente:', error.message);
    }

    // A resposta permanece genérica para não revelar se o e-mail possui cadastro.
    return { status: 'success', message: GENERIC_SUCCESS };
  } catch (error) {
    console.error('Erro inesperado ao solicitar acesso da conta do cliente:', error);
    return {
      status: 'error',
      message: 'Não foi possível enviar o link agora. Tente novamente em alguns instantes.',
    };
  }
}
