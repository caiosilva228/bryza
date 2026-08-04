import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export type PaymentTiming = 'agora' | 'na_entrega';
export type PaymentStatus =
  | 'pendente'
  | 'processando'
  | 'aprovado'
  | 'recusado'
  | 'cancelado'
  | 'expirado'
  | 'reembolsado'
  | 'chargeback'
  | 'em_analise';

type IntentResult = {
  checkoutToken: string | null;
  paymentStatus: PaymentStatus;
};

export type OrderCheckoutPreparation = {
  intentId: string;
  checkoutToken: string;
  orderNumber: string;
  amount: number;
};

const ORDER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REUSABLE_INTENT_STATUSES = ['pendente', 'processando'] as const;

/**
 * Prepares an online payment intent for an order created in the operational
 * panel. The Mercado Pago preference is created separately, after this step,
 * so the order amount is always read from the database and never from the
 * browser.
 */
export async function prepareOrderCheckout(
  orderId: string,
): Promise<OrderCheckoutPreparation> {
  if (!ORDER_ID_PATTERN.test(orderId)) {
    throw new Error('Pedido inválido.');
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Sessão inválida. Faça login novamente.');
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .maybeSingle();

  if (
    profileError
    || !profile
    || profile.ativo !== true
    || !['admin', 'vendedor'].includes(profile.role)
  ) {
    throw new Error('Acesso restrito à equipe comercial ativa.');
  }

  const { data: order, error: orderError } = await admin
    .from('pedidos')
    .select(
      'id, numero_pedido, vendedor_id, valor_total, status_pedido, payment_status, payment_check_status',
    )
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error('Pedido não encontrado.');
  }

  if (profile.role === 'vendedor' && order.vendedor_id !== user.id) {
    throw new Error('Você não tem permissão para gerar checkout deste pedido.');
  }
  if (order.status_pedido === 'cancelado') {
    throw new Error('Pedidos cancelados não podem receber um link de pagamento.');
  }

  const paymentStatus = String(order.payment_status || '').toLowerCase();
  const isPaid = ['aprovado', 'confirmado', 'pago'].includes(paymentStatus)
    || order.payment_check_status === 'confirmado';
  if (isPaid) {
    throw new Error('Este pedido já está pago.');
  }

  const amount = Number(order.valor_total);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('O pedido não possui um valor válido para pagamento.');
  }

  const { data: latestIntent, error: latestIntentError } = await admin
    .from('payment_intents')
    .select('id, checkout_token, expected_amount, status, expires_at')
    .eq('pedido_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestIntentError) {
    throw new Error(`Não foi possível consultar o checkout: ${latestIntentError.message}`);
  }

  if (latestIntent && latestIntent.status === 'aprovado') {
    throw new Error('Este pedido já possui um pagamento aprovado.');
  }
  if (latestIntent && latestIntent.status === 'em_analise') {
    throw new Error('O pagamento deste pedido está em análise.');
  }

  const roundedAmount = Number(amount.toFixed(2));
  const intentIsReusable = Boolean(
    latestIntent
      && (REUSABLE_INTENT_STATUSES as readonly string[]).includes(latestIntent.status)
      && Number(latestIntent.expected_amount) === roundedAmount
      && (!latestIntent.expires_at || new Date(latestIntent.expires_at).getTime() > Date.now()),
  );

  if (latestIntent && !intentIsReusable && REUSABLE_INTENT_STATUSES.includes(latestIntent.status as typeof REUSABLE_INTENT_STATUSES[number])) {
    await admin
      .from('payment_intents')
      .update({ status: 'expirado' })
      .eq('id', latestIntent.id);
  }

  let intent = intentIsReusable ? latestIntent : null;

  if (!intent) {
    const { data: createdIntent, error: createIntentError } = await admin
      .from('payment_intents')
      .insert({
        pedido_id: orderId,
        payment_timing: 'agora',
        expected_amount: roundedAmount,
        status: 'pendente',
      })
      .select('id, checkout_token, expected_amount, status, expires_at')
      .single();

    if (createIntentError || !createdIntent) {
      // A second click or two browser tabs can race. The unique partial index
      // keeps one open intent per order; recover by reusing that intent.
      const { data: replayIntent } = await admin
        .from('payment_intents')
        .select('id, checkout_token, expected_amount, status, expires_at')
        .eq('pedido_id', orderId)
        .in('status', [...REUSABLE_INTENT_STATUSES])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!replayIntent || Number(replayIntent.expected_amount) !== roundedAmount) {
        throw new Error(`Não foi possível preparar o checkout: ${createIntentError?.message || 'erro desconhecido'}`);
      }
      intent = replayIntent;
    } else {
      intent = createdIntent;
    }
  }

  const { error: orderUpdateError } = await admin
    .from('pedidos')
    .update({
      payment_timing: 'agora',
      payment_status: 'pendente',
      payment_source: 'mercado_pago',
      forma_pagamento: 'mercado_pago',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (orderUpdateError) {
    throw new Error(`Não foi possível atualizar o pagamento do pedido: ${orderUpdateError.message}`);
  }

  return {
    intentId: intent.id,
    checkoutToken: intent.checkout_token,
    orderNumber: String(order.numero_pedido || order.id),
    amount: roundedAmount,
  };
}

export async function configureSchedulingPayment(
  admin: SupabaseClient,
  schedulingId: string,
  amount: number,
  timing: PaymentTiming,
): Promise<IntentResult> {
  const source = timing === 'agora' ? 'mercado_pago' : 'entrega';
  const { error: schedulingError } = await admin
    .from('agendamentos')
    .update({
      payment_timing: timing,
      payment_status: 'pendente',
      payment_source: source,
    })
    .eq('id', schedulingId);

  if (schedulingError) {
    throw new Error(`Não foi possível registrar a opção de pagamento: ${schedulingError.message}`);
  }

  if (timing === 'na_entrega') {
    return { checkoutToken: null, paymentStatus: 'pendente' };
  }

  const { data: existing, error: existingError } = await admin
    .from('payment_intents')
    .select('checkout_token, status')
    .eq('agendamento_id', schedulingId)
    .eq('payment_timing', 'agora')
    .maybeSingle();

  if (existingError) {
    throw new Error(`Não foi possível consultar o pagamento: ${existingError.message}`);
  }
  if (existing) {
    return {
      checkoutToken: existing.checkout_token,
      paymentStatus: existing.status as PaymentStatus,
    };
  }

  const { data: created, error: createError } = await admin
    .from('payment_intents')
    .insert({
      agendamento_id: schedulingId,
      payment_timing: 'agora',
      expected_amount: Number(amount.toFixed(2)),
      status: 'pendente',
    })
    .select('checkout_token, status')
    .single();

  if (createError || !created) {
    const { data: replay } = await admin
      .from('payment_intents')
      .select('checkout_token, status')
      .eq('agendamento_id', schedulingId)
      .eq('payment_timing', 'agora')
      .maybeSingle();

    if (!replay) {
      throw new Error(`Não foi possível preparar o pagamento: ${createError?.message || 'erro desconhecido'}`);
    }
    return {
      checkoutToken: replay.checkout_token,
      paymentStatus: replay.status as PaymentStatus,
    };
  }

  return {
    checkoutToken: created.checkout_token,
    paymentStatus: created.status as PaymentStatus,
  };
}
