'use client';

import { Pedido, StatusPedido } from '@/models/types';
import { statusConfig, statusWorkflow } from '../constants/workflow';
import { updatePedidoStatus } from '../actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';
import { useState } from 'react';

interface Props {
  pedidos: Pedido[];
  onSelectPedido: (pedido: Pedido) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}


export default function PedidoTable({ pedidos, onSelectPedido, onRefresh, isLoading }: Props) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
      <div style={{ padding: '64px', textAlign: 'center', color: 'var(--color-outline)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1s linear infinite', marginBottom: '16px' }}>sync</span>
        <p style={{ fontSize: '14px', fontFamily: 'var(--font-body)' }}>Carregando dados...</p>
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div style={{ padding: '64px', textAlign: 'center', color: 'var(--color-outline)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>inbox</span>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '4px' }}>Sem registros encontrados</h3>
        <p style={{ fontSize: '14px', fontFamily: 'var(--font-body)' }}>Nenhum pedido localizado no sistema.</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--color-surface-container-highest)', borderBottom: '1px solid var(--color-outline-variant)' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Nº Pedido / Data</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Cliente / Contato</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Destino (Entrega)</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Vendedor / Resp.</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Status</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Ação Rápida</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Valor Total</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((pedido) => {
            const status = statusConfig[pedido.status_pedido] || statusConfig.aguardando_preparacao;
            
            return (
              <tr 
                key={pedido.id} 
                style={{ borderBottom: '1px solid var(--color-outline-variant)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '13px' }}>#{pedido.numero_pedido}</span>
                    <span style={{ fontSize: '10px', color: 'var(--color-outline)' }}>{formatDate(pedido.data_criacao || pedido.created_at)}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '13px' }}>{pedido.nome_cliente || pedido.cliente?.nome || 'Consumidor'}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 500 }}>{pedido.telefone_cliente || pedido.cliente?.telefone || 'Sem telefone'}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 16px', maxWidth: '200px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--color-on-surface)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pedido.endereco_entrega || pedido.cliente?.endereco || 'RETIRADA'}</span>
                    <span style={{ fontSize: '10px', color: 'var(--color-outline)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pedido.bairro || pedido.cliente?.bairro}, {pedido.cidade || pedido.cliente?.cidade}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '13px' }}>{pedido.nome_vendedor || pedido.vendedor?.nome || 'Admin'}</span>
                    <span style={{ fontSize: '10px', color: 'var(--color-outline)', fontFamily: 'monospace' }}>ID: {pedido.codigo_vendedor || pedido.vendedor_id?.substring(0, 8).toUpperCase() || 'SISTEMA'}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span style={{ 
                    padding: '2px 8px', borderRadius: '2px', fontSize: '10px', fontWeight: 900,
                    textTransform: 'uppercase', backgroundColor: status.bg, color: status.color,
                    border: `1px solid ${status.color}40`,
                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{status.icon}</span>
                    {status.label}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  {statusWorkflow[pedido.status_pedido]?.next ? (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickAdvance(pedido.id, pedido.status_pedido);
                      }}
                      disabled={updatingId === pedido.id}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--color-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 900,
                        cursor: updatingId === pedido.id ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(var(--color-primary-rgb), 0.2)',
                        opacity: updatingId === pedido.id ? 0.7 : 1,
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => { if (updatingId !== pedido.id) e.currentTarget.style.filter = 'brightness(1.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                    >
                      {updatingId === pedido.id ? (
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', animation: 'spin 1s linear infinite' }}>sync</span>
                      ) : (
                        statusWorkflow[pedido.status_pedido].actionLabel
                      )}
                    </button>
                  ) : (
                    <span style={{ fontSize: '10px', color: 'var(--color-outline)', fontStyle: 'italic' }}>Sem ações</span>
                  )}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '13px' }}>
                  {formatCurrency(pedido.valor_total)}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <button 
                    onClick={() => onSelectPedido(pedido)}
                    className="material-symbols-outlined" 
                    style={{ 
                      padding: '4px', borderRadius: '4px', border: '1px solid var(--color-outline-variant)', 
                      backgroundColor: 'var(--color-surface)', 
                      color: 'var(--color-on-surface)', fontSize: '18px', cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
                    title="Ver detalhes do pedido"
                  >
                    visibility
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
