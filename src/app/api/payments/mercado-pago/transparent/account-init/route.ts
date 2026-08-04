import { NextResponse } from 'next/server';
import {
  isTransparentCheckoutEnabled,
  prepareAccountTransparentCheckout,
} from '@/lib/mercado-pago/transparent';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    if (!isTransparentCheckoutEnabled()) {
      return NextResponse.json({ error: 'Checkout transparente indisponível durante o rollout.' }, { status: 503 });
    }
    const body = await request.json().catch(() => null) as {
      entityType?: unknown;
      entityId?: unknown;
    } | null;
    if (typeof body?.entityType !== 'string' || typeof body?.entityId !== 'string') {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    }
    const data = await prepareAccountTransparentCheckout(body.entityType, body.entityId);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message.includes('unauthorized') ? 401
      : message.includes('not_linked') ? 403
        : message.includes('not_found') ? 404
          : message.includes('unavailable') ? 409
            : 500;
    if (status >= 500) console.error('Erro ao preparar checkout da conta:', message);
    return NextResponse.json(
      { error: status === 401
        ? 'Faça login novamente para pagar.'
        : status === 403
          ? 'Sua conta ainda não está vinculada a este cadastro.'
          : status === 404
            ? 'Pedido não encontrado.'
            : status === 409
              ? 'Este pedido não está disponível para pagamento.'
              : 'Não foi possível preparar o pagamento.' },
      { status },
    );
  }
}
