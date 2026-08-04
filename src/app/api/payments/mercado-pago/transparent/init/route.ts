import { NextResponse } from 'next/server';
import {
  assertCheckoutToken,
  initializeTransparentCheckout,
  isTransparentCheckoutEnabled,
} from '@/lib/mercado-pago/transparent';

export const runtime = 'nodejs';

function errorStatus(message: string) {
  if (message === 'payment_intent_not_found') return 404;
  if (message === 'payment_unavailable') return 409;
  if (message.startsWith('Mercado Pago não configurado')) return 503;
  return 500;
}

export async function GET(request: Request) {
  try {
    if (!isTransparentCheckoutEnabled()) {
      return NextResponse.json({
        error: 'Checkout transparente indisponível durante o rollout.',
        transparentEnabled: false,
      }, { status: 503 });
    }
    const checkoutToken = new URL(request.url).searchParams.get('checkoutToken');
    assertCheckoutToken(checkoutToken);
    const data = await initializeTransparentCheckout(checkoutToken);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'invalid_checkout_token') {
      return NextResponse.json({ error: 'Identificador de pagamento inválido.' }, { status: 400 });
    }
    console.error('Erro ao inicializar checkout transparente:', message);
    return NextResponse.json(
      { error: message === 'payment_unavailable'
        ? 'Este pagamento não está disponível.'
        : 'Não foi possível inicializar o pagamento.' },
      { status: errorStatus(message) },
    );
  }
}
