import { NextResponse } from 'next/server';
import { fetchDriverRoutes } from '@/services/driversService';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const routes = await fetchDriverRoutes(id);
    return NextResponse.json(routes);
  } catch (error) {
    console.error('Erro ao buscar rotas do motorista:', error);
    return NextResponse.json([], { status: 500 });
  }
}
