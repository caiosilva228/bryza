import type { EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/loja/minha-conta';
  }
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const nextPath = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const supabase = await createClient();

  let authError: Error | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    authError = error;
  } else {
    authError = new Error('Parâmetros de autenticação ausentes.');
  }

  if (authError) {
    console.error('Falha na confirmação de acesso do cliente:', authError.message);
    return NextResponse.redirect(
      new URL('/loja/entrar?erro=link_invalido', request.url),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('fn_service_link_customer_auth_account', {
      p_auth_user_id: user.id,
    });

    if (error) {
      // A autenticação continua válida. A conta mostra um estado seguro sem pedidos
      // até a identidade ser vinculada ou revisada.
      console.error('Falha ao vincular identidade canônica do cliente:', error.message);
    } else if (
      data &&
      typeof data === 'object' &&
      'status' in data &&
      data.status === 'manual_review'
    ) {
      return NextResponse.redirect(
        new URL('/loja/minha-conta?identidade=em_analise', request.url),
      );
    }
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
