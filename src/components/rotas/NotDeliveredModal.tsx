'use client';

import React, { useState, useEffect } from 'react';
import { DeliveryProblemType, DeliveryNextAction } from '@/models/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: DeliveryProblemType, notes: string, nextAction: DeliveryNextAction) => Promise<void>;
  loading?: boolean;
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)',
  backgroundColor: 'var(--color-surface)', fontSize: '13px', fontFamily: 'var(--font-body)', color: 'var(--color-on-surface)'
};

const PROBLEM_TYPES: { value: DeliveryProblemType; label: string }[] = [
  { value: 'cliente_nao_estava', label: 'Cliente não estava no local' },
  { value: 'endereco_errado', label: 'Endereço errado / não localizado' },
  { value: 'cliente_recusou', label: 'Cliente recusou o pedido' },
  { value: 'sem_dinheiro', label: 'Sem dinheiro / Falha no pagamento' },
  { value: 'pediu_reagendamento', label: 'Cliente pediu reagendamento' },
  { value: 'produto_avariado', label: 'Produto avariado no transporte' },
  { value: 'outro', label: 'Outro problema' },
];

export default function NotDeliveredModal({ open, onClose, onSubmit, loading }: Props) {
  const [reason, setReason] = useState<DeliveryProblemType>('cliente_nao_estava');
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState<DeliveryNextAction>('back_to_ready');

  useEffect(() => {
    if (open) {
      setReason('cliente_nao_estava');
      setNotes('');
      setNextAction('back_to_ready');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(reason, notes, nextAction);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '20px', width: '100%', maxWidth: '440px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        
        <div style={{ padding: '24px', borderBottom: '1px solid var(--color-outline-variant)' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Registrar Falha na Entrega</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
            Informe o motivo e o que deve ser feito com o pedido.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Motivo da Falha</label>
              <select value={reason} onChange={e => setReason(e.target.value as DeliveryProblemType)} style={inputStyle}>
                {PROBLEM_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Detalhes / Observações</label>
              <textarea 
                value={notes} onChange={e => setNotes(e.target.value)} 
                placeholder="Ex: Porteiro informou que viajou..." rows={3} style={{ ...inputStyle, resize: 'none' }} 
                required={reason === 'outro'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Ação com o Pedido Principal</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="radio" name="nextAction" checked={nextAction === 'back_to_ready'} onChange={() => setNextAction('back_to_ready')} />
                  Devolver para <b>Pronto para Entrega</b>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="radio" name="nextAction" checked={nextAction === 'keep'} onChange={() => setNextAction('keep')} />
                  Manter pedido em <b>Rota</b> (vou tentar de novo)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="radio" name="nextAction" checked={nextAction === 'cancel'} onChange={() => setNextAction('cancel')} />
                  <b>Cancelar</b> o pedido definitivamente
                </label>
              </div>
            </div>
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '10px', backgroundColor: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', fontWeight: 700, cursor: 'pointer' }}>
              Voltar
            </button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: '12px', borderRadius: '10px', backgroundColor: '#ef4444', color: '#fff', border: 'none', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Registrando...' : 'Confirmar'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
