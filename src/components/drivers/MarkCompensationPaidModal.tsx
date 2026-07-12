'use client';
import { useState } from 'react';
import type { DriverRouteCompensation } from '@/models/types';
import { formatCurrency } from '@/utils/format';

interface Props {
  open: boolean;
  compensation: DriverRouteCompensation | null;
  onClose: () => void;
  onConfirm: (params: { compensationId: string; notes?: string }) => Promise<void>;
  loading?: boolean;
}

export default function MarkCompensationPaidModal({ open, compensation, onClose, onConfirm, loading }: Props) {
  const [notes, setNotes] = useState('');

  if (!open || !compensation) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--color-outline-variant)',
    backgroundColor: 'var(--color-surface)', fontSize: '13px',
    fontFamily: 'var(--font-body)', color: 'var(--color-on-surface)', outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '20px',
        width: '100%', maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-outline-variant)' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Confirmar Pagamento</h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
            Esta ação é irreversível e não pode ser desfeita
          </p>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '16px', borderRadius: '12px',
            backgroundColor: '#DCFCE7', border: '1px solid #86EFAC',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: '#166534' }}>VALOR A PAGAR</p>
              <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 900, color: '#166534', fontFamily: 'var(--font-headline)' }}>
                {formatCurrency(compensation.final_amount)}
              </p>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#22C55E' }}>payments</span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-on-surface-variant)' }}>
              Observação (opcional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex: Pago via PIX em 12/07/2026..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>
            ⚠️ Somente remunerações <strong>aprovadas</strong> podem ser marcadas como pagas.
          </p>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 18px', borderRadius: '10px',
            backgroundColor: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)', fontWeight: 700, cursor: 'pointer',
          }}>Cancelar</button>
          <button
            onClick={() => onConfirm({ compensationId: compensation.id, notes: notes || undefined })}
            disabled={!!loading}
            style={{
              padding: '10px 20px', borderRadius: '10px',
              backgroundColor: '#166534', color: '#fff',
              border: 'none', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading
              ? <span className="material-symbols-outlined" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>progress_activity</span>
              : <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
            }
            Confirmar pagamento
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
