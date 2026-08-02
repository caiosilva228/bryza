import { getMcpConfig } from '@/lib/mcp/config';
import { jsonResponse } from '@/lib/mcp/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getMcpConfig();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');

  return jsonResponse({
    resource: config.resourceUrl,
    authorization_servers: supabaseUrl ? [`${supabaseUrl}/auth/v1`] : [],
    scopes_supported: ['openid', 'email', 'profile'],
    bearer_methods_supported: ['header'],
  });
}

