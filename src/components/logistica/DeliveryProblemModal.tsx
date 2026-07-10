'use client';

import React, { useState } from 'react';
import { DeliveryProblemType, DeliveryNextAction } from '@/models/types';

const PROBLEM_OPTIONS: { value: DeliveryProblemType; label: string }[] = [
  { value: 'cliente_nao_estava', label: 'Cliente não estava' },
  { value: 'endereco_errado', label: 'Endereço errado' },
  { value: 'cliente_recusou', label: 'Cliente recusou' },
  { value: 'sem_dinheiro', label: 'Sem dinheiro no momento' },
  { value: 'pediu_reagendamento', label: 'Pediu reagendamento' },
  { value: 'produto_avariado', label: 'Produto avariado' },
  { value: 'outro', label: 'Outro' },
];

const ACTION_OPTIONS: { value: DeliveryNextAction; label: string; icon: string; color: string }[] = [
  { value: 'keep', label: 'Manter status atual', icon: 'pause_circle', color: 'var(--color-on-surface-variant)' },
  { value: 'back_to_ready', label: 'Voltar para Pronto para Entrega', icon: 'undo', color: '#3b82f6' },
  { value: 'cancel', label: 'Cancelar o pedido', icon: 'cancel', color: '#ef4444' },
];

interface Props {
  pedidoNumero?: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (params: {
    problemType: DeliveryProblemType;
    notes: string;
    nextAction: DeliveryNextAction;
  }) => Promise<void>;
  loading?: boolean;
}

export default function DeliveryProblemModal({ pedidoNumero, open, onClose, onConfirm, loading }: Props) {
  const [problemType, setProblemType] = useState<DeliveryProblemType | ''>('');
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState<DeliveryNextAction>('keep');

  if (!open) return null;

  const canSubmit = !!problemType && notes.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit || !problemType) return;
    await onConfirm({ problemType, notes, nextAction });
    handleClose();
  };

  const handleClose = () => {
    setProblemType('');
    setNotes('');
    setNextAction('keep');
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
          width: '100%', maxWidth: '480px',
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
            backgroundColor: 'rgba(239,68,68,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#ef4444' }}>report_problem</span>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>Registrar Problema de Entrega</h2>
            {pedidoNumero && <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Pedido #{pedidoNumero}</p>}
          </div>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tipo do Problema */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '10px' }}>
              Tipo do Problema <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {PROBLEM_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setProblemType(opt.value)}
                  style={{
                    padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                    border: `2px solid ${problemType === opt.value ? '#ef4444' : 'var(--color-outline-variant)'}`,
                    backgroundColor: problemType === opt.value ? 'rgba(239,68,68,0.08)' : 'var(--color-surface)',
                    color: problemType === opt.value ? '#ef4444' : 'var(--color-on-surface)',
                    fontWeight: problemType === opt.value ? 700 : 500,
                    fontSize: '13px', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Observação */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Observação <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Descreva o que aconteceu com detalhes..."
              rows={3}
              style={{
                width: '100%', padding: '12px',
                border: `1px solid ${notes.trim() ? 'var(--color-outline-variant)' : notes === '' ? 'var(--color-outline-variant)' : 'var(--color-error)'}`,
                borderRadius: '10px', resize: 'vertical',
                fontSize: '13px', fontFamily: 'var(--font-body)',
                backgroundColor: 'var(--color-surface)',
                outline: 'none',
              }}
            />
          </div>

          {/* Próxima Ação */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '10px' }}>O que fazer com o pedido?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {ACTION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNextAction(opt.value)}
                  style={{
                    padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                    border: `2px solid ${nextAction === opt.value ? opt.color : 'var(--color-outline-variant)'}`,
                    backgroundColor: nextAction === opt.value ? `${opt.color}15` : 'var(--color-surface)',
                    color: nextAction === opt.value ? opt.color : 'var(--color-on-surface)',
                    fontWeight: nextAction === opt.value ? 700 : 500,
                    fontSize: '13px', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    transition: 'all 0.15s',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: nextAction === opt.value ? opt.color : 'var(--color-on-surface-variant)' }}>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
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
            disabled={!canSubmit}
            style={{
              flex: 2, padding: '12px', borderRadius: '10px',
              backgroundColor: nextAction === 'cancel' ? '#ef4444' : 'var(--color-primary)',
              color: '#fff', border: 'none',
              fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-headline)',
              cursor: !canSubmit ? 'not-allowed' : 'pointer',
              opacity: !canSubmit ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            {loading ? (
              <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>progress_activity</span> Salvando...</>
            ) : (
              <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span> Registrar Problema</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
