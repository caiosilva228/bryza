import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: 'Faça login para aceitar o convite.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { token?: string } | null;
  if (!body?.token) {
    return NextResponse.json({ error: 'Convite inválido.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('fn_service_link_invited_auth_account', {
    p_invitation_token: body.token,
    p_auth_user_id: userData.user.id,
  });
  if (error) {
    return NextResponse.json({ error: 'Não foi possível validar a conta do convite.' }, { status: 400 });
  }

  return NextResponse.json({ result: data });
}
