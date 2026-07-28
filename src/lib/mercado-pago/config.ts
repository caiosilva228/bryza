import 'server-only';

export type MercadoPagoConfig = {
  accessToken: string;
  webhookSecret: string;
  appUrl: string;
};

function normalizedAppUrl() {
  return (
    process.env.MERCADO_PAGO_APP_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || ''
  ).replace(/\/+$/, '');
}

export function getMercadoPagoConfig(): MercadoPagoConfig {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() || '';
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() || '';
  const appUrl = normalizedAppUrl();

  const missing = [
    !accessToken && 'MERCADO_PAGO_ACCESS_TOKEN',
    !webhookSecret && 'MERCADO_PAGO_WEBHOOK_SECRET',
    !appUrl && 'MERCADO_PAGO_APP_URL',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Mercado Pago não configurado. Preencha: ${missing.join(', ')}.`);
  }

  return { accessToken, webhookSecret, appUrl };
}

export function assertMercadoPagoPublicUrl(appUrl: string) {
  const url = new URL(appUrl);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error(
      'O Mercado Pago exige uma MERCADO_PAGO_APP_URL pública com HTTPS para retornos e webhooks.',
    );
  }
}
