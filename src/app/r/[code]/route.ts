import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSignedReferralCookie, COOKIE_NAME } from '@/lib/referral/cookie';
import { generateIpHash } from '@/lib/referral/ip-hash';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const codeParam = (code || '').toLowerCase().trim();

  // 1. Validar Regex Estrita
  if (!/^bryza[0-9]+$/.test(codeParam)) {
    return NextResponse.redirect(new URL('/', request.url), 307);
  }

  try {
    // 2. Localizar Embaixador Ativo
    const { data: amb } = await supabaseAdmin
      .from('ambassadors')
      .select('id, referral_code, status')
      .eq('status', 'ativo')
      .ilike('referral_code', codeParam)
      .maybeSingle();

    if (!amb) {
      return NextResponse.redirect(new URL('/', request.url), 307);
    }

    // 3. Extrair UTMs sanitizados
    const searchParams = request.nextUrl.searchParams;
    const allowedUtms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const utms: Record<string, string> = {};

    allowedUtms.forEach((key) => {
      const val = searchParams.get(key);
      if (val) {
        utms[key] = val.slice(0, 150);
      }
    });

    // 4. Origem e User Agent
    const referer = request.headers.get('referer');
    let safeOrigin = '';
    if (referer) {
      try {
        const u = new URL(referer);
        safeOrigin = `${u.protocol}//${u.host}`.slice(0, 500);
      } catch {
        safeOrigin = '';
      }
    }

    const userAgent = (request.headers.get('user-agent') || '').slice(0, 500);
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1';
    const ipHash = generateIpHash(clientIp);

    // Session ID no Cookie de Visita Anônima
    let visitSessionId = request.cookies.get('bryza_visit_session')?.value;
    if (!visitSessionId || !/^[0-9a-fA-F-]{36}$/.test(visitSessionId)) {
      visitSessionId = crypto.randomUUID();
    }

    // 5. Registrar Visita em referral_visits
    const { data: visitRecord } = await supabaseAdmin
      .from('referral_visits')
      .insert({
        ambassador_id: amb.id,
        referral_code: amb.referral_code,
        session_id: visitSessionId,
        origin: safeOrigin,
        utms,
        landing_path: `/${codeParam}`,
        device_summary: userAgent,
        ip_hash: ipHash,
      })
      .select('id')
      .single();

    // 6. Criar Cookie HMAC de Atribuição (30 dias)
    const signedCookieVal = createSignedReferralCookie(amb.referral_code, visitRecord?.id, 'smart_link');

    // Sempre redirecionar para a Landing Page pública (bryza.com.br/bryzaNN)
    const port = host.includes(':') ? `:${host.split(':')[1]}` : '';
    const isProd = process.env.NODE_ENV === 'production' || host.includes('bryza.com.br');
    const targetBaseUrl = isProd 
      ? 'https://bryza.com.br' 
      : host.includes('.local') 
        ? `http://bryza.local${port}` 
        : `http://localhost${port}`;

    const response = NextResponse.redirect(new URL(`/${codeParam}`, targetBaseUrl), 307);

    response.cookies.set(COOKIE_NAME, signedCookieVal, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    response.cookies.set('bryza_visit_session', visitSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Erro no tracking de referral:', error);
    const port = host.includes(':') ? `:${host.split(':')[1]}` : '';
    const isProd = process.env.NODE_ENV === 'production' || host.includes('bryza.com.br');
    const targetBaseUrl = isProd 
      ? 'https://bryza.com.br' 
      : host.includes('.local') 
        ? `http://bryza.local${port}` 
        : `http://localhost${port}`;
    return NextResponse.redirect(new URL(`/${codeParam}`, targetBaseUrl), 307);
  }
}
