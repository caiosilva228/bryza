import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMercadoPagoConfig } from '@/lib/mercado-pago/config';
import { getMercadoPagoPayment } from '@/lib/mercado-pago/client';
import { verifyMercadoPagoSignature } from '@/lib/mercado-pago/signature';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody || '{}') as {
      id?: string | number;
      type?: string;
      topic?: string;
      data?: { id?: string | number };
    };
    const url = new URL(request.url);
    const dataId = String(url.searchParams.get('data.id') || body.data?.id || '');
    const topic = String(body.type || body.topic || url.searchParams.get('type') || '');
    if (!dataId || (topic && topic !== 'payment')) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const config = getMercadoPagoConfig();
    const requestId = request.headers.get('x-request-id');
    const validSignature = verifyMercadoPagoSignature({
      signatureHeader: request.headers.get('x-signature'),
      requestId,
      dataId,
      secret: config.webhookSecret,
    });
    if (!validSignature) {
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 });
    }

    const payment = await getMercadoPagoPayment(config.accessToken, dataId);
    const paymentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payment))
      .digest('hex');
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('fn_reconcile_mercado_pago_payment', {
      p_event_id: body.id ? String(body.id) : null,
      p_request_id: requestId,
      p_payment: payment,
      p_payload_hash: `\\x${paymentHash}`,
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ received: true, result: data });
  } catch (error) {
    console.error('Erro no webhook do Mercado Pago:', error);
    return NextResponse.json({ error: 'Falha ao processar notificação.' }, { status: 500 });
  }
}
