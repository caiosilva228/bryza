const DEFAULT_RESOURCE_URL = 'https://admin.bryza.com.br/api/mcp';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === 'true';
}

function parseInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function csv(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const MCP_ROLES = ['admin', 'vendedor', 'logistica', 'embaixador'] as const;
export type McpRole = (typeof MCP_ROLES)[number];

export function getMcpConfig() {
  const supabaseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
  const resourceUrl = trimTrailingSlash(process.env.MCP_RESOURCE_URL || DEFAULT_RESOURCE_URL);

  return {
    enabled: parseBoolean(process.env.MCP_ENABLED, false),
    writesEnabled: parseBoolean(process.env.MCP_WRITES_ENABLED, false),
    resourceUrl,
    protectedResourceMetadataUrl: new URL('/.well-known/oauth-protected-resource', `${resourceUrl}/`).toString(),
    issuer: supabaseUrl ? `${supabaseUrl}/auth/v1` : '',
    jwksUrl: supabaseUrl ? `${supabaseUrl}/auth/v1/.well-known/jwks.json` : '',
    allowedOrigins: csv(process.env.MCP_ALLOWED_ORIGINS),
    confirmationTtlSeconds: parseInteger(process.env.MCP_CONFIRMATION_TTL_SECONDS, 300, 60, 900),
    maxDateRangeDays: parseInteger(process.env.MCP_MAX_DATE_RANGE_DAYS, 31, 1, 31),
    maxPageSize: parseInteger(process.env.MCP_MAX_PAGE_SIZE, 50, 1, 50),
  };
}

export function isMcpRole(value: unknown): value is McpRole {
  return typeof value === 'string' && (MCP_ROLES as readonly string[]).includes(value);
}
