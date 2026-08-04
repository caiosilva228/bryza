'use client';

import { useState } from 'react';
import {
  TransparentPaymentBrick,
  type TransparentPaymentResult,
} from '@/components/payments/TransparentPaymentBrick';
import styles from './account.module.css';

type Props = {
  entityType: 'pedido' | 'agendamento';
  entityId: string;
  amount: number;
  orderNumber: string;
};

export function CustomerTransparentPayment({ entityType, entityId, amount, orderNumber }: Props) {
  const [checkout, setCheckout] = useState<{ checkoutToken: string; amount: number; orderNumber: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState<TransparentPaymentResult | null>(null);

  const start = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/payments/mercado-pago/transparent/account-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId }),
      });
      const body = await response.json().catch(() => null) as {
        checkoutToken?: string;
        amount?: number;
        orderNumber?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.checkoutToken) throw new Error(body?.error || 'Não foi possível iniciar o pagamento.');
      setCheckout({
        checkoutToken: body.checkoutToken,
        amount: Number(body.amount || amount),
        orderNumber: body.orderNumber || orderNumber,
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Não foi possível iniciar o pagamento.');
    } finally {
      setLoading(false);
    }
  };

  if (checkout) {
    return (
      <div style={{ display: 'grid', gap: '14px', width: '100%' }}>
        <TransparentPaymentBrick
          checkoutToken={checkout.checkoutToken}
          amount={checkout.amount}
          orderNumber={checkout.orderNumber}
          onCompleted={(result) => {
            setCompleted(result);
            setCheckout(null);
          }}
          onCancel={() => setCheckout(null)}
        />
        {completed ? <small role="status">Pagamento atualizado. Recarregue a página para conferir o novo status.</small> : null}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <button type="button" className={styles.primaryButton} onClick={start} disabled={loading}>
        <span className="material-symbols-outlined" aria-hidden="true">payments</span>
        {loading ? 'Preparando pagamento…' : 'Pagar agora'}
      </button>
      {error ? <span role="alert" style={{ color: '#b91c1c', fontSize: '0.82rem' }}>{error}</span> : null}
    </div>
  );
}
