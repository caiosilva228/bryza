import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { securityHeaders } from '@/lib/mcp/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirect(request: Request, query: string) {
  const response = NextResponse.redirect(new URL(`/oauth/grants?${query}`, request.url));
  for (const [key, value] of securityHeaders()) response.headers.set(key, value);
  return response;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: securityHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origem não permitida.' }, 403);

  const formData = await request.formData();
  const clientId = String(formData.get('client_id') || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
    return redirect(request, 'error=1');
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return json({ error: 'Não autorizado.' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('ativo, must_change_password')
    .eq('id', claimsData.claims.sub)
    .maybeSingle();
  if (!profile?.ativo || profile.must_change_password) return json({ error: 'Conta não autorizada.' }, 403);

  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
  return redirect(request, error ? 'error=1' : 'revoked=1');
}
