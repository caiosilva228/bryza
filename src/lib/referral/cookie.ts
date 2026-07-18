import 'server-only';
import crypto from 'node:crypto';

const COOKIE_NAME = 'bryza_ref';
function requireServerSecret(value: string | undefined, name: string): string {
  if (!value || value.length < 32) throw new Error(`${name} seguro não configurado no servidor.`);
  return value;
}

const COOKIE_SECRET = requireServerSecret(
  process.env.REFERRAL_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY,
  'REFERRAL_COOKIE_SECRET',
);

export interface ReferralPayload {
  visit_id?: string;
  referral_code: string;
  source?: string;
  issued_at: number;
  expires_at: number;
}

function sign(payloadStr: string): string {
  const hmac = crypto.createHmac('sha256', COOKIE_SECRET);
  hmac.update(payloadStr);
  return hmac.digest('hex');
}

export function createSignedReferralCookie(referralCode: string, visitId?: string, source = 'smart_link'): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: ReferralPayload = {
    visit_id: visitId,
    referral_code: referralCode.toLowerCase(),
    source,
    issued_at: now,
    expires_at: now + 30 * 24 * 60 * 60, // 30 dias
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function verifyAndParseReferralCookie(cookieValue?: string): ReferralPayload | null {
  if (!cookieValue || !cookieValue.includes('.')) {
    return null;
  }

  const [payloadBase64, signature] = cookieValue.split('.');
  if (!payloadBase64 || !signature) {
    return null;
  }

  const expectedSignature = sign(payloadBase64);
  
  // Timing safe comparison
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null; // Assinatura inválida
  }

  try {
    const jsonStr = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload: ReferralPayload = JSON.parse(jsonStr);

    const now = Math.floor(Date.now() / 1000);
    if (payload.expires_at < now) {
      return null; // Token expirado
    }

    if (!payload.referral_code || !/^bryza[0-9]+$/.test(payload.referral_code)) {
      return null; // Código inválido
    }

    return payload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
