'use client';

import React, { useState } from 'react';
import { Produto, TipoMovimento, OrigemMovimento } from '@/models/types';
import { registrarMovimentacaoAction } from './actions';

interface MovimentacaoFormModalProps {
  produtos: Produto[];
  onClose: () => void;
  onSuccess: () => void;
}

export const MovimentacaoFormModal = ({ produtos, onClose, onSuccess }: MovimentacaoFormModalProps) => {
  const [loading, setLoading] = useState(false);
  const [produtoId, setProdutoId] = useState('');
  const [tipo, setTipo] = useState<TipoMovimento>('entrada');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [origem, setOrigem] = useState<OrigemMovimento>('producao');
  const [observacoes, setObservacoes] = useState('');
  const [showNegativoWarning, setShowNegativoWarning] = useState(false);

  // Validação de estoque negativo
  const handleSubmit = async (e: React.FormEvent, ignoreWarning = false) => {
    e.preventDefault();
    if (!produtoId || quantidade <= 0) return;

    if (!ignoreWarning && tipo === 'saida') {
      const produto = produtos.find(p => p.id === produtoId);
      if (produto && (produto.estoque_atual - quantidade) < 0) {
        setShowNegativoWarning(true);
        return;
      }
    }

    setLoading(true);
    try {
      const result = await registrarMovimentacaoAction({
        produtoId,
        tipo,
        quantidade,
        origem,
        observacoes
      });

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        alert(result.error || 'Erro ao registrar movimentação');
      }
    } catch (err) {
      console.error(err);
      alert('Erro técnico ao processar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'var(--color-surface-container-low)',
        width: '100%', maxWidth: '500px',
        borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', border: '1px solid var(--color-outline-variant)'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--color-outline-variant)' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Registrar Movimentação</h2>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Produto</label>
            <select 
              required
              value={produtoId} 
              onChange={(e) => setProdutoId(e.target.value)}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline)' }}
            >
              <option value="">Selecione um produto</option>
              {produtos.map(p => (
                <option key={p.id} value={p.id}>{p.nome_produto} (Atual: {p.estoque_atual})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Tipo</label>
              <select 
                value={tipo} 
                onChange={(e) => setTipo(e.target.value as TipoMovimento)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline)' }}
              >
                <option value="entrada">Entrada (+)</option>
                <option value="saida">Saída (-)</option>
                <option value="ajuste">Ajuste Manual (=)</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Quantidade</label>
              <input 
                type="number" 
                required
                min="1"
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Origem/Motivo</label>
            <select 
              value={origem} 
              onChange={(e) => setOrigem(e.target.value as OrigemMovimento)}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline)' }}
            >
              <option value="producao">Produção</option>
              <option value="venda">Venda</option>
              <option value="perda">Perda / Avaria</option>
              <option value="ajuste_manual">Ajuste Manual de Balanço</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Observações (Opcional)</label>
            <textarea 
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes adicionais..."
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline)', minHeight: '80px', resize: 'vertical' }}
            />
          </div>

          {showNegativoWarning && (
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#fffbe6', 
              border: '1px solid #ffe58f', 
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#856404', fontWeight: 700, fontSize: '14px' }}>
                <span className="material-symbols-outlined">warning</span>
                Estoque Negativo!
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#856404' }}>
                Esta saída deixará o estoque deste produto com saldo negativo. Deseja prosseguir mesmo assim?
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  style={{ flex: 1, padding: '8px', backgroundColor: '#faad14', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Sim, prosseguir
                </button>
                <button 
                  type="button"
                  onClick={() => setShowNegativoWarning(false)}
                  style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #d9d9d9', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button 
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '12px', background: 'white', border: '1px solid var(--color-outline)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading || showNegativoWarning}
              style={{ 
                flex: 1, 
                padding: '12px', 
                backgroundColor: 'var(--color-primary)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontWeight: 700,
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Processando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
