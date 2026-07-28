import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

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
