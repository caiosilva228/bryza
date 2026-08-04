import { NextResponse } from 'next/server';
import {
  editarEmbaixador,
  getEmbaixadorDetails,
} from '@/app/embaixadores/actions';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error && error.message ? error.message : fallback;
  const status = /n\u00e3o autorizado/i.test(message)
    ? 401
    : /acesso negado/i.test(message)
      ? 403
      : 500;

  console.error('Erro na API de edição de embaixador:', error);
  return NextResponse.json({ error: message }, { status });
}

async function getAmbassadorId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return UUID_PATTERN.test(id) ? id : null;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const ambassadorId = await getAmbassadorId(params);
  if (!ambassadorId) {
    return NextResponse.json({ error: 'Cadastro de embaixador inv\u00e1lido.' }, { status: 400 });
  }

  try {
    const ambassador = await getEmbaixadorDetails(ambassadorId);
    return NextResponse.json(
      { ambassador },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error, 'N\u00e3o foi poss\u00edvel carregar os dados do embaixador.');
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const ambassadorId = await getAmbassadorId(params);
  if (!ambassadorId) {
    return NextResponse.json({ error: 'Cadastro de embaixador inv\u00e1lido.' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inv\u00e1lidos para atualiza\u00e7\u00e3o.' }, { status: 400 });
  }

  if (!isObject(payload)) {
    return NextResponse.json({ error: 'Dados inv\u00e1lidos para atualiza\u00e7\u00e3o.' }, { status: 400 });
  }

  try {
    await editarEmbaixador(ambassadorId, payload);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'N\u00e3o foi poss\u00edvel salvar as altera\u00e7\u00f5es.');
  }
}
