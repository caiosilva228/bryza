import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  assertMercadoPagoPublicUrl,
  getMercadoPagoConfig,
} from '@/lib/mercado-pago/config';
import { createMercadoPagoPreference } from '@/lib/mercado-pago/client';

export const runtime = 'nodejs';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { checkoutToken?: string } | null;
    const checkoutToken = body?.checkoutToken || '';
    if (!UUID_PATTERN.test(checkoutToken)) {
      return NextResponse.json({ error: 'Identificador de pagamento inválido.' }, { status: 400 });
    }

    const config = getMercadoPagoConfig();
    assertMercadoPagoPublicUrl(config.appUrl);
    const admin = createAdminClient();
    const { data: intent, error } = await admin
      .from('payment_intents')
      .select(`
        id, checkout_token, external_reference, expected_amount, currency,
        status, provider_preference_id, checkout_url, sandbox_checkout_url,
        expires_at,
        agendamento:agendamento_id(numero_agendamento),
        pedido:pedido_id(numero_pedido, status_pedido, payment_status, payment_check_status)
      `)
      .eq('checkout_token', checkoutToken)
      .single();

    if (error || !intent) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
    }
    if (intent.currency !== 'BRL') {
      return NextResponse.json({ error: 'Moeda do pagamento inválida.' }, { status: 409 });
    }
    if (['aprovado', 'reembolsado', 'chargeback'].includes(intent.status)) {
      return NextResponse.json({ error: 'Este pagamento não está disponível para checkout.' }, { status: 409 });
    }

    const order = Array.isArray(intent.pedido) ? intent.pedido[0] : intent.pedido;
    const orderPaymentStatus = String(order?.payment_status || '').toLowerCase();
    if (
      order?.status_pedido === 'cancelado'
      || ['aprovado', 'confirmado', 'pago'].includes(orderPaymentStatus)
      || order?.payment_check_status === 'confirmado'
    ) {
      return NextResponse.json({ error: 'Este pedido não está disponível para checkout.' }, { status: 409 });
    }
    if (
      intent.provider_preference_id
      && intent.checkout_url
      && (!intent.expires_at || new Date(intent.expires_at).getTime() > Date.now())
    ) {
      return NextResponse.json({ checkoutUrl: intent.checkout_url, reused: true });
    }

    const scheduling = Array.isArray(intent.agendamento)
      ? intent.agendamento[0]
      : intent.agendamento;
    const subjectNumber = scheduling?.numero_agendamento || order?.numero_pedido || '';
    const preference = await createMercadoPagoPreference({
      accessToken: config.accessToken,
      idempotencyKey: intent.id,
      title: `Pedido Bryza ${subjectNumber}`.trim(),
      amount: Number(intent.expected_amount),
      externalReference: intent.external_reference,
      appUrl: config.appUrl,
    });

    const { error: attachError } = await admin.rpc(
      'fn_attach_mercado_pago_preference',
      {
        p_checkout_token: checkoutToken,
        p_preference_id: preference.id,
        p_checkout_url: preference.init_point,
        p_sandbox_checkout_url: preference.sandbox_init_point || null,
        p_expires_at: preference.expiration_date_to || null,
      },
    );
    if (attachError) throw new Error(attachError.message);

    return NextResponse.json({ checkoutUrl: preference.init_point });
  } catch (error) {
    console.error('Erro ao criar preferência do Mercado Pago:', error);
    const message = error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.';
    const configurationError = message.includes('não configurado') || message.includes('HTTPS');
    return NextResponse.json({ error: message }, { status: configurationError ? 503 : 500 });
  }
}
