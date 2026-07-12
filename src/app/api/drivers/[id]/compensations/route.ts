import { NextResponse } from 'next/server';
import { fetchDriverCompensations } from '@/services/driversService';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const compensations = await fetchDriverCompensations(id);
    return NextResponse.json(compensations);
  } catch (error) {
    console.error('Erro ao buscar remunerações do motorista:', error);
    return NextResponse.json([], { status: 500 });
  }
}
