import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { getMcpConfig, isMcpRole, type McpRole } from './config.ts';
import { McpHttpError } from './http.ts';
import type { McpAuthContext, McpSupabaseClient } from './types.ts';

type McpClaims = JWTPayload & Record<string, unknown>;

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(url: string) {
  const existing = jwksByUrl.get(url);
  if (existing) return existing;
  const created = createRemoteJWKSet(new URL(url));
  jwksByUrl.set(url, created);
  return created;
}

export function createTokenClient(accessToken: string): McpSupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase não está configurado para o MCP.');
  }

  return createSupabaseClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  }) as McpSupabaseClient;
}

export function extractBearerToken(request: Request): string {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(header.trim());
  if (!match) throw new McpHttpError(401, 'missing_bearer', 'Bearer ausente ou inválido.');
  return match[1];
}

async function verifyJwt(accessToken: string): Promise<McpClaims> {
  const config = getMcpConfig();
  if (!config.issuer || !config.jwksUrl) {
    throw new McpHttpError(503, 'auth_not_configured', 'Autenticação MCP não configurada.');
  }

  try {
    const { payload } = await jwtVerify(accessToken, getJwks(config.jwksUrl), {
      issuer: config.issuer,
      audience: config.resourceUrl,
      algorithms: ['RS256', 'ES256', 'EdDSA'],
    });
    return payload as McpClaims;
  } catch {
    throw new McpHttpError(401, 'invalid_token', 'Token inválido.');
  }
}

function claimString(claims: McpClaims, name: string): string | null {
  const value = claims[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function validateApprovedAgent(
  supabase: McpSupabaseClient,
  clientId: string,
): Promise<{ allowed: boolean; display_name?: string | null }> {
  const config = getMcpConfig();
  const { data, error } = await supabase.rpc('fn_mcp_validate_agent', {
    p_client_id: clientId,
    p_resource_url: config.resourceUrl,
  });
  if (error || !data || typeof data !== 'object') {
    throw new McpHttpError(403, 'client_not_approved', 'Cliente OAuth não aprovado.');
  }
  const result = data as { allowed?: boolean; display_name?: string | null };
  if (result.allowed !== true) {
    throw new McpHttpError(403, 'client_not_approved', 'Cliente OAuth não aprovado.');
  }
  return { allowed: true, display_name: result.display_name };
}

export async function authenticateMcpRequest(request: Request): Promise<McpAuthContext> {
  const accessToken = extractBearerToken(request);
  const claims = await verifyJwt(accessToken);
  const config = getMcpConfig();
  const userId = claimString(claims, 'sub');
  const clientId = claimString(claims, 'client_id');

  if (!userId || !clientId) {
    throw new McpHttpError(401, 'invalid_token', 'Token sem identidade MCP.');
  }
  if (claims.mcp_agent !== true) {
    throw new McpHttpError(403, 'agent_not_approved', 'Token não emitido para um agente MCP aprovado.');
  }

  const supabase = createTokenClient(accessToken);
  const agent = await validateApprovedAgent(supabase, clientId);

  const { data: authUser, error: authUserError } = await supabase.auth.getUser(accessToken);
  if (authUserError || !authUser.user || authUser.user.id !== userId) {
    throw new McpHttpError(401, 'invalid_token', 'Usuário do token não está ativo.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, ativo, must_change_password')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile || !profile.ativo || profile.must_change_password) {
    throw new McpHttpError(403, 'user_not_allowed', 'Usuário sem permissão para o MCP.');
  }
  if (!isMcpRole(profile.role)) {
    throw new McpHttpError(403, 'role_not_allowed', 'Papel não habilitado para o MCP.');
  }

  if (profile.role === 'embaixador') {
    const { data: ambassador, error: ambassadorError } = await supabase
      .from('ambassadors')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle();
    if (ambassadorError || !ambassador || ambassador.status !== 'ativo') {
      throw new McpHttpError(403, 'ambassador_not_active', 'Embaixador sem status ativo.');
    }
  }

  return {
    userId,
    role: profile.role as McpRole,
    clientId,
    agentName: agent.display_name || clientId,
    supabase,
    claims,
  };
}
