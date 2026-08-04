import { NextResponse } from 'next/server';
import {
  deleteSavedCardForCurrentUser,
  isTransparentCheckoutEnabled,
} from '@/lib/mercado-pago/transparent';

export const runtime = 'nodejs';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isTransparentCheckoutEnabled()) {
      return NextResponse.json({ error: 'Checkout transparente indisponível durante o rollout.' }, { status: 503 });
    }
    const { id } = await params;
    await deleteSavedCardForCurrentUser(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message.includes('unauthorized') ? 401
      : message.includes('not_linked') ? 403
        : message.includes('not_found') ? 404
          : 500;
    if (status >= 500) console.error('Erro ao remover cartão salvo:', message);
    return NextResponse.json({ error: status === 404 ? 'Cartão não encontrado.' : 'Não foi possível remover o cartão.' }, { status });
  }
}
