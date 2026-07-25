import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Direct ambassador creation was intentionally retired. A person must first
 * exist as a canonical customer, receive an invitation, authenticate with the
 * matching verified e-mail and accept the current program terms.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', userData.user.id)
    .single();
  if (profile?.role !== 'admin' || !profile.ativo) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  return NextResponse.json(
    {
      error: 'O cadastro direto foi substituído pelo convite auditado a partir do cadastro do cliente.',
      redirect_to: '/clientes',
    },
    { status: 409 }
  );
}
