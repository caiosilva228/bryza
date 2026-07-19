/**
 * Utilitário centralizado de variáveis de ambiente do sistema Bryza.
 * Garante segurança, valores padrão seguros e facilidade de manutenção.
 */

export const env = {
  // Credenciais do Supabase
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kkjrunhubqixftemndrm.supabase.co',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // URL Base da Aplicação
  appUrl: (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://bryza.com.br'
  ).replace(/\/$/, ''),

  // Domínio dos E-mails Sintéticos dos Usuários
  internalUserDomain: process.env.INTERNAL_USER_DOMAIN || 'usuarios.bryza.internal',

  // Segredos de Segurança e Hash
  ipHashSecret: process.env.REFERRAL_IP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'bryza_secret_ip_hash',
  cookieSecret: process.env.REFERRAL_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'bryza_secret_cookie',
};

/**
 * Função utilitária para gerar links de indicação seguros e dinâmicos
 */
export function getReferralUrl(username: string): string {
  return `${env.appUrl}/r/${encodeURIComponent(username)}`;
}

/**
 * Função utilitária para gerar e-mails internos sintéticos
 */
export function getSyntheticEmail(username: string): string {
  return `${username}@${env.internalUserDomain}`;
}
