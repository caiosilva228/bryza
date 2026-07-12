'use client';
import { useState } from 'react';
import type { DriverRouteCompensation } from '@/models/types';
import { formatCurrency } from '@/utils/format';
import { parseMoney } from '@/utils/formatDriverCompensation';

interface Props {
  open: boolean;
  compensation: DriverRouteCompensation | null;
  onClose: () => void;
  onSubmit: (params: { compensationId: string; manualAdjustment: number; adjustmentReason?: string }) => Promise<void>;
  loading?: boolean;
}

export default function ManualAdjustmentModal({ open, compensation, onClose, onSubmit, loading }: Props) {
  const [adjustment, setAdjustment] = useState('');
  const [reason,     setReason]     = useState('');

  if (!open || !compensation) return null;

  const adjustmentNum = parseMoney(adjustment);
  const newFinal = compensation.calculated_amount + adjustmentNum;
  const isValid  = reason.trim().length >= 3 && newFinal >= 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    await onSubmit({
      compensationId: compensation.id,
      manualAdjustment: adjustmentNum,
      adjustmentReason: reason,
    });
    setAdjustment('');
    setReason('');
    onClose();
  };

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
        width: '100%', maxWidth: '440px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Ajuste Manual</h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Adicione ou subtraia do valor calculado</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '22px', color: 'var(--color-on-surface-variant)' }}>close</span>
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Resumo atual */}
          <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Calculado</span>
              <strong style={{ fontSize: '13px' }}>{formatCurrency(compensation.calculated_amount)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Ajuste atual</span>
              <strong style={{ fontSize: '13px', color: compensation.manual_adjustment > 0 ? '#22C55E' : compensation.manual_adjustment < 0 ? '#EF4444' : 'inherit' }}>
                {compensation.manual_adjustment > 0 ? '+' : ''}{formatCurrency(compensation.manual_adjustment)}
              </strong>
            </div>
            <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Total atual</span>
              <strong style={{ fontSize: '14px', color: 'var(--color-primary)' }}>{formatCurrency(compensation.final_amount)}</strong>
            </div>
          </div>

          {/* Novo ajuste */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-on-surface-variant)' }}>
              Novo valor de ajuste (pode ser negativo)
            </label>
            <input
              type="number" step="0.01"
              value={adjustment}
              onChange={e => setAdjustment(e.target.value)}
              placeholder="Ex: 20.00 ou -10.00"
              style={inputStyle}
              autoFocus
            />
            {newFinal < 0 && (
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--color-error)' }}>
                O valor final não pode ser negativo ({formatCurrency(newFinal)})
              </p>
            )}
            {adjustment && newFinal >= 0 && (
              <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>
                Novo total: <span style={{ color: 'var(--color-primary)' }}>{formatCurrency(newFinal)}</span>
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-on-surface-variant)' }}>
              Motivo do ajuste <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo do ajuste..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 18px', borderRadius: '10px',
            backgroundColor: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)', fontWeight: 700, cursor: 'pointer',
          }}>Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || !!loading}
            style={{
              padding: '10px 20px', borderRadius: '10px',
              backgroundColor: isValid ? 'var(--color-primary)' : 'var(--color-outline)',
              color: '#fff', border: 'none', fontWeight: 700,
              cursor: isValid ? 'pointer' : 'not-allowed', opacity: isValid ? 1 : 0.6,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {loading
              ? <span className="material-symbols-outlined" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>progress_activity</span>
              : <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
            }
            Aplicar ajuste
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
