'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Pedido } from '@/models/types';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';

interface Props {
  pedido: Pedido;
  isOpen: boolean;
  isLoading: boolean;
  checkoutUrl: string | null;
  error: string | null;
  onClose: () => void;
  onRetry?: () => void;
}

function normalizeWhatsAppPhone(phone?: string | null) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export default function PedidoCheckoutModal({
  pedido,
  isOpen,
  isLoading,
  checkoutUrl,
  error,
  onClose,
  onRetry,
}: Props) {
  const [copied, setCopied] = useState(false);

  const customerName = pedido.nome_cliente || pedido.cliente?.nome || 'Cliente';
  const customerPhone = pedido.telefone_cliente || pedido.cliente?.telefone || null;
  const customerPhoneForWhatsApp = normalizeWhatsAppPhone(customerPhone);
  const orderItems = pedido.itens || [];

  const whatsappUrl = useMemo(() => {
    if (!checkoutUrl || !customerPhoneForWhatsApp) return null;

    const message = [
      `*PEDIDO BRYZA #${pedido.numero_pedido}*`,
      `Olá, ${customerName}!`,
      '',
      `Segue o link para pagamento do seu pedido no valor de *${formatCurrency(pedido.valor_total)}*:` ,
      checkoutUrl,
      '',
      'Após o pagamento, nossa equipe dará continuidade à entrega. Obrigado!',
    ].join('\n');

    return `https://wa.me/${customerPhoneForWhatsApp}?text=${encodeURIComponent(message)}`;
  }, [checkoutUrl, customerName, customerPhoneForWhatsApp, pedido.numero_pedido, pedido.valor_total]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function copyCheckoutLink() {
    if (!checkoutUrl) return;

    try {
      let copiedSuccessfully = false;

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(checkoutUrl);
          copiedSuccessfully = true;
        } catch {
          // The fallback below also works when the browser is not in a secure context.
        }
      }

      if (!copiedSuccessfully) {
        const fallback = document.createElement('textarea');
        fallback.value = checkoutUrl;
        fallback.setAttribute('readonly', '');
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        copiedSuccessfully = document.execCommand('copy');
        document.body.removeChild(fallback);
      }

      if (!copiedSuccessfully) throw new Error('copy_failed');
      setCopied(true);
      toast.success('Link de pagamento copiado.');
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pedido-checkout-title"
        style={{ maxWidth: '590px' }}
      >
        <div
          style={{
            padding: '22px 24px 18px',
            borderBottom: '1px solid var(--color-outline-variant)',
            background: 'linear-gradient(135deg, #073e5b 0%, #0b6580 100%)',
            color: '#fff',
            position: 'relative',
          }}
        >
          <button
            type="button"
            aria-label="Fechar modal"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '18px',
              right: '20px',
              border: 'none',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>close</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '42px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '11px',
                background: 'rgba(255,255,255,0.14)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>payments</span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.78 }}>
                Checkout Mercado Pago
              </p>
              <h2 id="pedido-checkout-title" style={{ margin: '3px 0 0', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {isLoading ? 'Gerando link...' : 'Link de pagamento pronto'}
              </h2>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 24px 8px', overflowY: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: '12px 20px',
              padding: '15px 16px',
              borderRadius: '13px',
              border: '1px solid #d9e7ed',
              background: 'linear-gradient(135deg, #f7fcfd 0%, #eef8fb 100%)',
              marginBottom: '16px',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span style={{ display: 'block', color: 'var(--color-outline)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Cliente
              </span>
              <strong style={{ display: 'block', color: 'var(--color-on-surface)', fontSize: '15px', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {customerName}
              </strong>
              <span style={{ display: 'block', color: 'var(--color-primary)', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>
                {customerPhone || 'Telefone não cadastrado'}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', color: 'var(--color-outline)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Pedido
              </span>
              <strong style={{ display: 'block', color: 'var(--color-on-surface)', fontSize: '15px', marginTop: '3px' }}>
                #{pedido.numero_pedido}
              </strong>
              <span style={{ display: 'block', color: 'var(--color-outline)', fontSize: '11px', marginTop: '2px' }}>
                {formatDate(pedido.data_criacao || pedido.created_at)}
              </span>
            </div>
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #d9e7ed', paddingTop: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', fontWeight: 700 }}>Valor total</span>
              <strong style={{ color: '#087b73', fontSize: '20px', letterSpacing: '-0.02em' }}>{formatCurrency(pedido.valor_total)}</strong>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '9px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '17px' }}>inventory_2</span>
              <span style={{ color: 'var(--color-outline)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resumo do pedido</span>
            </div>
            <div style={{ border: '1px solid var(--color-outline-variant)', borderRadius: '10px', overflow: 'hidden' }}>
              {orderItems.length > 0 ? orderItems.map((item, index) => (
                <div
                  key={item.id || `${item.produto_id}-${index}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', borderBottom: index === orderItems.length - 1 ? 'none' : '1px solid var(--color-outline-variant)', fontSize: '12px' }}
                >
                  <span style={{ color: 'var(--color-on-surface)', fontWeight: 650, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.quantidade}x {item.produto?.nome_produto || 'Produto'}
                  </span>
                  <strong style={{ color: 'var(--color-on-surface)', whiteSpace: 'nowrap' }}>{formatCurrency(Number(item.subtotal) || item.quantidade * item.preco_unitario)}</strong>
                </div>
              )) : (
                <div style={{ padding: '14px 12px', color: 'var(--color-outline)', fontSize: '12px' }}>
                  Os itens detalhados não estão disponíveis para este pedido.
                </div>
              )}
            </div>
          </div>

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', borderRadius: '11px', background: '#f1f7fa', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 700 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', animation: 'spin 1s linear infinite' }}>progress_activity</span>
              Conectando ao Mercado Pago...
            </div>
          )}

          {!isLoading && error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px', borderRadius: '11px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '13px', lineHeight: 1.45 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '19px', flexShrink: 0 }}>error</span>
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && checkoutUrl && (
            <div style={{ padding: '14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #dbe4ea' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-on-surface)', fontSize: '12px', fontWeight: 800 }}>Link de pagamento</span>
                <span style={{ color: '#16803d', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ativo por 30 min</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ minWidth: 0, flex: 1, padding: '10px 11px', borderRadius: '8px', background: '#fff', border: '1px solid #dbe4ea', color: 'var(--color-primary)', fontSize: '11px', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={checkoutUrl}>
                  {checkoutUrl}
                </div>
                <button
                  type="button"
                  onClick={copyCheckoutLink}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '9px 10px', borderRadius: '8px', border: '1px solid #c8d8df', background: '#fff', color: 'var(--color-on-surface)', cursor: 'pointer', fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{copied ? 'check' : 'content_copy'}</span>
                  {copied ? 'Copiado' : 'Copiar link'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '9px', padding: '16px 24px 20px', borderTop: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          {!isLoading && error && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{ flex: '1 1 160px', minHeight: '42px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', border: '1px solid var(--color-primary)', borderRadius: '9px', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 800 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>refresh</span>
              Tentar novamente
            </button>
          )}

          {!isLoading && !error && checkoutUrl && (
            <a
              href={whatsappUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                if (!whatsappUrl) event.preventDefault();
              }}
              aria-disabled={!whatsappUrl}
              title={whatsappUrl ? 'Abrir conversa com o cliente' : 'Cadastre um telefone para enviar diretamente'}
              style={{ flex: '1 1 220px', minHeight: '42px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '9px', background: whatsappUrl ? '#25d366' : '#cbd5e1', color: '#fff', textDecoration: 'none', cursor: whatsappUrl ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 800, boxShadow: whatsappUrl ? '0 5px 14px rgba(37,211,102,0.22)' : 'none' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>chat</span>
              {whatsappUrl ? 'Enviar pelo WhatsApp' : 'WhatsApp sem telefone'}
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{ flex: '0 1 120px', minHeight: '42px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', border: '1px solid var(--color-outline-variant)', borderRadius: '9px', background: 'var(--color-surface)', color: 'var(--color-on-surface)', cursor: 'pointer', fontSize: '12px', fontWeight: 800 }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
