import crypto from 'node:crypto';

const IP_HASH_SECRET = process.env.REFERRAL_IP_HASH_SECRET || 'bryza_ip_hash_secret_staging_key!';

export function generateIpHash(ip: string): string {
  const normalizedIp = (ip || '127.0.0.1').trim().toLowerCase();
  const hmac = crypto.createHmac('sha256', IP_HASH_SECRET);
  hmac.update(normalizedIp);
  return hmac.digest('hex');
}
