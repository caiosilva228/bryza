'use client';

import { Pedido, StatusPedido } from '@/models/types';
import { statusConfig, statusWorkflow } from '../constants/workflow';
import { updatePedidoStatus } from '../actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

interface Props {
  pedidos: Pedido[];
  onSelectPedido: (pedido: Pedido) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}


export default function PedidoTable({ pedidos, onSelectPedido, onRefresh, isLoading }: Props) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  async function handleQuickAdvance(pedidoId: string, currentStatus: StatusPedido) {
    const workflow = statusWorkflow[currentStatus];
    if (!workflow || !workflow.next) return;
    
    const nextStatus = workflow.next;

    if (nextStatus === 'pronto_para_entrega') {
      const confirm = window.confirm(
        '⚠️ ATENÇÃO: Ao marcar como PRONTO PARA ENTREGA, não será mais possível realizar alterações neste pedido.\n\nDeseja continuar?'
      );
      if (!confirm) return;
    }

    if (nextStatus === 'finalizado') {
      const confirm = window.confirm('CONFIRMAR FINALIZAÇÃO DE VENDA? O estoque será atualizado definitivamente.');
      if (!confirm) return;
    }

    setUpdatingId(pedidoId);
    try {
      await updatePedidoStatus(pedidoId, nextStatus);
      toast.success(`STATUS ATUALIZADO: ${statusWorkflow[nextStatus].label}`);
      onRefresh();
    } catch (error) {
      toast.error('Erro ao atualizar status.');
    } finally {
      setUpdatingId(null);
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', backgroundColor: 'var(--color-surface)' }}>
        <div style={{ 
          width: '64px', height: '64px', margin: '0 auto 20px', 
          backgroundColor: 'var(--color-primary-container)', 
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }}>sync</span>
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-on-surface)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Carregando pedidos...</h3>
        <p style={{ fontSize: '14px', color: 'var(--color-outline)' }}>Sincronizando com o banco de dados.</p>
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', backgroundColor: 'var(--color-surface)' }}>
        <div style={{ 
          width: '64px', height: '64px', margin: '0 auto 20px', 
          backgroundColor: 'var(--color-surface-container-highest)', 
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--color-outline)' }}>inventory_2</span>
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-on-surface)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Nenhum pedido encontrado</h3>
        <p style={{ fontSize: '14px', color: 'var(--color-outline)', maxWidth: '300px', margin: '0 auto' }}>Não há pedidos que correspondam aos filtros atuais. Tente limpar os filtros ou criar um novo pedido.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop View: Table */}
      <div className="hide-mobile" style={{ overflowX: 'auto', backgroundColor: 'var(--color-surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-surface-container-low)', borderBottom: '2px solid var(--color-outline-variant)' }}>
              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nº Pedido / Data</th>
              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente / Contato</th>
              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destino (Entrega)</th>
              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsável</th>
              <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '12px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
              <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '12px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ação Rápida</th>
              <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Total</th>
              <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '12px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((pedido) => {
              const status = statusConfig[pedido.status_pedido] || statusConfig.aguardando_preparacao;
              
              return (
                <tr 
                  key={pedido.id} 
                  style={{ borderBottom: '1px solid var(--color-outline-variant)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer' }}
                  onClick={() => onSelectPedido(pedido)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)';
                    e.currentTarget.style.boxShadow = 'inset 4px 0 0 0 var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--color-on-surface)', fontSize: '14px' }}>#{pedido.numero_pedido}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-outline)', fontWeight: 600 }}>{formatDate(pedido.data_criacao || pedido.created_at)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-on-surface)', fontSize: '14px' }}>{pedido.nome_cliente || pedido.cliente?.nome || 'Consumidor'}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>{pedido.telefone_cliente || pedido.cliente?.telefone || 'Sem telefone'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', maxWidth: '220px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--color-on-surface)', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pedido.endereco_entrega || pedido.cliente?.endereco || 'RETIRADA NA LOJA'}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-outline)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pedido.bairro || pedido.cliente?.bairro}, {pedido.cidade || pedido.cliente?.cidade}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '13px' }}>{pedido.nome_vendedor || pedido.vendedor?.nome || 'Admin'}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-outline)', fontFamily: 'monospace' }}>ID: {pedido.codigo_vendedor || pedido.vendedor_id?.substring(0, 8).toUpperCase() || 'SISTEMA'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <span style={{ 
                      padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800,
                      textTransform: 'uppercase', backgroundColor: `${status.bg}90`, color: status.color,
                      border: `1px solid ${status.color}40`,
                      display: 'inline-flex', alignItems: 'center', gap: '6px', letterSpacing: '0.05em'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{status.icon}</span>
                      {status.label}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    {statusWorkflow[pedido.status_pedido]?.next ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAdvance(pedido.id, pedido.status_pedido);
                        }}
                        disabled={updatingId === pedido.id}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'var(--color-primary-container)',
                          color: 'var(--color-on-primary-container)',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: updatingId === pedido.id ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          opacity: updatingId === pedido.id ? 0.7 : 1,
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onMouseEnter={(e) => { 
                          if (updatingId !== pedido.id) {
                            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                            e.currentTarget.style.color = 'var(--color-on-primary)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                          }
                        }}
                        onMouseLeave={(e) => { 
                          if (updatingId !== pedido.id) {
                            e.currentTarget.style.backgroundColor = 'var(--color-primary-container)';
                            e.currentTarget.style.color = 'var(--color-on-primary-container)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                      >
                        {updatingId === pedido.id ? (
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>sync</span>
                        ) : (
                          <>
                            {statusWorkflow[pedido.status_pedido].actionLabel}
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--color-outline)', fontStyle: 'italic', fontWeight: 500 }}>Sem ações</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 900, color: 'var(--color-on-surface)', fontSize: '15px' }}>
                    {formatCurrency(pedido.valor_total)}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPedido(pedido);
                      }}
                      className="material-symbols-outlined" 
                      style={{ 
                        padding: '8px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)', 
                        backgroundColor: 'var(--color-surface)', 
                        color: 'var(--color-on-surface-variant)', fontSize: '20px', cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'inline-flex'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-primary-fixed)';
                        e.currentTarget.style.color = 'var(--color-on-primary-fixed)';
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                        e.currentTarget.style.color = 'var(--color-on-surface-variant)';
                        e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                      title="Ver detalhes do pedido"
                    >
                      open_in_new
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile View: Compact List */}
      <div className="hide-desktop" style={{ 
        display: 'flex', flexDirection: 'column', 
        backgroundColor: 'var(--color-surface)',
        borderRadius: '16px',
        border: '1px solid var(--color-outline-variant)',
        overflow: 'hidden',
        margin: '16px 12px'
      }}>
        {pedidos.map((pedido, index) => {
          const status = statusConfig[pedido.status_pedido] || statusConfig.aguardando_preparacao;
          const isUpdating = updatingId === pedido.id;
          const isLast = index === pedidos.length - 1;

          return (
            <div 
              key={pedido.id}
              onClick={() => onSelectPedido(pedido)}
              style={{
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                borderBottom: isLast ? 'none' : '1px solid var(--color-outline-variant)',
                position: 'relative',
                backgroundColor: 'var(--color-surface)',
                transition: 'background-color 0.2s',
                cursor: 'pointer'
              }}
            >
              {/* Highlight bar */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', backgroundColor: status.color }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, color: 'var(--color-on-surface)', fontSize: '14px' }}>#{pedido.numero_pedido}</span>
                  <span style={{ 
                    padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800,
                    textTransform: 'uppercase', backgroundColor: `${status.bg}80`, color: status.color,
                  }}>
                    {status.label}
                  </span>
                </div>
                <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '14px' }}>
                  {formatCurrency(pedido.valor_total)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '13px' }}>
                    {pedido.nome_cliente || pedido.cliente?.nome || 'Consumidor'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                    {pedido.cidade || pedido.cliente?.cidade} • {formatDate(pedido.data_criacao || pedido.created_at)}
                  </span>
                </div>
                
                {statusWorkflow[pedido.status_pedido]?.next && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickAdvance(pedido.id, pedido.status_pedido);
                    }}
                    disabled={isUpdating}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--color-primary-container)',
                      color: 'var(--color-on-primary-container)',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {isUpdating ? '...' : 'Avançar'}
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
