import { NextResponse } from 'next/server';
import { getActiveAmbassadorsForCustomerAssignment } from '@/services/clientes';
import { getCurrentProfile } from '@/services/profiles';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();

    if (!profile) {
      return NextResponse.json(
        { success: false, message: 'Usuário não autenticado.' },
        { status: 401 }
      );
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Apenas administradores podem pesquisar embaixadores.' },
        { status: 403 }
      );
    }

    const query = new URL(request.url).searchParams.get('query')?.trim().slice(0, 100) || '';
    const ambassadors = await getActiveAmbassadorsForCustomerAssignment(query);

    return NextResponse.json(
      { success: true, ambassadors },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Erro ao pesquisar embaixadores ativos:', error);
    return NextResponse.json(
      { success: false, message: 'Não foi possível pesquisar os embaixadores.' },
      { status: 500 }
    );
  }
}
