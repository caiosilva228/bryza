'use client';

import { useEffect, useRef, useState } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

type TransparentInit = {
  transparentEnabled?: boolean;
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

export type TransparentPaymentResult = {
  status: 'aprovado' | 'processando' | 'recusado' | 'cancelado' | 'pendente' | string;
  paymentId: string | null;
  orderNumber: string;
  cardSaveStatus: 'not_requested' | 'saved' | 'failed' | 'not_saved' | string;
  pix?: {
    qrCode: string | null;
    qrCodeBase64: string | null;
    ticketUrl: string | null;
  } | null;
};

type Props = {
  checkoutToken: string;
  amount: number;
  orderNumber?: string;
  payerEmail?: string | null;
  onCompleted?: (result: TransparentPaymentResult) => void;
  onCancel?: () => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function normalizePaymentEmail(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function isValidPaymentEmail(value: unknown) {
  const email = normalizePaymentEmail(value);
  return email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// The Payment Brick removes card methods below this value for Brazil. Keep the
// configuration aligned with the provider so the UI does not render methods
// that the provider will reject before the form can be submitted.
const CARD_MINIMUM_AMOUNT = 10;

function errorText(value: unknown) {
  if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') {
    return value.message;
  }
  return '';
}

export function TransparentPaymentBrick({
  checkoutToken,
  amount,
  orderNumber,
  payerEmail,
  onCompleted,
  onCancel,
}: Props) {
  const [initialization, setInitialization] = useState<TransparentInit | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [paymentResult, setPaymentResult] = useState<TransparentPaymentResult | null>(null);
  const [payerEmailInput, setPayerEmailInput] = useState(() => normalizePaymentEmail(payerEmail));
  const [brickKey, setBrickKey] = useState(0);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    // Resolve the rollout mode before requiring the public Brick key.
    setLoading(true);
    setError('');
    setInitialization(null);
    fetch(`/api/payments/mercado-pago/transparent/init?checkoutToken=${encodeURIComponent(checkoutToken)}`, {
      cache: 'no-store',
    })
      .then(async response => {
        const body = await response.json().catch(() => null) as TransparentInit & { error?: string } | null;
        if (!response.ok && body?.transparentEnabled === false) {
          const legacyResponse = await fetch('/api/payments/mercado-pago/preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutToken }),
          });
          const legacyBody = await legacyResponse.json().catch(() => null) as { checkoutUrl?: string; error?: string } | null;
          if (!legacyResponse.ok || !legacyBody?.checkoutUrl) {
            throw new Error(legacyBody?.error || 'Não foi possível iniciar o pagamento.');
          }
          window.location.assign(legacyBody.checkoutUrl);
          return null;
        }
        if (!response.ok || !body) throw new Error(body?.error || 'Não foi possível carregar o pagamento.');
        const publicKey = body.publicKey?.trim();
        if (!publicKey) throw new Error('O checkout online ainda não foi configurado.');
        initMercadoPago(publicKey, { locale: 'pt-BR' });
        return body;
      })
      .then(data => {
        if (!cancelled && data) setInitialization(data);
      })
      .catch(initError => {
        if (!cancelled) setError(initError instanceof Error ? initError.message : 'Não foi possível carregar o pagamento.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [checkoutToken]);

  useEffect(() => {
    const nextEmail = normalizePaymentEmail(payerEmail);
    if (!nextEmail) return;
    setPayerEmailInput(current => current || nextEmail);
  }, [payerEmail]);

  const resetForRetry = () => {
    idempotencyKeyRef.current = crypto.randomUUID();
    setPaymentResult(null);
    setError('');
    setBrickKey(value => value + 1);
  };

  const submitPayment = async (submission: unknown) => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const rawPayload = submission && typeof submission === 'object' && 'formData' in submission
      ? (submission as { formData?: unknown }).formData
      : null;
    const payload = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
      ? rawPayload as Record<string, unknown>
      : null;
    const brickPayer = payload?.payer && typeof payload.payer === 'object' && !Array.isArray(payload.payer)
      ? payload.payer as Record<string, unknown>
      : {};
    const savedCardSubmission = brickPayer.type === 'customer' || Boolean(payload?.card_id);
    const normalizedEmail = normalizePaymentEmail(payerEmailInput)
      || normalizePaymentEmail(initialization?.payerEmail);
    if (!savedCardSubmission && !isValidPaymentEmail(normalizedEmail)) {
      setError('Informe um e-mail valido para concluir o pagamento.');
      setSubmitting(false);
      return;
    }
    const paymentFormData = payload && isValidPaymentEmail(normalizedEmail)
      ? {
        ...payload,
        payer: { ...brickPayer, email: normalizedEmail },
      }
      : rawPayload;
    try {
      const response = await fetch('/api/payments/mercado-pago/transparent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutToken,
          idempotencyKey: idempotencyKeyRef.current,
          formData: paymentFormData,
        }),
      });
      const body = await response.json().catch(() => null) as TransparentPaymentResult & { error?: string } | null;
      if (!response.ok || !body) throw new Error(body?.error || 'Não foi possível processar o pagamento.');
      setPaymentResult(body);
      if (body.status === 'aprovado' || body.status === 'processando' || body.status === 'pendente') {
        onCompleted?.(body);
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Não foi possível processar o pagamento.';
      setError(message);
      throw submitError;
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px 0' }} aria-live="polite">Carregando pagamento seguro…</div>;
  }
  if (error && !initialization) {
    return (
      <div role="alert" style={{ padding: '18px', borderRadius: '12px', background: '#fff7ed', color: '#9a3412' }}>
        <strong>{error}</strong>
        {onCancel ? <button type="button" onClick={onCancel} style={{ display: 'block', marginTop: '14px' }}>Voltar</button> : null}
      </div>
    );
  }
  if (!initialization) return null;

  const savedCardPayer = initialization.customerId && initialization.cardsIds.length > 0
    ? {
      customerId: initialization.customerId,
      cardsIds: initialization.cardsIds,
    }
    : {};
  const cardMethodsAvailable = initialization.amount >= CARD_MINIMUM_AMOUNT;
  const paymentMethods = cardMethodsAvailable
    ? { creditCard: 'all' as const, debitCard: 'all' as const, bankTransfer: ['pix'] }
    : { bankTransfer: ['pix'] };
  const resolvedPayerEmail = normalizePaymentEmail(payerEmailInput)
    || normalizePaymentEmail(initialization.payerEmail);
  const hasValidPayerEmail = isValidPaymentEmail(resolvedPayerEmail);

  if (paymentResult && ['aprovado', 'processando', 'pendente'].includes(paymentResult.status)) {
    const isApproved = paymentResult.status === 'aprovado';
    return (
      <section aria-live="polite" style={{ display: 'grid', gap: '14px' }}>
        <div style={{ padding: '18px', borderRadius: '12px', background: isApproved ? '#ecfdf5' : '#eff6ff', color: isApproved ? '#065f46' : '#1e40af' }}>
          <strong>{isApproved ? 'Pagamento aprovado!' : 'Pagamento em processamento.'}</strong>
          <p style={{ margin: '7px 0 0' }}>
            {isApproved
              ? `Pedido #${paymentResult.orderNumber || orderNumber || initialization.orderNumber} confirmado.`
              : 'A confirmação será atualizada automaticamente quando o Mercado Pago concluir a análise.'}
          </p>
          {isApproved && paymentResult.cardSaveStatus === 'saved' ? (
            <small>Cartão salvo com segurança para sua próxima compra.</small>
          ) : null}
          {isApproved && paymentResult.cardSaveStatus === 'failed' ? (
            <small>Pagamento aprovado. Não foi possível salvar este cartão; você poderá pagar novamente normalmente.</small>
          ) : null}
        </div>
        {paymentResult.pix?.qrCodeBase64 ? (
          <div style={{ display: 'grid', justifyItems: 'center', gap: '10px', padding: '16px', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
            <strong>Conclua o Pix no seu banco</strong>
            <img
              src={`data:image/png;base64,${paymentResult.pix.qrCodeBase64}`}
              alt="QR Code do Pix"
              width={220}
              height={220}
            />
            {paymentResult.pix.qrCode ? <button type="button" onClick={() => navigator.clipboard?.writeText(paymentResult.pix?.qrCode || '')}>Copiar código Pix</button> : null}
          </div>
        ) : null}
      </section>
    );
  }

  if (paymentResult?.status === 'recusado') {
    return (
      <section aria-live="assertive" style={{ display: 'grid', gap: '14px' }}>
        <div role="alert" style={{ padding: '18px', borderRadius: '12px', background: '#fef2f2', color: '#991b1b' }}>
          <strong>O pagamento foi recusado.</strong>
          <p style={{ margin: '7px 0 0' }}>Revise os dados ou tente outro cartão/meio de pagamento.</p>
        </div>
        <button type="button" onClick={resetForRetry}>Tentar novamente</button>
        {onCancel ? <button type="button" onClick={onCancel}>Voltar</button> : null}
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline' }}>
        <div>
          <strong>Pagamento seguro</strong>
          <small style={{ display: 'block', color: '#64748b' }}>Cartão e Pix dentro da Bryza</small>
        </div>
        <strong>{formatCurrency(initialization.amount || amount)}</strong>
      </div>
      {!cardMethodsAvailable ? (
        <small style={{ color: '#64748b' }}>
          Neste valor, o Mercado Pago disponibiliza apenas Pix.
        </small>
      ) : null}
      {!hasValidPayerEmail ? (
        <div style={{ display: 'grid', gap: '6px' }}>
          <label htmlFor="bryza-payment-email" style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
            E-mail para o pagamento *
          </label>
          <input
            id="bryza-payment-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={payerEmailInput}
            onChange={event => setPayerEmailInput(event.target.value)}
            placeholder="seu@email.com"
            required
            style={{ width: '100%', minHeight: '44px', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a' }}
          />
          <small style={{ color: '#64748b' }}>O Mercado Pago exige um e-mail vÃ¡lido para gerar o pagamento.</small>
        </div>
      ) : null}
      {error ? <div role="alert" style={{ padding: '10px 12px', borderRadius: '8px', background: '#fff7ed', color: '#9a3412' }}>{error}</div> : null}
      <Payment
        key={brickKey}
        id="bryza-payment-brick"
        locale="pt-BR"
        initialization={{
          amount: initialization.amount,
          payer: {
            entityType: 'individual',
            ...(hasValidPayerEmail ? { email: resolvedPayerEmail } : {}),
            ...savedCardPayer,
          },
        }}
        customization={{
          paymentMethods,
          visual: {
            preserveSavedCardsOrder: true,
            ...(!cardMethodsAvailable ? { defaultPaymentOption: { bankTransferForm: true } } : {}),
          },
        }}
        onSubmit={submitPayment}
        onError={(brickError) => {
          const message = errorText(brickError);
          setError(message || 'Não foi possível validar os dados do pagamento.');
        }}
      />
      {submitting ? <small aria-live="polite">Enviando pagamento…</small> : null}
      {onCancel ? <button type="button" onClick={onCancel} disabled={submitting}>Cancelar</button> : null}
    </section>
  );
}
