import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getMcpConfig } from '@/lib/mcp/config';
import { securityHeaders } from '@/lib/mcp/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function responseJson(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: securityHeaders({ 'Content-Type': 'application/json; charset=utf-8' }) });
}

export async function POST(request: Request) {
  if (!getMcpConfig().enabled) return responseJson({ error: 'MCP indisponível.' }, 404);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return responseJson({ error: 'Origem não permitida.' }, 403);

  const formData = await request.formData();
  const authorizationId = String(formData.get('authorization_id') || '');
  const decision = String(formData.get('decision') || '');
  if (!/^[A-Za-z0-9_-]{8,240}$/.test(authorizationId) || !['approve', 'deny'].includes(decision)) {
    return responseJson({ error: 'Solicitação inválida.' }, 400);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return responseJson({ error: 'Não autorizado.' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo, must_change_password')
    .eq('id', claimsData.claims.sub)
    .maybeSingle();
  if (!profile?.ativo || profile.must_change_password || !['admin', 'vendedor', 'logistica', 'embaixador'].includes(profile.role)) {
    return responseJson({ error: 'Conta não autorizada.' }, 403);
  }
  if (profile.role === 'embaixador') {
    const { data: ambassador } = await supabase
      .from('ambassadors')
      .select('status')
      .eq('user_id', claimsData.claims.sub)
      .maybeSingle();
    if (ambassador?.status !== 'ativo') return responseJson({ error: 'Conta não autorizada.' }, 403);
  }

  const { data: details, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (detailsError || !details || !('authorization_id' in details)) {
    return responseJson({ error: 'Solicitação OAuth inválida.' }, 400);
  }

  const config = getMcpConfig();
  const { data: approvedAgent, error: agentError } = await supabase.rpc('fn_mcp_get_agent_details', {
    p_client_id: details.client.id,
    p_resource_url: config.resourceUrl,
  });
  if (agentError || !approvedAgent || (approvedAgent as { allowed?: boolean }).allowed !== true) {
    return responseJson({ error: 'Cliente OAuth não aprovado.' }, 403);
  }

  const result = decision === 'approve'
    ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
  if (result.error || !result.data?.redirect_url) {
    return responseJson({ error: 'Não foi possível concluir a decisão OAuth.' }, 400);
  }

  const redirectResponse = NextResponse.redirect(result.data.redirect_url);
  for (const [key, value] of securityHeaders()) redirectResponse.headers.set(key, value);
  return redirectResponse;
}
