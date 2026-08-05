import 'server-only';

const API_URL = 'https://api.mercadopago.com';

type PreferenceInput = {
  accessToken: string;
  idempotencyKey: string;
  title: string;
  amount: number;
  externalReference: string;
  appUrl: string;
};

export type MercadoPagoPreference = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
  expiration_date_to?: string;
};

export async function createMercadoPagoPreference(
  input: PreferenceInput,
): Promise<MercadoPagoPreference> {
  const response = await fetch(`${API_URL}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      items: [{
        id: input.externalReference,
        title: input.title.slice(0, 120),
        quantity: 1,
        currency_id: 'BRL',
        unit_price: Number(input.amount.toFixed(2)),
      }],
      external_reference: input.externalReference,
      back_urls: {
        success: `${input.appUrl}/pagamento/retorno?status=success`,
        pending: `${input.appUrl}/pagamento/retorno?status=pending`,
        failure: `${input.appUrl}/pagamento/retorno?status=failure`,
      },
      auto_return: 'approved',
      notification_url: `${input.appUrl}/api/payments/mercado-pago/webhook`,
      statement_descriptor: 'BRYZA',
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      metadata: { payment_intent: input.externalReference },
    }),
    cache: 'no-store',
  });

  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !body?.id || !body.init_point) {
    const detail = typeof body?.message === 'string' ? body.message : response.statusText;
    throw new Error(`Mercado Pago recusou a preferência (${response.status}): ${detail}`);
  }
  return body as MercadoPagoPreference;
}

export async function getMercadoPagoPayment(
  accessToken: string,
  paymentId: string,
) {
  const response = await fetch(
    `${API_URL}/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    throw new Error(`Não foi possível confirmar o pagamento no Mercado Pago (${response.status}).`);
  }
  return body as Record<string, unknown>;
}

type JsonObject = Record<string, unknown>;

export type MercadoPagoTransparentPaymentInput = {
  accessToken: string;
  idempotencyKey: string;
  amount: number;
  currency: string;
  externalReference: string;
  appUrl: string;
  description: string;
  formData: JsonObject;
  payer: {
    email: string;
    identification?: { type: string; number: string };
    providerCustomerId?: string | null;
  };
};

function stringValue(value: unknown, maxLength = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function objectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function providerErrorDetail(body: unknown, fallback: string) {
  const provider = objectValue(body);
  const causes = Array.isArray(provider?.cause) ? provider.cause : [];
  const parts = [
    stringValue(provider?.error, 80),
    stringValue(provider?.message, 240),
    ...causes.flatMap(cause => {
      const item = objectValue(cause);
      return item
        ? [stringValue(item.code, 80), stringValue(item.description, 240)]
        : [];
    }),
    stringValue(fallback, 120),
  ].filter((part): part is string => Boolean(part));

  return [...new Set(parts)].join(' | ').slice(0, 500);
}

function safeProviderError(body: unknown, status: number, fallback: string) {
  // Only expose provider error/message and cause code/description. Never echo
  // the full payload because it can contain tokenized payment data.
  const detail = providerErrorDetail(body, fallback);
  return new Error(`Mercado Pago recusou o pagamento (${status})${detail ? `: ${detail}` : '.'}`);
}

/**
 * Creates a direct Payment API charge from Brick data. The caller supplies the
 * amount, reference and payer identity from the database; Brick data is only
 * used for the selected payment method and one-time token.
 */
export async function createMercadoPagoTransparentPayment(
  input: MercadoPagoTransparentPaymentInput,
): Promise<JsonObject> {
  const formData = input.formData;
  const payerFromBrick = objectValue(formData.payer);
  const payload: JsonObject = {
    transaction_amount: Number(input.amount.toFixed(2)),
    external_reference: input.externalReference,
    description: input.description.slice(0, 120),
    notification_url: `${input.appUrl}/api/payments/mercado-pago/webhook`,
    statement_descriptor: 'BRYZA',
    binary_mode: false,
    metadata: { payment_intent: input.externalReference, checkout_mode: 'transparent' },
  };

  // The Brick returns additional fields for other Mercado Pago products and
  // regions. Only forward fields accepted by POST /v1/payments here.
  for (const key of ['token', 'payment_method_id', 'installments', 'issuer_id']) {
    if (formData[key] !== undefined) payload[key] = formData[key];
  }

  const payerType = stringValue(payerFromBrick?.type, 40)?.toLowerCase();
  const isSavedCardPayment = payerType === 'customer' || Boolean(formData.card_id);
  const usesProviderCustomer = Boolean(input.payer.providerCustomerId && isSavedCardPayment);
  const payer: JsonObject = usesProviderCustomer
    ? { type: 'customer', id: input.payer.providerCustomerId }
    : { email: input.payer.email };
  if (!usesProviderCustomer && input.payer.identification) payer.identification = input.payer.identification;
  // Saved-card payments are scoped to the customer resolved from the
  // verified Bryza account, never to a customer id sent by the browser.
  if (!usesProviderCustomer) {
    const firstName = stringValue(payerFromBrick?.first_name || payerFromBrick?.firstName, 80);
    const lastName = stringValue(payerFromBrick?.last_name || payerFromBrick?.lastName, 120);
    if (firstName) payer.first_name = firstName;
    if (lastName) payer.last_name = lastName;
  }
  payload.payer = payer;

  const response = await fetch(`${API_URL}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !objectValue(body)?.id) {
    throw safeProviderError(body, response.status, response.statusText);
  }
  return body as JsonObject;
}

export async function createMercadoPagoCustomer(input: {
  accessToken: string;
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<JsonObject> {
  const response = await fetch(`${API_URL}/v1/customers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
    }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !objectValue(body)?.id) {
    throw safeProviderError(body, response.status, response.statusText);
  }
  return body as JsonObject;
}

export async function saveMercadoPagoCustomerCard(input: {
  accessToken: string;
  customerId: string;
  token: string;
}): Promise<JsonObject> {
  const response = await fetch(
    `${API_URL}/v1/customers/${encodeURIComponent(input.customerId)}/cards`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: input.token }),
      cache: 'no-store',
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || !objectValue(body)?.id) {
    throw safeProviderError(body, response.status, response.statusText);
  }
  return body as JsonObject;
}

export async function listMercadoPagoCustomerCards(input: {
  accessToken: string;
  customerId: string;
}): Promise<JsonObject[]> {
  const response = await fetch(
    `${API_URL}/v1/customers/${encodeURIComponent(input.customerId)}/cards`,
    {
      headers: { Authorization: `Bearer ${input.accessToken}` },
      cache: 'no-store',
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(body)) {
    throw safeProviderError(body, response.status, response.statusText);
  }
  return body.filter((card): card is JsonObject => Boolean(objectValue(card)));
}

export async function deleteMercadoPagoCustomerCard(input: {
  accessToken: string;
  customerId: string;
  cardId: string;
}): Promise<void> {
  const response = await fetch(
    `${API_URL}/v1/customers/${encodeURIComponent(input.customerId)}/cards/${encodeURIComponent(input.cardId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${input.accessToken}` },
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw safeProviderError(body, response.status, response.statusText);
  }
}
