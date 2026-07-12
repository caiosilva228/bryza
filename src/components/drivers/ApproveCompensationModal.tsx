'use client';
import type { DriverRouteCompensation } from '@/models/types';
import { formatCurrency } from '@/utils/format';
import { COMPENSATION_MODEL_LABELS } from '@/utils/formatDriverCompensation';

interface Props {
  open: boolean;
  compensation: DriverRouteCompensation | null;
  onClose: () => void;
  onConfirm: (compensationId: string) => Promise<void>;
  loading?: boolean;
}

export default function ApproveCompensationModal({ open, compensation, onClose, onConfirm, loading }: Props) {
  if (!open || !compensation) return null;

  const model = COMPENSATION_MODEL_LABELS[compensation.compensation_model] || compensation.compensation_model;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '20px',
        width: '100%', maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-outline-variant)' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Aprovar Remuneração</h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
            Após aprovação, o ajuste manual não poderá ser alterado
          </p>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{
            padding: '16px', borderRadius: '12px',
            backgroundColor: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            <Row label="Modelo" value={model} />
            <Row label="Entregas concluídas" value={compensation.completed_deliveries.toString()} />
            {compensation.paid_failed_attempts > 0 && (
              <Row label="Tentativas remuneradas" value={compensation.paid_failed_attempts.toString()} />
            )}
            <Row label="Calculado" value={formatCurrency(compensation.calculated_amount)} />
            {compensation.manual_adjustment !== 0 && (
              <Row
                label="Ajuste manual"
                value={`${compensation.manual_adjustment > 0 ? '+' : ''}${formatCurrency(compensation.manual_adjustment)}`}
                note={compensation.adjustment_reason}
              />
            )}
            <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 800 }}>TOTAL FINAL</span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--color-primary)', fontFamily: 'var(--font-headline)' }}>
                {formatCurrency(compensation.final_amount)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 18px', borderRadius: '10px',
            backgroundColor: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)', fontWeight: 700, cursor: 'pointer',
          }}>Cancelar</button>
          <button
            onClick={() => onConfirm(compensation.id)}
            disabled={!!loading}
            style={{
              padding: '10px 20px', borderRadius: '10px',
              backgroundColor: '#1D4ED8', color: '#fff',
              border: 'none', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading
              ? <span className="material-symbols-outlined" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>progress_activity</span>
              : <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span>
            }
            Confirmar aprovação
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>{label}</span>
        {note && <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>{note}</p>}
      </div>
      <span style={{ fontSize: '13px', fontWeight: 700 }}>{value}</span>
    </div>
  );
}
