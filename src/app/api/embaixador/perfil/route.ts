import { NextResponse } from 'next/server';
import {
  atualizarMeuPerfil,
  getMeuPerfilData,
  getSignedProfilePhotoUrl,
} from '@/app/embaixador/actions';
import type { AmbassadorProfileData } from '@/app/embaixador/actions';

export const dynamic = 'force-dynamic';

type ProfileUpdatePayload = Parameters<typeof atualizarMeuPerfil>[0];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getErrorStatus(message: string) {
  if (/sess\u00e3o inv\u00e1lida|n\u00e3o autenticad/i.test(message)) return 401;
  if (/acesso n\u00e3o autorizado|acesso negado|inativo/i.test(message)) return 403;
  if (/perfil de embaixador n\u00e3o encontrado/i.test(message)) return 404;
  return 500;
}

function errorResponse(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);
  console.error('Erro na API de perfil do embaixador:', error);
  return NextResponse.json(
    { error: message },
    { status: getErrorStatus(message) },
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const profile = await getMeuPerfilData();
    let photoUrl: string | null = null;

    if (profile.photo_path) {
      try {
        photoUrl = await getSignedProfilePhotoUrl(profile.photo_path);
      } catch (error) {
        console.error('Erro ao gerar URL da foto do perfil:', error);
      }
    }

    return NextResponse.json(
      { profile: profile as AmbassadorProfileData, photo_url: photoUrl },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error, 'N\u00e3o foi poss\u00edvel carregar os dados do perfil.');
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Dados inv\u00e1lidos para atualiza\u00e7\u00e3o do perfil.' },
      { status: 400 },
    );
  }

  if (!isObject(payload)) {
    return NextResponse.json(
      { error: 'Dados inv\u00e1lidos para atualiza\u00e7\u00e3o do perfil.' },
      { status: 400 },
    );
  }

  try {
    await atualizarMeuPerfil(payload as ProfileUpdatePayload);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'N\u00e3o foi poss\u00edvel salvar os dados do perfil.');
  }
}
