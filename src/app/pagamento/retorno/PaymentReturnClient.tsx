'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './payment-return.module.css';

const PAYMENT_RETURN_KEY = 'bryza_mp_checkout';
const CART_KEY = 'bryza_store_cart';
const DRAFT_KEY = 'bryza_checkout_draft';
const MAX_POLL_ATTEMPTS = 24;
const POLL_INTERVAL_MS = 2500;

type PaymentStatus =
  | 'aprovado'
  | 'processando'
  | 'pendente'
  | 'recusado'
  | 'cancelado'
  | 'reembolsado'
  | 'chargeback';

type ViewState = 'processing' | 'confirmed' | 'thanks' | 'declined' | 'cancelled' | 'reversed';

type StoredCheckout = {
  checkoutToken?: string;
  orderNumber?: string;
};

function readStoredCheckout(): StoredCheckout {
  try {
    const raw = sessionStorage.getItem(PAYMENT_RETURN_KEY);
    return raw ? JSON.parse(raw) as StoredCheckout : {};
  } catch {
    return {};
  }
}

function clearApprovedCheckout() {
  try {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(PAYMENT_RETURN_KEY);
  } catch {
    // A confirmação visual continua válida mesmo quando o navegador bloqueia storage.
  }
}

function toViewState(status: PaymentStatus): ViewState {
  if (status === 'aprovado') return 'confirmed';
  if (status === 'recusado') return 'declined';
  if (status === 'cancelado') return 'cancelled';
  if (status === 'reembolsado' || status === 'chargeback') return 'reversed';
  return 'processing';
}

const CONTENT: Record<ViewState, {
  icon: string;
  eyebrow: string;
  title: string;
  text: string;
  tone: string;
}> = {
  processing: {
    icon: 'progress_activity',
    eyebrow: 'Pagamento em processamento',
    title: 'Estamos confirmando seu pagamento',
    text: 'Isso pode levar alguns instantes. Seu agendamento já está registrado e você não precisa pagar novamente.',
    tone: 'processing',
  },
  confirmed: {
    icon: 'verified',
    eyebrow: 'Pagamento confirmado',
    title: 'Tudo certo com seu pagamento',
    text: 'A confirmação foi recebida e seu pedido já está sendo atualizado.',
    tone: 'success',
  },
  thanks: {
    icon: 'celebration',
    eyebrow: 'Pedido confirmado',
    title: 'Obrigado por comprar com a Bryza!',
    text: 'Seu pagamento foi aprovado. Agora é só aguardar as próximas atualizações da entrega.',
    tone: 'success',
  },
  declined: {
    icon: 'credit_card_off',
    eyebrow: 'Pagamento não aprovado',
    title: 'Não foi possível concluir o pagamento',
    text: 'Seu agendamento continua salvo. Volte à loja para tentar novamente ou escolha pagar na entrega.',
    tone: 'danger',
  },
  cancelled: {
    icon: 'cancel',
    eyebrow: 'Pagamento cancelado',
    title: 'O pagamento foi cancelado',
    text: 'Seu agendamento continua salvo e o carrinho foi preservado para uma nova tentativa.',
    tone: 'neutral',
  },
  reversed: {
    icon: 'currency_exchange',
    eyebrow: 'Pagamento revertido',
    title: 'O valor não está mais confirmado',
    text: 'Entre em contato com a equipe Bryza para receber ajuda com este pagamento.',
    tone: 'danger',
  },
};

export default function PaymentReturnClient({
  initialStatus,
  paymentId,
  externalReference,
}: {
  initialStatus: string;
  paymentId: string | null;
  externalReference: string | null;
}) {
  const [view, setView] = useState<ViewState>(() => {
    if (initialStatus === 'failure' || initialStatus === 'rejected') return 'declined';
    return 'processing';
  });
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [checking, setChecking] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thankYouTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const checkStatus = useCallback(async () => {
    const stored = readStoredCheckout();
    if (stored.orderNumber) setOrderNumber(stored.orderNumber);

    if (!stored.checkoutToken && !(paymentId && externalReference)) {
      setChecking(false);
      return;
    }

    try {
      const response = await fetch('/api/payments/mercado-pago/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          checkoutToken: stored.checkoutToken,
          paymentId: paymentId || undefined,
          externalReference: externalReference || undefined,
        }),
      });
      const result = await response.json() as {
        status?: PaymentStatus;
        orderNumber?: string;
      };
      if (!mountedRef.current) return;

      if (result.orderNumber) setOrderNumber(result.orderNumber);
      if (response.ok && result.status) {
        const nextView = toViewState(result.status);
        setView(nextView);

        if (result.status === 'aprovado') {
          clearApprovedCheckout();
          setChecking(false);
          thankYouTimerRef.current = setTimeout(() => {
            if (mountedRef.current) setView('thanks');
          }, 1600);
          return;
        }
        if (!['pendente', 'processando'].includes(result.status)) {
          setChecking(false);
          return;
        }
      }
    } catch {
      // Oscilações de rede não transformam um pagamento pendente em falha.
    }

    setAttempts(current => current + 1);
  }, [externalReference, paymentId]);

  useEffect(() => {
    mountedRef.current = true;
    void checkStatus();
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (thankYouTimerRef.current) clearTimeout(thankYouTimerRef.current);
    };
  }, [checkStatus]);

  useEffect(() => {
    if (!checking || attempts === 0) return;
    if (attempts >= MAX_POLL_ATTEMPTS) {
      setChecking(false);
      return;
    }
    pollTimerRef.current = setTimeout(() => void checkStatus(), POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [attempts, checkStatus, checking]);

  const content = CONTENT[view];
  const isProcessing = view === 'processing';

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-live="polite">
        <div className={`${styles.iconWrap} ${styles[content.tone]}`}>
          <span className={`material-symbols-outlined ${isProcessing && checking ? styles.spin : ''}`}>
            {content.icon}
          </span>
        </div>
        <p className={styles.eyebrow}>{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p className={styles.description}>{content.text}</p>

        {orderNumber && (
          <div className={styles.orderNumber}>
            <span>Pedido</span>
            <strong>#{orderNumber}</strong>
          </div>
        )}

        {isProcessing && (
          <div className={styles.processingBox}>
            <div className={styles.progressTrack}><span /></div>
            <strong>{checking ? 'Consultando o Mercado Pago…' : 'A confirmação ainda está pendente'}</strong>
            <small>
              {checking
                ? 'Mantenha esta página aberta. A atualização é automática.'
                : 'Você pode atualizar a consulta agora ou acompanhar o pedido mais tarde.'}
            </small>
          </div>
        )}

        <div className={styles.actions}>
          {isProcessing && !checking && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setAttempts(0);
                setChecking(true);
                void checkStatus();
              }}
            >
              Verificar novamente
            </button>
          )}
          <Link href="/loja" className={styles.primaryButton}>
            {view === 'thanks' || view === 'confirmed' ? 'Continuar na loja' : 'Voltar para a loja'}
          </Link>
        </div>

        <p className={styles.help}>
          Não feche um pagamento ainda pendente como falha. Se precisar, fale com a equipe Bryza.
        </p>
      </section>
    </main>
  );
}
