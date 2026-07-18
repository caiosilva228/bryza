import 'server-only';
import crypto from 'node:crypto';

function requireServerSecret(value: string | undefined, name: string): string {
  if (!value || value.length < 32) throw new Error(`${name} seguro não configurado no servidor.`);
  return value;
}

const IP_HASH_SECRET = requireServerSecret(
  process.env.REFERRAL_IP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY,
  'REFERRAL_IP_HASH_SECRET',
);

export function generateIpHash(ip: string): string {
  const normalizedIp = (ip || '127.0.0.1').trim().toLowerCase();
  const hmac = crypto.createHmac('sha256', IP_HASH_SECRET);
  hmac.update(normalizedIp);
  return hmac.digest('hex');
}
