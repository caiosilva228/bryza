import crypto from 'node:crypto';

type SignatureParts = {
  ts: string;
  v1: string;
};

export function parseMercadoPagoSignature(header: string | null): SignatureParts | null {
  if (!header) return null;
  const values = new Map(
    header.split(',').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
    }),
  );
  const ts = values.get('ts');
  const v1 = values.get('v1');
  return ts && v1 ? { ts, v1 } : null;
}

export function mercadoPagoSignatureManifest(
  dataId: string,
  requestId: string,
  timestamp: string,
) {
  return `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
}

export function verifyMercadoPagoSignature(input: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string;
  secret: string;
  nowMs?: number;
  toleranceSeconds?: number;
}) {
  const signature = parseMercadoPagoSignature(input.signatureHeader);
  if (!signature || !input.requestId || !input.dataId || !input.secret) return false;
  if (!/^\d+$/.test(signature.ts) || !/^[a-f0-9]{64}$/i.test(signature.v1)) return false;

  const timestampMs = Number(signature.ts) * 1000;
  const tolerance = (input.toleranceSeconds ?? 300) * 1000;
  if (Math.abs((input.nowMs ?? Date.now()) - timestampMs) > tolerance) return false;

  const manifest = mercadoPagoSignatureManifest(
    input.dataId,
    input.requestId,
    signature.ts,
  );
  const expected = crypto
    .createHmac('sha256', input.secret)
    .update(manifest)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature.v1, 'hex'),
  );
}
