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
  onCompleted?: (result: TransparentPaymentResult) => void;
  onCancel?: () => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

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
  onCompleted,
  onCancel,
}: Props) {
  const [initialization, setInitialization] = useState<TransparentInit | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [paymentResult, setPaymentResult] = useState<TransparentPaymentResult | null>(null);
  const [brickKey, setBrickKey] = useState(0);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY?.trim();
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

  const resetForRetry = () => {
    idempotencyKeyRef.current = crypto.randomUUID();
    setPaymentResult(null);
    setError('');
    setBrickKey(value => value + 1);
  };

  const submitPayment = async (submission: unknown) => {
    if (submitting) return;
    const payload = submission && typeof submission === 'object' && 'formData' in submission
      ? (submission as { formData?: unknown }).formData
      : null;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/payments/mercado-pago/transparent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutToken,
          idempotencyKey: idempotencyKeyRef.current,
          formData: payload,
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
      {error ? <div role="alert" style={{ padding: '10px 12px', borderRadius: '8px', background: '#fff7ed', color: '#9a3412' }}>{error}</div> : null}
      <Payment
        key={brickKey}
        id="bryza-payment-brick"
        locale="pt-BR"
        initialization={{
          amount: initialization.amount,
          payer: {
            ...(initialization.payerEmail ? { email: initialization.payerEmail } : {}),
            ...(initialization.customerId ? {
              customerId: initialization.customerId,
              cardsIds: initialization.cardsIds,
            } : {}),
          },
        }}
        customization={{
          paymentMethods: {
            creditCard: 'all',
            debitCard: 'all',
            bankTransfer: 'all',
          },
          visual: { preserveSavedCardsOrder: true },
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
