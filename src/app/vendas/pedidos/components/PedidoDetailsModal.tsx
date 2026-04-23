'use client';

import React, { useState, useEffect } from 'react';
import { Pedido, PedidoItem, StatusPedido } from '@/models/types';
import { updatePedidoStatus, getPedidoById } from '../actions';
import { statusWorkflow } from '../constants/workflow';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';

interface Props {
  pedido: Pedido;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onEdit?: (pedido: Pedido) => void;
}


export default function PedidoDetailsModal({ pedido: pedidoInitial, isOpen, onClose, onUpdate, onEdit }: Props) {
  const [itens, setItens] = useState<PedidoItem[]>([]);
  const [pedido, setPedido] = useState<Pedido>(pedidoInitial);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isOpen && pedidoInitial.id) {
      loadDetails();
    }
  }, [isOpen, pedidoInitial.id]);

  async function loadDetails() {
    setIsLoading(true);
    try {
      const data = await getPedidoById(pedidoInitial.id);
      setPedido(data);
      setItens(data.itens || []);
    } catch (error) {
      toast.error('Erro ao carregar detalhes do pedido.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusUpdate(nextStatus: StatusPedido) {
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

    setIsUpdating(true);
    try {
      await updatePedidoStatus(pedido.id, nextStatus);
      toast.success(`STATUS ATUALIZADO: ${statusWorkflow[nextStatus].label}`);
      onUpdate();
      onClose();
    } catch (error) {
      toast.error('Erro ao atualizar status.');
    } finally {
      setIsUpdating(false);
    }
  }

  if (!isOpen) return null;

  const currentStatus = statusWorkflow[pedido.status_pedido] || statusWorkflow['aguardando_preparacao'];

  return (
    <div className="modal-overlay" style={{ fontFamily: 'var(--font-sans)' }}>
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
            PEDIDO #{pedido.numero_pedido}
          </h1>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px', color: 'var(--color-on-surface-variant)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person</span>
              <span>
                Vendedor: <span style={{ fontWeight: 500, color: 'var(--color-on-surface)' }}>{pedido.nome_vendedor || pedido.vendedor?.nome || 'Não definido'}</span> 
                <span style={{ color: 'var(--color-outline)', marginLeft: '4px' }}>({pedido.codigo_vendedor || pedido.vendedor_id?.substring(0, 8).toUpperCase() || 'SISTEMA'})</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>schedule</span>
              <span>Data: {formatDate(pedido.data_criacao || pedido.created_at)}</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '8px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Main Info Blocks */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', marginBottom: '32px' }}>
            {/* Bloco Cliente */}
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px', marginBottom: '16px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline)' }}>person</span>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>DADOS DO CLIENTE</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Nome:</span>
                  <span style={{ fontWeight: 500, color: 'var(--color-on-surface)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pedido.nome_cliente || pedido.cliente?.nome || 'Consumidor Final'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Telefone:</span>
                  <span style={{ fontWeight: 500, color: 'var(--color-on-surface)', textAlign: 'right' }}>
                    {pedido.telefone_cliente || pedido.cliente?.telefone || '--'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Endereço:</span>
                  <span style={{ fontWeight: 500, color: 'var(--color-on-surface)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pedido.endereco_entrega || pedido.cliente?.endereco || 'Retirada'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Complemento:</span>
                  <span style={{ fontWeight: 500, color: 'var(--color-on-surface)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pedido.complemento || pedido.cliente?.numero || '--'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Bairro/Cidade:</span>
                  <span style={{ fontWeight: 500, color: 'var(--color-on-surface)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pedido.bairro || pedido.cliente?.bairro || '--'}, {pedido.cidade || pedido.cliente?.cidade || '--'} {pedido.estado || pedido.cliente?.estado ? `- ${pedido.estado || pedido.cliente?.estado}` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Bloco Financeiro */}
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px', marginBottom: '16px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline)' }}>credit_card</span>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>PAGAMENTO E STATUS</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Forma de Pagamento:</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', textAlign: 'right' }}>
                    {pedido.forma_pagamento || 'PENDENTE'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Status Atual:</span>
                  <span style={{ fontWeight: 700, textAlign: 'right', color: currentStatus.color }}>
                    {currentStatus.label}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', paddingTop: '8px' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px', fontWeight: 600 }}>Total GERAL:</span>
                  <span style={{ fontWeight: 700, fontSize: '20px', color: '#0d9488', textAlign: 'right' }}>
                    {formatCurrency(pedido.valor_total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px', marginBottom: '16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline)' }}>package</span>
              <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>ITENS DO PEDIDO</h3>
            </div>
            
            <div style={{ border: '1px solid var(--color-outline-variant)', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
              <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'var(--color-surface-container-low)', borderBottom: '1px solid var(--color-outline-variant)' }}>
                  <tr>
                    <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase' }}>CÓD/PRODUTO</th>
                    <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', textAlign: 'center', width: '80px' }}>QTD</th>
                    <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', textAlign: 'right', width: '120px' }}>VALOR UNIT.</th>
                    <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', textAlign: 'right', width: '120px' }}>SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.length > 0 ? itens.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < itens.length - 1 ? '1px solid var(--color-surface-variant)' : 'none', backgroundColor: 'var(--color-surface)' }}>
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
                  )) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-outline)' }}>Nenhum item adicionado a este pedido.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {pedido.observacoes && (
               <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '8px', fontSize: '14px', color: '#854d0e' }}>
                  <span style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Observações do Pedido:</span>
                  <p style={{ margin: 0 }}>{pedido.observacoes}</p>
               </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ 
          padding: '16px 24px', 
          borderTop: '1px solid var(--color-outline-variant)', 
          backgroundColor: 'var(--color-surface-container-lowest)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between'
        }}>
          <button 
            disabled={isUpdating || pedido.status_pedido === 'cancelado'}
            onClick={() => handleStatusUpdate('cancelado')}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              fontSize: '12px',
              fontWeight: 700,
              padding: '8px 12px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              cursor: (isUpdating || pedido.status_pedido === 'cancelado') ? 'not-allowed' : 'pointer',
              opacity: (isUpdating || pedido.status_pedido === 'cancelado') ? 0.5 : 1,
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            CANCELAR PEDIDO
          </button>

          {/* Botão de editar — só em aguardando_preparacao */}
          {pedido.status_pedido === 'aguardando_preparacao' && onEdit && (
            <button
              disabled={isUpdating}
              onClick={() => { onEdit(pedido); onClose(); }}
              style={{
                background: 'none',
                border: '1px solid #f59e0b',
                color: '#f59e0b',
                fontSize: '12px',
                fontWeight: 700,
                padding: '8px 12px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
              EDITAR PEDIDO
            </button>
          )}
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={onClose} 
              style={{
                padding: '10px 20px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-outline-variant)',
                color: 'var(--color-on-surface)',
                fontWeight: 700,
                fontSize: '12px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
            >
              FECHAR
            </button>
            
            {currentStatus.next && (
              <button 
                onClick={() => handleStatusUpdate(currentStatus.next!)}
                disabled={isUpdating}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--color-primary)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '12px',
                  borderRadius: '6px',
                  textTransform: 'uppercase',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(var(--color-primary-rgb), 0.2)',
                  opacity: isUpdating ? 0.7 : 1,
                }}
              >
                {isUpdating ? 'PROCESSANDO...' : currentStatus.actionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
