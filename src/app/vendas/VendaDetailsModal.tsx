'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';
import { getVendaByIdAction } from './actions';

interface Props {
  vendaId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function VendaDetailsModal({ vendaId, isOpen, onClose }: Props) {
  const [venda, setVenda] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && vendaId) {
      loadDetails();
    }
  }, [isOpen, vendaId]);

  async function loadDetails() {
    setIsLoading(true);
    try {
      const data = await getVendaByIdAction(vendaId);
      setVenda(data);
    } catch (error) {
      toast.error('Erro ao carregar detalhes da venda.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  const getStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pago':
      case 'finalizado':
        return { label: 'Finalizado', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: 'check_circle' };
      case 'em_entrega':
        return { label: 'Em Trânsito', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: 'local_shipping' };
      case 'pendente':
      case 'aguardando_pagamento':
        return { label: 'Pendente', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: 'schedule' };
      case 'cancelado':
        return { label: 'Cancelado', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: 'cancel' };
      default:
        return { label: status?.replace('_', ' ').toUpperCase() || 'N/D', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)', icon: 'info' };
    }
  };

  const status = getStatusConfig(venda?.status_venda);

  return (
    <div className="modal-overlay" style={{ fontFamily: 'var(--font-sans)', zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '768px' }}>
        
        {/* Header */}
        <div style={{ padding: '24px', paddingBottom: '16px', position: 'relative' }}>
          <button 
            onClick={onClose} 
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-outline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-on-surface)', margin: 0, letterSpacing: '-0.025em' }}>
            VENDA #{vendaId?.substring(0, 8).toUpperCase()}
          </h1>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px', color: 'var(--color-on-surface-variant)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person</span>
              <span>
                Vendedor: <span style={{ fontWeight: 500, color: 'var(--color-on-surface)' }}>{venda?.vendedor?.nome || 'Admin'}</span> 
                {venda?.vendedor?.codigo_vendedor && (
                  <span style={{ color: 'var(--color-outline)', marginLeft: '4px' }}>({String(venda.vendedor.codigo_vendedor).padStart(3, '0')})</span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>schedule</span>
              <span>Data da Venda: {venda ? formatDate(venda.data_venda) : '...'}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '8px 24px', overflowY: 'auto', flex: 1 }}>
          {isLoading || !venda ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1.5s linear infinite' }}>sync</span>
              <p style={{ marginTop: '12px' }}>Carregando detalhes...</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', marginBottom: '32px' }}>
                {/* Cliente */}
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px', marginBottom: '16px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline)' }}>person</span>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>DADOS DO CLIENTE</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>Nome:</span>
                      <span style={{ fontWeight: 500, color: 'var(--color-on-surface)', textAlign: 'right' }}>
                        {venda.cliente?.nome || 'Consumidor Final'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>Telefone:</span>
                      <span style={{ fontWeight: 500, color: 'var(--color-on-surface)', textAlign: 'right' }}>
                        {venda.cliente?.telefone || '--'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>Endereço:</span>
                      <span style={{ fontWeight: 500, color: 'var(--color-on-surface)', textAlign: 'right' }}>
                        {venda.cliente?.endereco || 'Retirada'} {venda.cliente?.numero ? `, nº ${venda.cliente.numero}` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>Bairro/Cidade:</span>
                      <span style={{ fontWeight: 500, color: 'var(--color-on-surface)', textAlign: 'right' }}>
                        {venda.cliente?.bairro || '--'}, {venda.cliente?.cidade || '--'} {venda.cliente?.estado ? `- ${venda.cliente.estado}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pagamento */}
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px', marginBottom: '16px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline)' }}>credit_card</span>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>PAGAMENTO E STATUS</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>Forma de Pagamento:</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', textAlign: 'right' }}>
                        {venda.forma_pagamento || 'N/D'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>Status da Transação:</span>
                      <span style={{ fontWeight: 700, textAlign: 'right', color: status.color }}>
                        {status.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', paddingTop: '8px' }}>
                      <span style={{ color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px', fontWeight: 600 }}>Total Recebido:</span>
                      <span style={{ fontWeight: 700, fontSize: '20px', color: '#0d9488', textAlign: 'right' }}>
                        {formatCurrency(Number(venda.valor_total) || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itens */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px', marginBottom: '16px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline)' }}>package</span>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>ITENS VENDIDOS</h3>
                </div>
                
                <div style={{ border: '1px solid var(--color-outline-variant)', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
                  <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: 'var(--color-surface-container-low)', borderBottom: '1px solid var(--color-outline-variant)' }}>
                      <tr>
                        <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase' }}>PRODUTO</th>
                        <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', textAlign: 'center', width: '80px' }}>QTD</th>
                        <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', textAlign: 'right', width: '120px' }}>VALOR UNIT.</th>
                        <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', textAlign: 'right', width: '120px' }}>SUBTOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(venda.itens || []).map((item: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: idx < venda.itens.length - 1 ? '1px solid var(--color-surface-variant)' : 'none', backgroundColor: 'var(--color-surface)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'var(--color-outline)', fontSize: '12px', fontFamily: 'monospace' }}>
                                [{item.produto?.codigo_produto ? String(item.produto.codigo_produto).toUpperCase() : item.produto_id.substring(0, 6).toUpperCase()}]
                              </span>
                              <span style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>{item.produto?.nome_produto || 'Produto'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-on-surface)' }}>{item.quantidade}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--color-on-surface-variant)' }}>{formatCurrency(item.preco_unitario)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--color-on-surface)' }}>{formatCurrency(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {venda.observacoes && (
                   <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', borderRadius: '8px', fontSize: '14px', color: 'var(--color-on-surface-variant)' }}>
                      <span style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Observações:</span>
                      <p style={{ margin: 0 }}>{venda.observacoes}</p>
                   </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '16px 24px', 
          borderTop: '1px solid var(--color-outline-variant)', 
          backgroundColor: 'var(--color-surface-container-lowest)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-end'
        }}>
          <button 
            onClick={onClose} 
            style={{
              padding: '10px 20px',
              backgroundColor: 'var(--color-primary)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '12px',
              borderRadius: '6px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}
