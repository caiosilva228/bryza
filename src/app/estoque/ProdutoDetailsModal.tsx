'use client';

import React, { useEffect, useState } from 'react';
import { Produto, EstoqueMovimentacao } from '@/models/types';
import { getHistoricoProdutoAction, getPedidosDoProdutoAction } from './actions';
import { statusConfig } from '../vendas/pedidos/constants/workflow';

interface ProdutoDetailsModalProps {
  produto: Produto | null;
  onClose: () => void;
}

interface PedidoVinculado {
  id: string;
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  pedido_id: string;
  numero_pedido: string;
  status_pedido: string;
  created_at: string;
  cliente_nome: string;
  vendedor_nome: string;
}

export const ProdutoDetailsModal = ({ produto, onClose }: ProdutoDetailsModalProps) => {
  const [historico, setHistorico] = useState<(EstoqueMovimentacao & { usuario?: { nome: string } })[]>([]);
  const [pedidos, setPedidos] = useState<PedidoVinculado[]>([]);
  const [activeTab, setActiveTab] = useState<'pedidos' | 'historico'>('pedidos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (produto) {
      loadDetails();
    }
  }, [produto]);

  const loadDetails = async () => {
    if (!produto) return;
    setLoading(true);
    try {
      const [histData, pedData] = await Promise.all([
        getHistoricoProdutoAction(produto.id),
        getPedidosDoProdutoAction(produto.id)
      ]);
      setHistorico(histData);
      setPedidos(pedData as any);
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

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'var(--color-surface-container-low)',
        width: '100%', maxWidth: '750px', maxHeight: '88vh',
        borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column', border: '1px solid var(--color-outline-variant)'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--color-on-surface)' }}>{produto.nome_produto}</h2>
            <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>Categoria: {produto.categoria} | Código: #{produto.codigo_produto || '-'}</span>
          </div>
          <button onClick={onClose} className="material-symbols-outlined" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-on-surface-variant)', fontSize: '24px' }}>close</button>
        </div>

        {/* Content */}
        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
          
          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-container-lowest)', borderRadius: '14px', border: '1px solid var(--color-outline-variant)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', marginBottom: '4px', fontWeight: 600 }}>Estoque Atual</div>
              <div style={{ fontSize: '20px', fontWeight: 800 }}>{produto.estoque_atual} {produto.unidade}</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-container-lowest)', borderRadius: '14px', border: '1px solid var(--color-outline-variant)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', marginBottom: '4px', fontWeight: 600 }}>Estoque Mínimo</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-error)' }}>{produto.estoque_minimo} {produto.unidade}</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-container-lowest)', borderRadius: '14px', border: '1px solid var(--color-outline-variant)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', marginBottom: '4px', fontWeight: 600 }}>Preço Venda</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary)' }}>
                {formatMoney(Number(produto.preco_venda))}
              </div>
            </div>
          </div>

          {/* Tab Selection */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '20px', 
            borderBottom: '1px solid var(--color-outline-variant)', 
            paddingBottom: '12px' 
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('pedidos')}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: activeTab === 'pedidos' ? 'var(--color-primary)' : 'var(--color-surface-container-high)',
                color: activeTab === 'pedidos' ? 'white' : 'var(--color-on-surface)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>receipt_long</span>
              Pedidos Vinculados ({pedidos.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('historico')}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: activeTab === 'historico' ? 'var(--color-primary)' : 'var(--color-surface-container-high)',
                color: activeTab === 'historico' ? 'white' : 'var(--color-on-surface)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>history</span>
              Histórico de Movimentações ({historico.length})
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-outline)' }}>
              Carregando dados...
            </div>
          ) : activeTab === 'pedidos' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pedidos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-on-surface-variant)', border: '1.5px dashed var(--color-outline-variant)', borderRadius: '16px' }}>
                  Nenhum pedido vinculado a este produto até o momento.
                </div>
              ) : (
                pedidos.map(ped => {
                  const statusInfo = statusConfig[ped.status_pedido as keyof typeof statusConfig] || {
                    label: ped.status_pedido || 'Pendente',
                    color: '#94a3b8',
                    bg: 'rgba(148, 163, 184, 0.15)',
                    icon: 'schedule'
                  };

                  return (
                    <div key={ped.id} style={{
                      padding: '16px 20px',
                      backgroundColor: 'var(--color-surface-container-lowest)',
                      borderRadius: '14px',
                      border: '1px solid var(--color-outline-variant)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', minWidth: 0 }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--color-primary-container)',
                          color: 'var(--color-on-primary-container)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>shopping_bag</span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-on-surface)', fontFamily: 'monospace' }}>
                              #{ped.numero_pedido || 'PED'}
                            </span>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              backgroundColor: statusInfo.bg,
                              color: statusInfo.color
                            }}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ped.cliente_nome}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '2px' }}>
                            {ped.created_at ? new Date(ped.created_at).toLocaleString('pt-BR') : '-'} • Vendedor: {ped.vendedor_nome}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-primary)' }}>
                          {ped.quantidade} {produto.unidade}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-outline)', fontWeight: 600, marginTop: '2px' }}>
                          Total item: {formatMoney(ped.valor_total || (ped.quantidade * ped.preco_unitario))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {historico.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-on-surface-variant)', border: '1.5px dashed var(--color-outline-variant)', borderRadius: '16px' }}>
                  Nenhuma movimentação registrada.
                </div>
              ) : historico.map(mov => {
                const tipo = getTipoLabel(mov.tipo_movimento);
                return (
                  <div key={mov.id} style={{
                    padding: '16px 20px', backgroundColor: 'var(--color-surface-container-lowest)',
                    borderRadius: '14px', border: '1px solid var(--color-outline-variant)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <span className="material-symbols-outlined" style={{ color: tipo.color, fontSize: '24px' }}>{tipo.icon}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: tipo.color }}>{tipo.label}</span>
                          <span style={{ fontSize: '14px', fontWeight: 800 }}>{mov.tipo_movimento === 'saida' ? '-' : '+'}{mov.quantidade} {produto.unidade}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                          {new Date(mov.data_movimento).toLocaleString('pt-BR')} • {mov.origem.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>{mov.usuario?.nome || 'Sistema'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {mov.observacoes || '-'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 32px', backgroundColor: 'var(--color-surface-container-highest)', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)', background: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
};
