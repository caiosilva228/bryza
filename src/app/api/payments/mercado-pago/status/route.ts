import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMercadoPagoConfig } from '@/lib/mercado-pago/config';
import { getMercadoPagoPayment } from '@/lib/mercado-pago/client';
import {
  assertPaymentMatchesIntent,
  type PaymentStatusRequest,
  validatePaymentStatusRequest,
} from '@/lib/mercado-pago/payment-status';

export const runtime = 'nodejs';

type IntentRow = {
  id: string;
  checkout_token: string;
  external_reference: string;
  expected_amount: number | string;
  currency: string;
  status: string;
  agendamento_id: string | null;
  pedido_id: string | null;
  pedido: { numero_pedido: string } | { numero_pedido: string }[] | null;
};

function orderNumberOf(intent: IntentRow) {
  const order = Array.isArray(intent.pedido) ? intent.pedido[0] : intent.pedido;
  return order?.numero_pedido || null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as PaymentStatusRequest | null;
    let identity;
    try {
      identity = validatePaymentStatusRequest(body);
    } catch {
      return NextResponse.json(
        { error: 'Identificadores de pagamento inválidos.' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    let intentQuery = admin
      .from('payment_intents')
      .select(`
        id, checkout_token, external_reference, expected_amount, currency,
        status, agendamento_id, pedido_id, pedido:pedido_id(numero_pedido)
      `);
    intentQuery = identity.checkoutToken
      ? intentQuery.eq('checkout_token', identity.checkoutToken)
      : intentQuery.eq('external_reference', identity.externalReference!);

    const { data, error } = await intentQuery.maybeSingle();
    const intent = data as IntentRow | null;
    if (error) throw new Error(error.message);
    if (!intent) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
    }

    if (
      identity.externalReference
      && identity.externalReference !== intent.external_reference
    ) {
      return NextResponse.json(
        { error: 'Os identificadores não pertencem ao mesmo pagamento.' },
        { status: 409 },
      );
    }

    if (identity.paymentId) {
      const config = getMercadoPagoConfig();
      const payment = await getMercadoPagoPayment(
        config.accessToken,
        identity.paymentId,
      );

      try {
        assertPaymentMatchesIntent(payment, identity.paymentId, intent);
      } catch {
        return NextResponse.json(
          { error: 'O pagamento informado não corresponde a este pedido.' },
          { status: 409 },
        );
      }

      const paymentHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(payment))
        .digest('hex');
      const providerUpdatedAt = String(payment.date_last_updated || payment.status || '');
      const eventId = `status:${identity.paymentId}:${providerUpdatedAt}`;
      const { error: reconcileError } = await admin.rpc(
        'fn_reconcile_mercado_pago_payment',
        {
          p_event_id: eventId,
          p_request_id: null,
          p_payment: payment,
          p_payload_hash: `\\x${paymentHash}`,
        },
      );
      if (reconcileError) throw new Error(reconcileError.message);
    }

    const { data: refreshed, error: refreshError } = await admin
      .from('payment_intents')
      .select(`
        id, checkout_token, external_reference, expected_amount, currency,
        status, agendamento_id, pedido_id, pedido:pedido_id(numero_pedido)
      `)
      .eq('id', intent.id)
      .single();
    if (refreshError || !refreshed) {
      throw new Error(refreshError?.message || 'payment_intent_refresh_failed');
    }

    const currentIntent = refreshed as IntentRow;

    let totalValue = Number(currentIntent.expected_amount || 0);
    let items: Array<{ nome: string; quantidade: number; preco: number }> = [];
    let fetchedOrderNumber = orderNumberOf(currentIntent);
    let whatsappUrl: string | null = null;

    if (currentIntent.agendamento_id) {
      const { data: agendamento } = await admin
        .from('agendamentos')
        .select(`
          numero_agendamento, valor_total, nome_cliente, telefone_cliente,
          agendamento_itens (
            quantidade, preco_unitario,
            produtos ( id, nome_produto )
          )
        `)
        .eq('id', currentIntent.agendamento_id)
        .maybeSingle();

      if (agendamento) {
        if (agendamento.numero_agendamento) fetchedOrderNumber = agendamento.numero_agendamento;
        if (agendamento.valor_total) totalValue = Number(agendamento.valor_total);
        const rawItens = Array.isArray(agendamento.agendamento_itens) ? agendamento.agendamento_itens : [];
        items = rawItens.map((i: any) => ({
          id: i.produtos?.id || undefined,
          nome: i.produtos?.nome_produto || 'Produto',
          quantidade: Number(i.quantidade || 1),
          preco: Number(i.preco_unitario || 0),
        }));

        const cleanPhone = '556132462117';
        const numAgendamento = fetchedOrderNumber || 'NOVO';
        const message = `*CONFIRMAÇÃO DE PEDIDO BRYZA* ✨\n\n` +
          `• *Pedido Nº:* #${numAgendamento}\n` +
          `• *Cliente:* ${agendamento.nome_cliente || ''}\n` +
          `• *Valor Total:* R$ ${totalValue.toFixed(2).replace('.', ',')}\n\n` +
          `Gostaria de confirmar o meu pedido e obter os detalhes do envio!`;
        whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      }
    }

    return NextResponse.json({
      status: currentIntent.status,
      orderNumber: fetchedOrderNumber,
      totalValue,
      items,
      whatsappUrl,
    });
  } catch (error) {
    console.error('Erro ao consultar pagamento do Mercado Pago:', error);
    const message = error instanceof Error ? error.message : '';
    const configurationError = message.includes('não configurado');
    return NextResponse.json(
      { error: configurationError
        ? 'Mercado Pago não configurado.'
        : 'Não foi possível consultar o pagamento.' },
      { status: configurationError ? 503 : 500 },
    );
  }
}
