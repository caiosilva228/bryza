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
