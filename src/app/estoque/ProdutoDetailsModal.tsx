'use client';

import React, { useEffect, useState } from 'react';
import { Produto, EstoqueMovimentacao } from '@/models/types';
import { getHistoricoProdutoAction } from './actions';

interface ProdutoDetailsModalProps {
  produto: Produto | null;
  onClose: () => void;
}

export const ProdutoDetailsModal = ({ produto, onClose }: ProdutoDetailsModalProps) => {
  const [historico, setHistorico] = useState<(EstoqueMovimentacao & { usuario?: { nome: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (produto) {
      loadHistorico();
    }
  }, [produto]);

  const loadHistorico = async () => {
    if (!produto) return;
    setLoading(true);
    try {
      // Chamamos a Server Action em vez do service diretamente para evitar vazamento de código do servidor no bundle do cliente
      const data = await getHistoricoProdutoAction(produto.id);
      setHistorico(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!produto) return null;

  const getTipoLabel = (tipo: string) => {
    switch(tipo) {
      case 'entrada': return { label: 'ENTRADA', color: '#52c41a', icon: 'add_circle' };
      case 'saida': return { label: 'SAÍDA', color: '#ff4d4f', icon: 'remove_circle' };
      case 'ajuste': return { label: 'AJUSTE', color: '#1890ff', icon: 'settings_backup_restore' };
      default: return { label: tipo, color: 'gray', icon: 'help' };
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'var(--color-surface-container-low)',
        width: '100%', maxWidth: '700px', maxHeight: '85vh',
        borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', border: '1px solid var(--color-outline-variant)'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{produto.nome_produto}</h2>
            <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Categoria: {produto.categoria}</span>
          </div>
          <button onClick={onClose} className="material-symbols-outlined" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-on-surface-variant)' }}>close</button>
        </div>

        {/* Content */}
        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
          
          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
            <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-container-lowest)', borderRadius: '12px', border: '1px solid var(--color-outline-variant)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', marginBottom: '4px' }}>Estoque Atual</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{produto.estoque_atual} {produto.unidade}</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-container-lowest)', borderRadius: '12px', border: '1px solid var(--color-outline-variant)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', marginBottom: '4px' }}>Estoque Mínimo</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-error)' }}>{produto.estoque_minimo} {produto.unidade}</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-container-lowest)', borderRadius: '12px', border: '1px solid var(--color-outline-variant)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', marginBottom: '4px' }}>Preço Venda</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-primary)' }}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(produto.preco_venda))}
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Histórico de Movimentações</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>Carregando histórico...</div>
            ) : historico.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-on-surface-variant)', border: '1px dashed var(--color-outline-variant)', borderRadius: '12px' }}>
                Nenhuma movimentação registrada.
              </div>
            ) : historico.map(mov => {
              const tipo = getTipoLabel(mov.tipo_movimento);
              return (
                <div key={mov.id} style={{
                  padding: '16px', backgroundColor: 'var(--color-surface-container-lowest)',
                  borderRadius: '12px', border: '1px solid var(--color-outline-variant)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span className="material-symbols-outlined" style={{ color: tipo.color }}>{tipo.icon}</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: tipo.color }}>{tipo.label}</span>
                        <span style={{ fontSize: '14px', fontWeight: 700 }}>{mov.tipo_movimento === 'saida' ? '-' : '+'}{mov.quantidade}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                        {new Date(mov.data_movimento).toLocaleString('pt-BR')} • {mov.origem.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500 }}>{mov.usuario?.nome || 'Sistema'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mov.observacoes || '-'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 32px', backgroundColor: 'var(--color-surface-container-highest)', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--color-outline)', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Fechar</button>
        </div>
      </div>
    </div>
  );
};
