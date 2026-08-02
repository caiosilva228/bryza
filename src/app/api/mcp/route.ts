import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getMcpConfig } from '@/lib/mcp/config';
import { authenticateMcpRequest } from '@/lib/mcp/auth';
import { makeRequestId } from '@/lib/mcp/crypto';
import { forbiddenResponse, jsonResponse, securityHeaders, tooManyRequestsResponse, unauthorizedResponse } from '@/lib/mcp/http';
import { buildMcpServer } from '@/lib/mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function withCors(response: Response, origin: string | null): Response {
  if (!origin || !getMcpConfig().allowedOrigins.includes(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
  headers.set('Access-Control-Expose-Headers', 'Mcp-Session-Id, Last-Event-ID, WWW-Authenticate, X-Request-Id');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

type RateCounts = { read: number; prepare: number; execute: number };

function addRateCount(counts: RateCounts, message: unknown): void {
  const record = message && typeof message === 'object' ? message as { method?: unknown; params?: unknown } : {};
  if (record.method !== 'tools/call') {
    counts.read += 1;
    return;
  }

  const params = record.params && typeof record.params === 'object'
    ? record.params as { name?: unknown }
    : {};
  const name = typeof params.name === 'string' ? params.name : '';
  if (name === 'execute_confirmed_action') counts.execute += 1;
  else if (name.startsWith('prepare_')) counts.prepare += 1;
  else counts.read += 1;
}

async function getRateCounts(request: Request): Promise<RateCounts> {
  const counts: RateCounts = { read: 0, prepare: 0, execute: 0 };
  if (request.method !== 'POST') {
    counts.read = 1;
    return counts;
  }

  try {
    const body = await request.clone().json();
    if (Array.isArray(body)) body.forEach((message) => addRateCount(counts, message));
    else addRateCount(counts, body);
  } catch {
    counts.read = 1;
  }
  return counts;
}

async function handleMcpRequest(request: Request): Promise<Response> {
  const config = getMcpConfig();
  const requestId = makeRequestId(request.headers.get('x-request-id'));

  if (!config.enabled) {
    return jsonResponse({ error: 'MCP desativado.' }, 404, { 'X-Request-Id': requestId });
  }

  const origin = request.headers.get('origin');
  if (origin && !config.allowedOrigins.includes(origin)) return forbiddenResponse();

  let context;
  try {
    context = await authenticateMcpRequest(request);
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && (error as { status?: unknown }).status === 503) {
      return jsonResponse({ error: 'MCP temporariamente indisponivel.' }, 503, { 'X-Request-Id': requestId });
    }
    const status = error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status || 401)
      : 401;
    if (status === 403) {
      return jsonResponse({ error: 'Acesso MCP nao permitido.' }, 403, { 'X-Request-Id': requestId });
    }
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || 'invalid_token')
      : 'invalid_token';
    const response = unauthorizedResponse(code === 'missing_bearer' ? 'invalid_request' : 'invalid_token');
    response.headers.set('X-Request-Id', requestId);
    return response;
  }

  const rateCounts = await getRateCounts(request);
  for (const [bucket, count] of Object.entries(rateCounts)) {
    if (count < 1) continue;
    const { data: allowed, error: rateError } = await context.supabase.rpc('fn_mcp_consume_rate_limit', {
      p_bucket: bucket,
      p_count: count,
    });
    if (rateError) {
      return jsonResponse({ error: 'Limitador MCP temporariamente indisponivel.' }, 503, { 'X-Request-Id': requestId });
    }
    if (allowed !== true) {
      const response = tooManyRequestsResponse();
      response.headers.set('X-Request-Id', requestId);
      return response;
    }
  }

  const server = buildMcpServer(context, requestId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    keepAliveMs: 15000,
  });
  const authInfo: AuthInfo = {
    token: 'redacted',
    clientId: context.clientId,
    scopes: [],
    extra: {
      userId: context.userId,
      role: context.role,
    },
  };

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, { authInfo });
    const headers = securityHeaders(response.headers);
    headers.set('X-Request-Id', requestId);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return jsonResponse({ error: 'Erro interno do servidor MCP.' }, 500, { 'X-Request-Id': requestId });
  }
}

export async function GET(request: Request) {
  return withCors(await handleMcpRequest(request), request.headers.get('origin'));
}

export async function POST(request: Request) {
  return withCors(await handleMcpRequest(request), request.headers.get('origin'));
}

export async function DELETE(request: Request) {
  return withCors(await handleMcpRequest(request), request.headers.get('origin'));
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && !getMcpConfig().allowedOrigins.includes(origin)) return forbiddenResponse();
  return withCors(new Response(null, {
    status: 204,
    headers: securityHeaders({
      Allow: 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Max-Age': '600',
    }),
  }), origin);
}
