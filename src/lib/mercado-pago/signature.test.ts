import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  mercadoPagoSignatureManifest,
  parseMercadoPagoSignature,
  verifyMercadoPagoSignature,
} from './signature.ts';

test('parses the Mercado Pago x-signature header', () => {
  assert.deepEqual(parseMercadoPagoSignature('ts=1710000000,v1=abc'), {
    ts: '1710000000',
    v1: 'abc',
  });
});

test('accepts a valid signature and rejects tampering', () => {
  const secret = 'webhook-secret';
  const ts = '1710000000';
  const requestId = 'request-123';
  const dataId = 'PAYMENT-456';
  const digest = crypto
    .createHmac('sha256', secret)
    .update(mercadoPagoSignatureManifest(dataId, requestId, ts))
    .digest('hex');
  const nowMs = Number(ts) * 1000;

  assert.equal(verifyMercadoPagoSignature({
    signatureHeader: `ts=${ts},v1=${digest}`,
    requestId,
    dataId,
    secret,
    nowMs,
  }), true);
  assert.equal(verifyMercadoPagoSignature({
    signatureHeader: `ts=${ts},v1=${digest}`,
    requestId,
    dataId: 'different',
    secret,
    nowMs,
  }), false);
});

test('rejects stale signatures', () => {
  const ts = '1710000000';
  const secret = 'webhook-secret';
  const requestId = 'request-123';
  const dataId = '456';
  const digest = crypto
    .createHmac('sha256', secret)
    .update(mercadoPagoSignatureManifest(dataId, requestId, ts))
    .digest('hex');

  assert.equal(verifyMercadoPagoSignature({
    signatureHeader: `ts=${ts},v1=${digest}`,
    requestId,
    dataId,
    secret,
    nowMs: Number(ts) * 1000 + 301_000,
  }), false);
});
