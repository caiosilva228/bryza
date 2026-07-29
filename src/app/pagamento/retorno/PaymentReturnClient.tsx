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
  whatsappUrl?: string;
  items?: Array<{
    nome: string;
    quantidade: number;
    preco: number;
  }>;
  totalValue?: number;
};

function readStoredCheckout(): StoredCheckout {
  try {
    const raw = sessionStorage.getItem(PAYMENT_RETURN_KEY);
    return raw ? (JSON.parse(raw) as StoredCheckout) : {};
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

const CONTENT: Record<
  ViewState,
  {
    icon: string;
    eyebrow: string;
    title: string;
    text: string;
    tone: string;
  }
> = {
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
    text: 'A confirmação foi recebida e seu pedido já está sendo preparado.',
    tone: 'success',
  },
  thanks: {
    icon: 'celebration',
    eyebrow: 'Pedido confirmado',
    title: 'Obrigado por comprar com a Bryza!',
    text: 'Seu pagamento foi aprovado. Clique no botão abaixo para confirmar seu pedido e receber os detalhes do envio pelo WhatsApp!',
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

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

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
  const [orderItems, setOrderItems] = useState<Array<{ nome: string; quantidade: number; preco: number }>>([]);
  const [totalValue, setTotalValue] = useState<number | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  const [attempts, setAttempts] = useState(0);
  const [checking, setChecking] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thankYouTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const checkStatus = useCallback(async () => {
    const stored = readStoredCheckout();
    if (stored.orderNumber) setOrderNumber(stored.orderNumber);
    if (stored.items && stored.items.length > 0) setOrderItems(stored.items);
    if (stored.totalValue !== undefined) setTotalValue(stored.totalValue);
    if (stored.whatsappUrl) setWhatsappUrl(stored.whatsappUrl);

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
      const result = (await response.json()) as {
        status?: PaymentStatus;
        orderNumber?: string;
        totalValue?: number;
        items?: Array<{ nome: string; quantidade: number; preco: number }>;
        whatsappUrl?: string;
      };
      if (!mountedRef.current) return;

      if (result.orderNumber) setOrderNumber(result.orderNumber);
      if (result.items && result.items.length > 0) setOrderItems(result.items);
      if (result.totalValue !== undefined) setTotalValue(result.totalValue);
      if (result.whatsappUrl) setWhatsappUrl(result.whatsappUrl);

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

    setAttempts((current) => current + 1);
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
  const isConfirmedOrThanks = view === 'thanks' || view === 'confirmed';

  // Gerar link padrão para WhatsApp se não houver um gravado
  const cleanPhone = '556132462117';
  const numAgendamento = orderNumber || 'NOVO';
  const defaultWhatsappMessage =
    `*CONFIRMAÇÃO DE PEDIDO BRYZA* ✨\n\n` +
    `• *Pedido Nº:* #${numAgendamento}\n` +
    (totalValue ? `• *Valor Total:* ${formatCurrency(totalValue)}\n` : '') +
    `\nOlá! Gostaria de confirmar meu pedido e obter os detalhes do envio!`;
  const finalWhatsappUrl = whatsappUrl || `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultWhatsappMessage)}`;

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

        {/* CARD COM O RESUMO DO PEDIDO NA CONFIRMAÇÃO */}
        {isConfirmedOrThanks && (
          <div
            style={{
              backgroundColor: '#f8fafc',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '18px 20px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              width: '100%',
              boxSizing: 'border-box',
              margin: '16px 0 8px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Resumo do Pedido
            </span>

            {orderItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {orderItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13.5px',
                      color: '#0f172a',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {item.quantidade}x {item.nome}
                    </span>
                    <strong style={{ color: '#047857' }}>
                      {formatCurrency(item.preco * item.quantidade)}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            {totalValue !== null && (
              <div
                style={{
                  borderTop: '1px dashed #cbd5e1',
                  paddingTop: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                  Valor Total
                </span>
                <strong style={{ fontSize: '18px', color: '#009845', fontWeight: 800 }}>
                  {formatCurrency(totalValue)}
                </strong>
              </div>
            )}
          </div>
        )}

        {/* ALERTA DE OBRIGATORIEDADE DE CLIQUE NO WHATSAPP */}
        {isConfirmedOrThanks && (
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1.5px solid #bbf7d0',
              borderRadius: '14px',
              padding: '14px 16px',
              color: '#166534',
              fontSize: '13.5px',
              fontWeight: 700,
              lineHeight: 1.5,
              margin: '8px 0 16px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.1)',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ color: '#22c55e', fontSize: '26px', flexShrink: 0 }}
            >
              info
            </span>
            <span>
              É necessário clicar no botão abaixo para confirmar seu pedido no WhatsApp e receber os detalhes do envio com nossa equipe!
            </span>
          </div>
        )}

        {isProcessing && (
          <div className={styles.processingBox}>
            <div className={styles.progressTrack}>
              <span />
            </div>
            <strong>
              {checking ? 'Consultando o Mercado Pago…' : 'A confirmação ainda está pendente'}
            </strong>
            <small>
              {checking
                ? 'Mantenha esta página aberta. A atualização é automática.'
                : 'Você pode atualizar a consulta agora ou acompanhar o pedido mais tarde.'}
            </small>
          </div>
        )}

        {/* BOTÕES DE AÇÃO */}
        <div className={styles.actions} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isConfirmedOrThanks && (
            <a
              href={finalWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                backgroundColor: '#25d366',
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: '15.5px',
                fontWeight: 800,
                padding: '16px 24px',
                borderRadius: '14px',
                boxShadow: '0 8px 24px rgba(37,211,102,0.35)',
                width: '100%',
                boxSizing: 'border-box',
                transition: 'transform 0.2s ease',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                chat
              </span>
              <span>Enviar Pedido pelo WhatsApp</span>
            </a>
          )}

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

          <Link
            href="/loja"
            className={styles.primaryButton}
            style={{
              backgroundColor: isConfirmedOrThanks ? 'transparent' : '#0b5ea8',
              border: isConfirmedOrThanks ? '1px solid #cbd5e1' : 'none',
              color: isConfirmedOrThanks ? '#64748b' : '#ffffff',
              fontWeight: 700,
            }}
          >
            {isConfirmedOrThanks ? 'Continuar na loja' : 'Voltar para a loja'}
          </Link>
        </div>

        <p className={styles.help}>
          Não feche um pagamento ainda pendente como falha. Se precisar, fale com a equipe Bryza.
        </p>
      </section>
    </main>
  );
}
