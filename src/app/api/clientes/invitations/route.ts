import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const TERMS_VERSION = 'programa-embaixadores-v1';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem consultar convites.' }, { status: 403 });
  }

  const customerId = request.nextUrl.searchParams.get('customerId');
  if (!customerId) {
    return NextResponse.json({ error: 'Cliente não informado.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc(
    'fn_admin_get_customer_program_status',
    { p_customer_id: customerId }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ result: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem criar convites.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { customer_id?: string } | null;
  if (!body?.customer_id) {
    return NextResponse.json({ error: 'Cliente não informado.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: customer, error: customerError } = await admin
    .from('clientes')
    .select('id, email, lifecycle_status')
    .eq('id', body.customer_id)
    .single();
  if (customerError || !customer || customer.lifecycle_status !== 'active') {
    return NextResponse.json({ error: 'Cliente não encontrado ou arquivado.' }, { status: 404 });
  }
  if (!customer.email) {
    return NextResponse.json(
      { error: 'Cadastre o e-mail do cliente antes de enviar o convite.' },
      { status: 422 }
    );
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.rpc('fn_admin_create_ambassador_invitation', {
    p_customer_id: customer.id,
    p_terms_version: TERMS_VERSION,
    p_invitation_token: token,
    p_expires_at: expiresAt,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = data as {
    status?: string;
    invitation_token?: string;
    expires_at?: string;
  };
  if (result.status !== 'created') {
    return NextResponse.json({ result }, { status: 200 });
  }

  const invitationToken = result.invitation_token || token;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const acceptanceUrl = new URL('/programa/embaixadores/aceitar', baseUrl);
  acceptanceUrl.searchParams.set('token', invitationToken);

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(customer.email, {
    redirectTo: acceptanceUrl.toString(),
    data: { invitation_type: 'ambassador_program' },
  });

  return NextResponse.json({
    result: {
      status: 'created',
      acceptance_url: acceptanceUrl.toString(),
      expires_at: result.expires_at || expiresAt,
      email_delivery: inviteError ? 'share_link_manually' : 'sent',
    },
  });
}
