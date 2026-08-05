import 'server-only';

import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { normalizeValidCustomerEmail } from '@/lib/customers/canonical-identity';
import { getMercadoPagoConfig } from './config';
import {
  createMercadoPagoCustomer,
  createMercadoPagoTransparentPayment,
  getMercadoPagoPayment,
  listMercadoPagoCustomerCards,
  saveMercadoPagoCustomerCard,
  type MercadoPagoTransparentPaymentInput,
} from './client';
import { normalizeMercadoPagoPaymentId } from './payment-status';

export const TRANSPARENT_CHECKOUT_ENABLED_ENV = 'MERCADO_PAGO_TRANSPARENT_CHECKOUT_ENABLED';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TransparentCard = {
  id: string;
  lastFourDigits: string | null;
  expirationMonth: number | null;
  expirationYear: number | null;
  issuerName: string | null;
  paymentMethodId: string | null;
};

export type TransparentInit = {
  checkoutToken: string;
  amount: number;
  currency: string;
  orderNumber: string;
  eligibleToSaveCard: boolean;
  customerId: string | null;
  cardsIds: string[];
  payerEmail: string | null;
  publicKey: string | null;
};

type JsonObject = Record<string, unknown>;

type IntentDetails = {
  id: string;
  checkoutToken: string;
  externalReference: string;
  expectedAmount: number;
  currency: string;
  status: string;
  agendamentoId: string | null;
  pedidoId: string | null;
  orderNumber: string;
  customerId: string | null;
  customerEmail: string | null;
  customerCpf: string | null;
  customerName: string | null;
};

type AccountContext = {
  status: string;
  owned?: boolean;
  eligible?: boolean;
  person_id?: string;
  customer_id?: string;
  full_name?: string;
  email?: string;
  cpf?: string;
  provider_customer_id?: string | null;
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, maxLength = 300): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isTransparentCheckoutEnabled() {
  return process.env[TRANSPARENT_CHECKOUT_ENABLED_ENV]?.trim().toLowerCase() === 'true';
}

function getMercadoPagoPublicKey() {
  return process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY?.trim() || null;
}

export function assertCheckoutToken(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error('invalid_checkout_token');
  }
}

export function assertIdempotencyKey(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length < 16 || value.trim().length > 120) {
    throw new Error('invalid_idempotency_key');
  }
}

async function getSessionUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : data.user;
}

async function getAccountContext(
  admin: SupabaseClient,
  authUserId: string,
  checkoutToken?: string | null,
) {
  const { data, error } = await admin.rpc('fn_service_mercado_pago_customer_context', {
    p_auth_user_id: authUserId,
    p_checkout_token: checkoutToken || null,
  });
  if (error) throw new Error(error.message);
  return (isObject(data) ? data : { status: 'not_linked' }) as AccountContext;
}

async function loadIntentDetails(
  admin: SupabaseClient,
  checkoutToken: string,
): Promise<IntentDetails> {
  const { data: intent, error } = await admin
    .from('payment_intents')
    .select('id, checkout_token, external_reference, expected_amount, currency, status, agendamento_id, pedido_id')
    .eq('checkout_token', checkoutToken)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!intent) throw new Error('payment_intent_not_found');

  let orderNumber = '';
  let customerId: string | null = null;
  let customerEmail: string | null = null;
  let customerCpf: string | null = null;
  let customerName: string | null = null;

  if (intent.agendamento_id) {
    const { data: scheduling, error: schedulingError } = await admin
      .from('agendamentos')
      .select('numero_agendamento, cliente_id, nome_cliente')
      .eq('id', intent.agendamento_id)
      .maybeSingle();
    if (schedulingError) throw new Error(schedulingError.message);
    orderNumber = asString(scheduling?.numero_agendamento) || '';
    customerId = asString(scheduling?.cliente_id);
    customerName = asString(scheduling?.nome_cliente);
  } else if (intent.pedido_id) {
    const { data: order, error: orderError } = await admin
      .from('pedidos')
      .select('numero_pedido, cliente_id, nome_cliente')
      .eq('id', intent.pedido_id)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    orderNumber = asString(order?.numero_pedido) || '';
    customerId = asString(order?.cliente_id);
    customerName = asString(order?.nome_cliente);
  }

  if (customerId) {
    const { data: customer, error: customerError } = await admin
      .from('clientes')
      .select('email, cpf')
      .eq('id', customerId)
      .maybeSingle();
    if (customerError) throw new Error(customerError.message);
    customerEmail = asString(customer?.email)?.toLowerCase() || null;
    customerCpf = asString(customer?.cpf)?.replace(/\D/g, '') || null;
  }

  return {
    id: String(intent.id),
    checkoutToken: String(intent.checkout_token),
    externalReference: String(intent.external_reference),
    expectedAmount: Number(intent.expected_amount),
    currency: String(intent.currency || 'BRL'),
    status: String(intent.status || 'pendente'),
    agendamentoId: asString(intent.agendamento_id),
    pedidoId: asString(intent.pedido_id),
    orderNumber,
    customerId,
    customerEmail,
    customerCpf,
    customerName,
  };
}

function assertIntentAvailable(intent: IntentDetails) {
  if (!Number.isFinite(intent.expectedAmount) || intent.expectedAmount <= 0) {
    throw new Error('invalid_payment_amount');
  }
  if (intent.currency !== 'BRL') throw new Error('invalid_payment_currency');
  if (['aprovado', 'reembolsado', 'chargeback', 'cancelado'].includes(intent.status)) {
    throw new Error('payment_unavailable');
  }
}

async function ensureProviderCustomer(
  admin: SupabaseClient,
  context: AccountContext,
): Promise<string | null> {
  if (!context.person_id || context.eligible !== true) return null;
  if (context.provider_customer_id) return context.provider_customer_id;
  const email = normalizeValidCustomerEmail(context.email);
  if (!email) return null;

  const config = getMercadoPagoConfig();
  const fullName = context.full_name || '';
  const [firstName, ...lastNameParts] = fullName.split(' ').filter(Boolean);
  const providerCustomer = await createMercadoPagoCustomer({
    accessToken: config.accessToken,
    email,
    firstName,
    lastName: lastNameParts.join(' ') || undefined,
  });
  const providerId = asString(providerCustomer.id);
  if (!providerId) throw new Error('mercado_pago_customer_id_missing');

  const { error } = await admin.rpc('fn_service_upsert_mercado_pago_customer_link', {
    p_person_id: context.person_id,
    p_provider_customer_id: providerId,
    p_email: email,
  });
  if (error) throw new Error(error.message);
  return providerId;
}

function normalizeCard(card: JsonObject): TransparentCard | null {
  const id = asString(card.id, 120);
  if (!id) return null;
  const issuer = isObject(card.issuer) ? card.issuer : undefined;
  const paymentMethod = isObject(card.payment_method) ? card.payment_method : undefined;
  return {
    id,
    lastFourDigits: asString(card.last_four_digits, 8),
    expirationMonth: asNumber(card.expiration_month),
    expirationYear: asNumber(card.expiration_year),
    issuerName: asString(issuer?.name || card.issuer_name, 120),
    paymentMethodId: asString(paymentMethod?.id || card.payment_method_id, 80),
  };
}

export async function initializeTransparentCheckout(
  checkoutToken: string,
): Promise<TransparentInit> {
  const admin = createAdminClient();
  const intent = await loadIntentDetails(admin, checkoutToken);
  assertIntentAvailable(intent);

  const user = await getSessionUser();
  let accountContext: AccountContext | null = null;
  let providerCustomerId: string | null = null;
  let cards: TransparentCard[] = [];

  if (user?.email_confirmed_at) {
    const context = await getAccountContext(admin, user.id, checkoutToken);
    if (context.status === 'ok' && context.owned === true && context.eligible === true) {
      accountContext = context;
      const providerEmail = normalizeValidCustomerEmail(context.email)
        || normalizeValidCustomerEmail(user.email)
        || normalizeValidCustomerEmail(intent.customerEmail);
      providerCustomerId = await ensureProviderCustomer(admin, { ...context, email: providerEmail || undefined });
      if (providerCustomerId) {
        const config = getMercadoPagoConfig();
        const providerCards = await listMercadoPagoCustomerCards({
          accessToken: config.accessToken,
          customerId: providerCustomerId,
        });
        cards = providerCards.map(normalizeCard).filter((card): card is TransparentCard => Boolean(card));
      }
      await admin
        .from('payment_intents')
        .update({ card_save_status: 'eligible', checkout_mode: 'transparent' })
        .eq('id', intent.id);
    }
  }

  return {
    checkoutToken,
    amount: Number(intent.expectedAmount.toFixed(2)),
    currency: intent.currency,
    orderNumber: intent.orderNumber,
    eligibleToSaveCard: Boolean(accountContext && providerCustomerId),
    customerId: providerCustomerId,
    cardsIds: cards.map(card => card.id),
    payerEmail: normalizeValidCustomerEmail(accountContext?.email)
      || normalizeValidCustomerEmail(user?.email)
      || normalizeValidCustomerEmail(intent.customerEmail),
    publicKey: getMercadoPagoPublicKey(),
  };
}

export async function prepareAccountTransparentCheckout(
  entityType: string,
  entityId: string,
) {
  if (!['pedido', 'agendamento'].includes(entityType) || !UUID_PATTERN.test(entityId)) {
    throw new Error('invalid_customer_order_identity');
  }
  const user = await getSessionUser();
  if (!user?.email_confirmed_at) throw new Error('customer_account_unauthorized');

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('fn_service_prepare_customer_transparent_checkout', {
    p_auth_user_id: user.id,
    p_entity_type: entityType,
    p_entity_id: entityId,
  });
  if (error) throw new Error(error.message);
  if (!isObject(data) || data.status !== 'ok') throw new Error('customer_payment_unavailable');

  const checkoutToken = asString(data.checkout_token);
  if (!checkoutToken) throw new Error('checkout_token_missing');
  const init = await initializeTransparentCheckout(checkoutToken);
  return { ...init, entityType, entityId };
}

function paymentStatusOf(providerPayment: JsonObject) {
  const status = asString(providerPayment.status)?.toLowerCase();
  if (status === 'approved') return 'aprovado';
  if (status === 'rejected') return 'recusado';
  if (status === 'cancelled') return 'cancelado';
  if (status === 'refunded') return 'reembolsado';
  if (status === 'charged_back') return 'chargeback';
  if (status === 'in_mediation') return 'em_analise';
  if (status === 'in_process' || status === 'pending') return 'processando';
  return 'pendente';
}

function paymentPayloadHash(providerPayment: JsonObject) {
  return crypto.createHash('sha256').update(JSON.stringify(providerPayment)).digest('hex');
}

async function reconcileTransparentPayment(
  admin: SupabaseClient,
  providerPayment: JsonObject,
  eventPrefix: string,
) {
  const paymentId = normalizeMercadoPagoPaymentId(providerPayment.id);
  if (!paymentId) throw new Error('mercado_pago_payment_id_missing');
  const providerUpdatedAt = asString(providerPayment.date_last_updated)
    || asString(providerPayment.status)
    || '';
  const { data, error } = await admin.rpc('fn_reconcile_mercado_pago_payment', {
    p_event_id: `${eventPrefix}:${paymentId}:${providerUpdatedAt}`,
    p_request_id: null,
    p_payment: providerPayment,
    p_payload_hash: `\\x${paymentPayloadHash(providerPayment)}`,
  });
  if (error) throw new Error(error.message);
  return data;
}

function pixDataOf(providerPayment: JsonObject) {
  const pointOfInteraction = isObject(providerPayment.point_of_interaction)
    ? providerPayment.point_of_interaction
    : undefined;
  const transactionData = pointOfInteraction && isObject(pointOfInteraction.transaction_data)
    ? pointOfInteraction.transaction_data
    : null;
  if (!transactionData) return null;
  const qrCode = asString(transactionData.qr_code, 5000);
  const qrCodeBase64 = asString(transactionData.qr_code_base64, 500000);
  const ticketUrl = asString(transactionData.ticket_url, 2000);
  if (!qrCode && !qrCodeBase64 && !ticketUrl) return null;
  return { qrCode, qrCodeBase64, ticketUrl };
}

async function finishAttempt(
  admin: SupabaseClient,
  checkoutToken: string,
  idempotencyKey: string,
  providerPaymentId: string | null,
  status: 'completed' | 'failed',
) {
  const { error } = await admin.rpc('fn_service_finish_transparent_attempt', {
    p_checkout_token: checkoutToken,
    p_idempotency_key: idempotencyKey,
    p_provider_payment_id: providerPaymentId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

function formDataObject(value: unknown): JsonObject {
  if (!isObject(value)) throw new Error('invalid_payment_form_data');
  return value;
}

export async function submitTransparentPayment(input: {
  checkoutToken: string;
  idempotencyKey: string;
  formData: unknown;
}) {
  const admin = createAdminClient();
  const intent = await loadIntentDetails(admin, input.checkoutToken);
  assertIntentAvailable(intent);
  const formData = formDataObject(input.formData);
  const paymentMethodId = asString(formData.payment_method_id, 80);
  if (!paymentMethodId) throw new Error('payment_method_missing');

  const { data: claim, error: claimError } = await admin.rpc('fn_service_claim_transparent_attempt', {
    p_checkout_token: input.checkoutToken,
    p_idempotency_key: input.idempotencyKey,
  });
  if (claimError) throw new Error(claimError.message);
  const claimData = isObject(claim) ? claim : {};
  if (claimData.status === 'unavailable') throw new Error('payment_unavailable');
  if (claimData.status === 'in_progress') throw new Error('payment_attempt_in_progress');

  const providerPaymentId = asString(claimData.provider_payment_id);
  const config = getMercadoPagoConfig();
  let providerPayment: JsonObject;

  if (claimData.status === 'replay' && providerPaymentId) {
    providerPayment = await getMercadoPagoPayment(config.accessToken, providerPaymentId);
  } else {
    let accountContext: AccountContext | null = null;
    let trustedProviderCustomerId: string | null = null;
    try {
      const user = await getSessionUser();
      const payerFromBrick = isObject(formData.payer) ? formData.payer : {};
      const payerType = asString(payerFromBrick.type)?.toLowerCase();
      const isSavedCardPayment = payerType === 'customer' || Boolean(formData.card_id);
      const brickEmail = normalizeValidCustomerEmail(payerFromBrick.email);

      if (user?.email_confirmed_at) {
        const context = await getAccountContext(admin, user.id, input.checkoutToken);
        if (context.status === 'ok' && context.owned === true && context.eligible === true) {
          accountContext = context;
          const providerEmail = normalizeValidCustomerEmail(context.email)
            || normalizeValidCustomerEmail(user.email)
            || normalizeValidCustomerEmail(intent.customerEmail)
            || brickEmail;
          trustedProviderCustomerId = await ensureProviderCustomer(admin, {
            ...context,
            email: providerEmail || undefined,
          });
        }
      }

      const payerEmail = normalizeValidCustomerEmail(accountContext?.email)
        || normalizeValidCustomerEmail(user?.email)
        || normalizeValidCustomerEmail(intent.customerEmail)
        || brickEmail;
      if (!isSavedCardPayment && !payerEmail) throw new Error('payer_email_missing');

      const cpf = (accountContext?.cpf || intent.customerCpf || '').replace(/\D/g, '');
      const trustedPayer: MercadoPagoTransparentPaymentInput['payer'] = {
        email: payerEmail || '',
        providerCustomerId: trustedProviderCustomerId,
        ...(cpf.length === 11 ? { identification: { type: 'CPF', number: cpf } } : {}),
      };

      providerPayment = await createMercadoPagoTransparentPayment({
        accessToken: config.accessToken,
        idempotencyKey: input.idempotencyKey,
        amount: intent.expectedAmount,
        currency: intent.currency,
        externalReference: intent.externalReference,
        appUrl: config.appUrl,
        description: `Pedido Bryza ${intent.orderNumber}`.trim(),
        formData,
        payer: trustedPayer,
      });
    } catch (error) {
      try {
        await finishAttempt(admin, input.checkoutToken, input.idempotencyKey, null, 'failed');
      } catch (finishError) {
        console.error('Falha ao liberar tentativa transparente:',
          finishError instanceof Error ? finishError.message : 'database_error');
      }
      throw error;
    }

    const paymentId = normalizeMercadoPagoPaymentId(providerPayment.id);
    if (!paymentId) {
      try {
        await finishAttempt(admin, input.checkoutToken, input.idempotencyKey, null, 'failed');
      } catch (finishError) {
        console.error('Falha ao liberar pagamento sem identificador:',
          finishError instanceof Error ? finishError.message : 'database_error');
      }
      throw new Error('mercado_pago_payment_id_missing');
    }

    // The provider payment already exists at this point. Persist its numeric
    // identifier before any secondary work so retries always replay the same
    // charge instead of creating another Pix or card payment.
    try {
      await finishAttempt(admin, input.checkoutToken, input.idempotencyKey, paymentId, 'completed');
    } catch (finishError) {
      console.error('Pagamento criado, mas a trava idempotente ficou pendente:',
        finishError instanceof Error ? finishError.message : 'database_error');
    }

    const providerStatus = paymentStatusOf(providerPayment);
    const newCardToken = asString(formData.token, 500);
    const payerFromBrick = isObject(formData.payer) ? formData.payer : {};
    const payerType = asString(payerFromBrick.type)?.toLowerCase();
    const isSavedCardPayment = payerType === 'customer' || Boolean(formData.card_id);
    let cardSaveStatus: 'not_requested' | 'saved' | 'failed' | 'not_saved' = 'not_requested';

    if (accountContext && trustedProviderCustomerId && providerStatus === 'aprovado') {
      if (!newCardToken || isSavedCardPayment) {
        cardSaveStatus = 'not_saved';
      } else {
        try {
          await saveMercadoPagoCustomerCard({
            accessToken: config.accessToken,
            customerId: trustedProviderCustomerId,
            token: newCardToken,
          });
          cardSaveStatus = 'saved';
        } catch (saveError) {
          // Saving is intentionally non-blocking: never duplicate or reverse an
          // approved charge just because the provider rejected card reuse.
          console.error('Mercado Pago aprovou, mas não salvou o cartão:',
            saveError instanceof Error ? saveError.message : 'provider_error');
          cardSaveStatus = 'failed';
        }
      }
      await admin
        .from('payment_intents')
        .update({ card_save_status: cardSaveStatus })
        .eq('id', intent.id);
    }

    try {
      await reconcileTransparentPayment(admin, providerPayment, 'transparent');
    } catch (reconcileError) {
      // The webhook retries reconciliation independently. Once Mercado Pago
      // created the payment, a transient database error must not hide the Pix
      // QR code or tell the customer that the charge failed.
      console.error('Pagamento criado; reconciliacao pendente:',
        reconcileError instanceof Error ? reconcileError.message : 'database_error');
    }
    const { error: attemptUpdateError } = await admin
      .from('payment_attempts')
      .update({ checkout_mode: 'transparent', card_save_status: cardSaveStatus })
      .eq('provider_payment_id', paymentId);
    if (attemptUpdateError) {
      console.error('Pagamento criado; metadados da tentativa pendentes:', attemptUpdateError.message);
    }

    const status = paymentStatusOf(providerPayment);
    return {
      status,
      paymentId,
      orderNumber: intent.orderNumber,
      cardSaveStatus,
      pix: pixDataOf(providerPayment),
    };
  }

  try {
    await reconcileTransparentPayment(admin, providerPayment, 'transparent-replay');
  } catch (reconcileError) {
    console.error('Pagamento recuperado; reconciliacao pendente:',
      reconcileError instanceof Error ? reconcileError.message : 'database_error');
  }
  const status = paymentStatusOf(providerPayment);
  return {
    status,
    paymentId: normalizeMercadoPagoPaymentId(providerPayment.id),
    orderNumber: intent.orderNumber,
    cardSaveStatus: 'not_requested' as const,
    pix: pixDataOf(providerPayment),
  };
}

export async function listSavedCardsForCurrentUser(): Promise<TransparentCard[]> {
  const user = await getSessionUser();
  if (!user?.email_confirmed_at) throw new Error('customer_account_unauthorized');
  const admin = createAdminClient();
  const context = await getAccountContext(admin, user.id);
  if (context.status !== 'ok' || context.eligible !== true) throw new Error('customer_account_not_linked');
  const customerId = await ensureProviderCustomer(admin, context);
  if (!customerId) return [];
  const config = getMercadoPagoConfig();
  const cards = await listMercadoPagoCustomerCards({
    accessToken: config.accessToken,
    customerId,
  });
  return cards.map(normalizeCard).filter((card): card is TransparentCard => Boolean(card));
}

export async function deleteSavedCardForCurrentUser(cardId: string) {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(cardId)) throw new Error('invalid_card_id');
  const user = await getSessionUser();
  if (!user?.email_confirmed_at) throw new Error('customer_account_unauthorized');
  const admin = createAdminClient();
  const context = await getAccountContext(admin, user.id);
  if (context.status !== 'ok' || context.eligible !== true) throw new Error('customer_account_not_linked');
  const customerId = asString(context.provider_customer_id);
  if (!customerId) throw new Error('saved_card_not_found');
  const config = getMercadoPagoConfig();
  const cards = await listMercadoPagoCustomerCards({
    accessToken: config.accessToken,
    customerId,
  });
  if (!cards.some(card => asString(card.id) === cardId)) throw new Error('saved_card_not_found');
  const { deleteMercadoPagoCustomerCard } = await import('./client');
  await deleteMercadoPagoCustomerCard({
    accessToken: config.accessToken,
    customerId,
    cardId,
  });
}
