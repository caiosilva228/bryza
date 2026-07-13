import { NextResponse } from 'next/server';
import { fetchAgendamentosByDate } from '@/services/agendamentos';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }
    const agendamentos = await fetchAgendamentosByDate(date);
    return NextResponse.json({ agendamentos });
  } catch (error) {
    console.error('Erro ao buscar notificações de agendamentos:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
