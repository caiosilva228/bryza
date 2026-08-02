import { getMcpConfig } from './config.ts';

export class McpHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'McpHttpError';
    this.status = status;
    this.code = code;
  }
}

export function isAllowedMcpOrigin(origin: string | null): boolean {
  if (!origin) return true;
  const config = getMcpConfig();
  return config.allowedOrigins.includes(origin);
}

export function securityHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set('Cache-Control', 'no-store, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  return headers;
}

export function jsonResponse(body: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = securityHeaders(extra);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

export function unauthorizedResponse(error = 'invalid_token'): Response {
  const config = getMcpConfig();
  const challenge = `Bearer resource_metadata="${config.protectedResourceMetadataUrl}", error="${error}"`;
  return jsonResponse({ error: 'Não autorizado.' }, 401, { 'WWW-Authenticate': challenge });
}

export function forbiddenResponse(message = 'Origem não permitida.'): Response {
  return jsonResponse({ error: message }, 403);
}

export function tooManyRequestsResponse(): Response {
  return jsonResponse({ error: 'Limite de requisições excedido.' }, 429, { 'Retry-After': '60' });
}
