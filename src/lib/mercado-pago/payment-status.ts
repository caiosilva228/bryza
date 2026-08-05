export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PAYMENT_ID_PATTERN = /^\d+$/;

export function normalizeMercadoPagoPaymentId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return PAYMENT_ID_PATTERN.test(normalized) ? normalized : null;
}

export type PaymentStatusRequest = {
  checkoutToken?: string;
  paymentId?: string;
  externalReference?: string;
};

export type PaymentIntentIdentity = {
  external_reference: string;
  expected_amount: number | string;
  currency: string;
};

export type MercadoPagoPaymentIdentity = {
  id?: unknown;
  external_reference?: unknown;
  transaction_amount?: unknown;
  currency_id?: unknown;
};

export type ValidatedPaymentStatusRequest = {
  checkoutToken: string | null;
  paymentId: string | null;
  externalReference: string | null;
};

export function validatePaymentStatusRequest(
  input: PaymentStatusRequest | null,
): ValidatedPaymentStatusRequest {
  const checkoutToken = input?.checkoutToken?.trim() || null;
  const paymentId = input?.paymentId?.trim() || null;
  const externalReference = input?.externalReference?.trim() || null;

  if (checkoutToken && !UUID_PATTERN.test(checkoutToken)) {
    throw new Error('invalid_checkout_token');
  }
  if (paymentId && !PAYMENT_ID_PATTERN.test(paymentId)) {
    throw new Error('invalid_payment_id');
  }
  if (externalReference && !UUID_PATTERN.test(externalReference)) {
    throw new Error('invalid_external_reference');
  }
  if (!checkoutToken && !(paymentId && externalReference)) {
    throw new Error('missing_payment_identity');
  }
  if (!paymentId && externalReference && !checkoutToken) {
    throw new Error('missing_payment_identity');
  }

  return { checkoutToken, paymentId, externalReference };
}

export function assertPaymentMatchesIntent(
  payment: MercadoPagoPaymentIdentity,
  paymentId: string,
  intent: PaymentIntentIdentity,
) {
  const providerPaymentId = normalizeMercadoPagoPaymentId(payment.id) || '';
  const externalReference = String(payment.external_reference ?? '');
  const amount = Number(payment.transaction_amount);
  const expectedAmount = Number(intent.expected_amount);
  const currency = String(payment.currency_id ?? '').toUpperCase();

  if (
    providerPaymentId !== paymentId
    || externalReference !== intent.external_reference
    || !Number.isFinite(amount)
    || !Number.isFinite(expectedAmount)
    || Math.abs(amount - expectedAmount) > 0.01
    || currency !== intent.currency.toUpperCase()
  ) {
    throw new Error('payment_intent_mismatch');
  }
}
