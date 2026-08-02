/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { Webhook } from 'npm:standardwebhooks@1.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

type HookClaims = Record<string, unknown> & {
  client_id?: unknown;
};

type HookPayload = {
  claims?: HookClaims;
  authentication_method?: string | null;
};

function response(claims: HookClaims) {
  return new Response(JSON.stringify({ claims }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function hookError() {
  return new Response(JSON.stringify({ error: 'Falha na verificacao do hook.' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Configure esta Edge Function como HTTP Custom Access Token Hook no Supabase.
// O payload e assinado pelo Supabase e nunca deve ser aceito sem verificacao.
Deno.serve(async (request) => {
  let fallbackClaims: HookClaims = {};
  try {
    const secret = Deno.env.get('CUSTOM_ACCESS_TOKEN_SECRET');
    if (!secret) return hookError();

    const payloadText = await request.text();
    const webhook = new Webhook(secret.replace(/^v1,whsec_/, ''));
    const payload = webhook.verify(payloadText, Object.fromEntries(request.headers)) as HookPayload;
    const claims = payload.claims && typeof payload.claims === 'object'
      ? { ...payload.claims }
      : {};
    const clientId = typeof claims.client_id === 'string' ? claims.client_id : null;
    const isOAuth = typeof payload.authentication_method === 'string'
      && payload.authentication_method.startsWith('oauth');

    // Nunca herdar uma marca MCP de um token anterior sem revalidar o cliente.
    delete claims.mcp_agent;
    delete claims.agent_name;
    fallbackClaims = claims;

    if (!clientId || !isOAuth) return response(claims);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return response(claims);

    const supabase = createClient(
      supabaseUrl,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data, error } = await supabase.rpc('fn_mcp_get_agent_claims', { p_client_id: clientId });
    if (error || !data || data.allowed !== true || !data.claims?.aud) {
      return response(claims);
    }

    claims.aud = data.claims.aud;
    claims.mcp_agent = true;
    claims.agent_name = data.claims.agent_name || clientId;
    return response(claims);
  } catch {
    // Falha de assinatura nunca deve emitir claims controladas pelo solicitante.
    if (Object.keys(fallbackClaims).length === 0) return hookError();
    return response(fallbackClaims);
  }
});
