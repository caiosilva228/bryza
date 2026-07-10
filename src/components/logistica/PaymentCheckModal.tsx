'use client';

import React, { useState } from 'react';
import { Pedido } from '@/models/types';
import { formatCurrency } from '@/utils/format';

const PAYMENT_OPTIONS = [
  { value: 'pix', label: 'PIX' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão de Crédito/Débito' },
];

interface Props {
  pedido: Pedido | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (params: {
    orderId: string;
    expectedAmount: number;
    receivedAmount: number;
    paymentMethod: string;
    notes?: string;
  }) => Promise<void>;
  loading?: boolean;
}

export default function PaymentCheckModal({ pedido, open, onClose, onConfirm, loading }: Props) {
  const [receivedAmount, setReceivedAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>(pedido?.forma_pagamento ?? 'pix');
  const [notes, setNotes] = useState('');
  const [showDivergenceWarning, setShowDivergenceWarning] = useState(false);

  if (!open || !pedido) return null;

  const expected = pedido.valor_total;
  const received = parseFloat(receivedAmount.replace(',', '.')) || 0;
  const isDivergent = Math.abs(received - expected) > 0.01;

  const handleSubmit = async () => {
    if (!receivedAmount || received <= 0) return;

    if (isDivergent && !showDivergenceWarning) {
      setShowDivergenceWarning(true);
      return;
    }

    await onConfirm({
      orderId: pedido.id,
      expectedAmount: expected,
      receivedAmount: received,
      paymentMethod,
      notes: notes || undefined,
    });
  };

  const handleClose = () => {
    setReceivedAmount('');
    setPaymentMethod(pedido.forma_pagamento ?? 'pix');
    setNotes('');
    setShowDivergenceWarning(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '20px',
          width: '100%', maxWidth: '460px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px 24px 20px',
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '10px',
            backgroundColor: 'rgba(4,120,87,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#047857' }}>payments</span>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>Conferir Pagamento</h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Pedido #{pedido.numero_pedido}</p>
          </div>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Valor Esperado */}
          <div style={{
            padding: '16px',
            backgroundColor: 'var(--color-surface-container-low)',
            borderRadius: '12px',
            border: '1px solid var(--color-outline-variant)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>Valor Esperado</span>
            <span style={{ fontSize: '22px', fontWeight: 900, fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}>
              {formatCurrency(expected)}
            </span>
          </div>

          {/* Valor Recebido */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Valor Recebido <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '14px', fontWeight: 700, color: 'var(--color-on-surface-variant)',
              }}>R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={receivedAmount}
                onChange={e => { setReceivedAmount(e.target.value); setShowDivergenceWarning(false); }}
                style={{
                  width: '100%', padding: '12px 16px 12px 40px',
                  border: `2px solid ${isDivergent && receivedAmount ? '#f59e0b' : 'var(--color-outline-variant)'}`,
                  borderRadius: '10px',
                  fontSize: '16px', fontWeight: 700,
                  backgroundColor: 'var(--color-surface)',
                  outline: 'none',
                }}
              />
            </div>
            {isDivergent && receivedAmount && (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>
                ⚠️ Valor diferente do esperado ({formatCurrency(received)} vs {formatCurrency(expected)})
              </p>
            )}
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Forma de Pagamento Recebida</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PAYMENT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPaymentMethod(opt.value)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                    border: `2px solid ${paymentMethod === opt.value ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                    backgroundColor: paymentMethod === opt.value ? 'var(--color-secondary-container)' : 'var(--color-surface)',
                    color: paymentMethod === opt.value ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-headline)',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Observação (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: cliente pagou com troco, pagamento em 2x, etc."
              rows={2}
              style={{
                width: '100%', padding: '12px',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: '10px', resize: 'vertical',
                fontSize: '13px', fontFamily: 'var(--font-body)',
                backgroundColor: 'var(--color-surface)',
                outline: 'none',
              }}
            />
          </div>

          {/* Aviso de divergência */}
          {showDivergenceWarning && (
            <div style={{
              padding: '12px 16px', borderRadius: '10px',
              backgroundColor: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.4)',
            }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: 600 }}>
                ⚠️ O valor recebido está diferente do esperado. O pedido será salvo como <strong>divergente</strong> e não será finalizado automaticamente.
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#92400e' }}>
                Clique em confirmar novamente para salvar a divergência.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--color-outline-variant)',
          display: 'flex', gap: '12px',
        }}>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              backgroundColor: 'var(--color-surface-container)',
              border: '1px solid var(--color-outline-variant)',
              fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-headline)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !receivedAmount || received <= 0}
            style={{
              flex: 2, padding: '12px', borderRadius: '10px',
              backgroundColor: isDivergent ? '#f59e0b' : 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-headline)',
              cursor: loading || !receivedAmount || received <= 0 ? 'not-allowed' : 'pointer',
              opacity: loading || !receivedAmount || received <= 0 ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            {loading ? (
              <><span className="material-symbols-outlined" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>progress_activity</span> Salvando...</>
            ) : isDivergent && showDivergenceWarning ? (
              <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>warning</span> Confirmar Divergência</>
            ) : (
              <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span> Confirmar e Finalizar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
