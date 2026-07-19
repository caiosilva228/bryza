import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';

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

  // 1. Validar Regex
  if (!/^bryza[0-9]+$/.test(codeParam)) {
    return new NextResponse('Código inválido', { status: 400 });
  }

  // 2. Confirmar embaixador ativo
  const { data: amb } = await supabaseAdmin
    .from('ambassadors')
    .select('id')
    .eq('status', 'ativo')
    .ilike('referral_code', codeParam)
    .maybeSingle();

  if (!amb) {
    return new NextResponse('Embaixador não encontrado ou inativo', { status: 404 });
  }

  // 3. Gerar URL pública oficial
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://bryza.com.br';
  const trackingUrl = `${baseUrl}/r/${codeParam}`;

  try {
    // 4. Gerar SVG do QR Code
    const svgString = await QRCode.toString(trackingUrl, {
      type: 'svg',
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    return new NextResponse(svgString, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
      },
    });
  } catch (error) {
    console.error('Erro ao gerar QR Code:', error);
    return new NextResponse('Erro interno ao gerar QR Code', { status: 500 });
  }
}
