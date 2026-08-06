import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const tableName = 'zelo-leads-lançamento';

type UnknownRecord = Record<string, unknown>;

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeTracking(value: unknown) {
  if (!value || typeof value !== 'object') return {};
  const input = value as UnknownRecord;
  const result: UnknownRecord = {};

  for (const key of ['current', 'first_touch', 'last_touch']) {
    const touch = input[key];
    if (!touch || typeof touch !== 'object') continue;
    const safeTouch = touch as UnknownRecord;
    result[key] = {
      captured_at: text(safeTouch.captured_at, 60),
      origem: text(safeTouch.origem, 50),
      canal: text(safeTouch.canal, 80),
      campanha: text(safeTouch.campanha, 180) || null,
      conjunto_anuncio: text(safeTouch.conjunto_anuncio, 180) || null,
      criativo: text(safeTouch.criativo, 180) || null,
      utm_source: text(safeTouch.utm_source, 180) || null,
      utm_medium: text(safeTouch.utm_medium, 180) || null,
      utm_campaign: text(safeTouch.utm_campaign, 180) || null,
      utm_content: text(safeTouch.utm_content, 180) || null,
      utm_term: text(safeTouch.utm_term, 180) || null,
      click_id: text(safeTouch.click_id, 240) || null,
      click_id_tipo: text(safeTouch.click_id_tipo, 40) || null,
      referrer: text(safeTouch.referrer, 500) || null,
      landing_page: text(safeTouch.landing_page, 500),
      params: normalizeParams(safeTouch.params),
    };
  }

  return result;
}

function normalizeParams(value: unknown) {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value as UnknownRecord).slice(0, 40)) {
    if (typeof rawValue === 'string') result[text(key, 60)] = rawValue.slice(0, 180);
  }
  return result;
}

function getDeviceType(userAgent: string) {
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  if (/mobile|android|iphone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

export async function POST(request: Request) {
  let body: UnknownRecord;

  try {
    body = (await request.json()) as UnknownRecord;
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  if (text(body.honeypot, 100)) {
    return NextResponse.json({ success: true });
  }

  const nome = text(body.nome, 120);
  const whatsapp = text(body.whatsapp, 40);
  const whatsappNormalizado = whatsapp.replace(/\D/g, '');

  if (nome.length < 2) {
    return NextResponse.json({ error: 'Digite seu nome para continuar.' }, { status: 400 });
  }
  if (whatsappNormalizado.length < 10 || whatsappNormalizado.length > 15) {
    return NextResponse.json({ error: 'Digite um WhatsApp válido com DDD.' }, { status: 400 });
  }

  const attribution = body.attribution && typeof body.attribution === 'object'
    ? body.attribution as UnknownRecord
    : {};
  const current = attribution.current && typeof attribution.current === 'object'
    ? attribution.current as UnknownRecord
    : {};
  const requestReferrer = request.headers.get('referer');
  const userAgent = text(request.headers.get('user-agent'), 500);
  const origem = text(current.origem, 50) || 'direto';
  const canal = text(current.canal, 80) || origem;

  const row = {
    nome,
    whatsapp,
    whatsapp_normalizado: whatsappNormalizado,
    origem,
    canal,
    campanha: text(current.campanha, 180) || null,
    conjunto_anuncio: text(current.conjunto_anuncio, 180) || null,
    criativo: text(current.criativo, 180) || null,
    utm_source: text(current.utm_source, 180) || null,
    utm_medium: text(current.utm_medium, 180) || null,
    utm_campaign: text(current.utm_campaign, 180) || null,
    utm_content: text(current.utm_content, 180) || null,
    utm_term: text(current.utm_term, 180) || null,
    click_id: text(current.click_id, 240) || null,
    click_id_tipo: text(current.click_id_tipo, 40) || null,
    referrer: text(current.referrer, 500) || requestReferrer,
    landing_page: text(current.landing_page, 500) || '/zelo-lancamento',
    tracking_data: normalizeTracking(attribution),
    device_type: getDeviceType(userAgent),
    user_agent: userAgent || null,
  };

  const supabase = await createClient();
  const { error } = await supabase.from(tableName).insert(row);

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Este WhatsApp já está na lista. O grupo fechado será o próximo passo.' },
        { status: 409 },
      );
    }

    console.error('Erro ao salvar lead do Zelo:', error);
    return NextResponse.json({ error: 'Não foi possível concluir seu cadastro agora.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
