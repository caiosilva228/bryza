import { NextResponse } from 'next/server';
import {
  deleteSavedCardForCurrentUser,
  isTransparentCheckoutEnabled,
  listSavedCardsForCurrentUser,
} from '@/lib/mercado-pago/transparent';

export const runtime = 'nodejs';

function authStatus(message: string) {
  if (message.includes('unauthorized')) return 401;
  if (message.includes('not_linked')) return 403;
  if (message.includes('not_found')) return 404;
  if (message.startsWith('Mercado Pago não configurado')) return 503;
  return 500;
}

export async function GET() {
  try {
    if (!isTransparentCheckoutEnabled()) {
      return NextResponse.json({ error: 'Checkout transparente indisponível durante o rollout.' }, { status: 503 });
    }
    return NextResponse.json({ cards: await listSavedCardsForCurrentUser() }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = authStatus(message);
    if (status >= 500) console.error('Erro ao listar cartões salvos:', message);
    return NextResponse.json({ error: status === 401 ? 'Faça login novamente.' : 'Não foi possível carregar seus cartões.' }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isTransparentCheckoutEnabled()) {
      return NextResponse.json({ error: 'Checkout transparente indisponível durante o rollout.' }, { status: 503 });
    }
    const body = await request.json().catch(() => null) as { cardId?: unknown } | null;
    if (typeof body?.cardId !== 'string') {
      return NextResponse.json({ error: 'Cartão inválido.' }, { status: 400 });
    }
    await deleteSavedCardForCurrentUser(body.cardId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = authStatus(message);
    if (status >= 500) console.error('Erro ao remover cartão salvo:', message);
    return NextResponse.json({ error: status === 404 ? 'Cartão não encontrado.' : 'Não foi possível remover o cartão.' }, { status });
  }
}
