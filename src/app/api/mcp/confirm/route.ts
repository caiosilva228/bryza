import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getMcpConfig } from '@/lib/mcp/config';
import { securityHeaders } from '@/lib/mcp/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: securityHeaders({ 'Content-Type': 'application/json; charset=utf-8' }) });
}

export async function POST(request: Request) {
  if (!getMcpConfig().enabled) return json({ error: 'MCP indisponivel.' }, 404);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origem não permitida.' }, 403);

  const formData = await request.formData();
  const confirmationId = String(formData.get('confirmation_id') || '');
  if (!/^[0-9a-f-]{36}$/i.test(confirmationId)) {
    return json({ error: 'Confirmação inválida.' }, 400);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return json({ error: 'Não autorizado.' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo, must_change_password')
    .eq('id', claimsData.claims.sub)
    .maybeSingle();
  if (!profile?.ativo || profile.must_change_password || !['admin', 'logistica'].includes(profile.role)) {
    return json({ error: 'Conta não autorizada.' }, 403);
  }

  const { error } = await supabase.rpc('fn_mcp_approve_confirmation', {
    p_confirmation_id: confirmationId,
  });
  if (error) return json({ error: 'Confirmação inválida, expirada ou já utilizada.' }, 409);

  const response = NextResponse.redirect(new URL('/mcp/confirm?status=approved', request.url));
  for (const [key, value] of securityHeaders()) response.headers.set(key, value);
  return response;
}
