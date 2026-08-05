import { NextResponse } from 'next/server';
import {
  assertCheckoutToken,
  assertIdempotencyKey,
  isTransparentCheckoutEnabled,
  submitTransparentPayment,
} from '@/lib/mercado-pago/transparent';

export const runtime = 'nodejs';

function statusForError(message: string) {
  if (message === 'invalid_checkout_token'
    || message === 'invalid_idempotency_key'
    || message === 'payment_method_missing'
    || message === 'payer_email_missing') return 400;
  if (message === 'payment_intent_not_found') return 404;
  if (message === 'payment_attempt_in_progress' || message === 'payment_unavailable') return 409;
  if (message.startsWith('Mercado Pago não configurado')) return 503;
  if (message.startsWith('Mercado Pago recusou')) return 422;
  return 500;
}

export async function POST(request: Request) {
  try {
    if (!isTransparentCheckoutEnabled()) {
      return NextResponse.json({ error: 'Checkout transparente indisponível durante o rollout.' }, { status: 503 });
    }
    const body = await request.json().catch(() => null) as {
      checkoutToken?: unknown;
      idempotencyKey?: unknown;
      formData?: unknown;
    } | null;
    assertCheckoutToken(body?.checkoutToken);
    assertIdempotencyKey(body?.idempotencyKey);
    const data = await submitTransparentPayment({
      checkoutToken: body.checkoutToken,
      idempotencyKey: body.idempotencyKey.trim(),
      formData: body.formData,
    });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'invalid_checkout_token' || message === 'invalid_idempotency_key') {
      return NextResponse.json({ error: 'Identificadores de pagamento inválidos.' }, { status: 400 });
    }
    if (message === 'payer_email_missing') {
      return NextResponse.json({ error: 'Informe um e-mail valido para concluir o pagamento.' }, { status: 400 });
    }
    if (message === 'payment_method_missing') {
      return NextResponse.json({ error: 'Selecione uma forma de pagamento para continuar.' }, { status: 400 });
    }
    console.error('Erro no checkout transparente do Mercado Pago:', message);
    return NextResponse.json(
      { error: message === 'payment_attempt_in_progress'
        ? 'Já existe uma tentativa de pagamento em andamento. Aguarde alguns segundos.'
        : message === 'payment_unavailable'
          ? 'Este pagamento não está mais disponível.'
          : message.startsWith('Mercado Pago recusou')
            ? message
            : 'Não foi possível processar o pagamento.' },
      { status: statusForError(message) },
    );
  }
}
