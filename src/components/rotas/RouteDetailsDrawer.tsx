'use client';

import React, { useState } from 'react';
import { DeliveryRoute, RouteOrder, RouteStatus } from '@/models/types';
import { formatCurrency, formatDate, formatShortDate } from '@/utils/format';
import { ROUTE_STATUS_CONFIG } from './RoutesTable';

interface Props {
  route: (DeliveryRoute & { delivery_route_orders?: RouteOrder[] }) | null;
  open: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: RouteStatus) => Promise<void>;
  onStartRoute: (id: string) => Promise<void>;
  onFinishRoute: (id: string) => Promise<void>;
  onCancelRoute: (id: string) => Promise<void>;
  onReorder: (id: string, orders: { routeOrderId: string, sequence: number }[]) => Promise<void>;
  onMarkDelivered: (routeId: string, routeOrderId: string, orderId: string) => Promise<void>;
  onMarkNotDelivered: (routeId: string, routeOrderId: string, orderId: string) => void; // abre o modal
  onOpenManifest: (route: DeliveryRoute) => void;
  onOpenMap: (route: DeliveryRoute & { delivery_route_orders?: RouteOrder[] }) => void;
  loading?: boolean;
}

export default function RouteDetailsDrawer({
  route, open, onClose,
  onUpdateStatus, onStartRoute, onFinishRoute, onCancelRoute, onReorder,
  onMarkDelivered, onMarkNotDelivered, onOpenManifest, onOpenMap, loading
}: Props) {
  if (!open || !route) return null;

  const statusCfg = ROUTE_STATUS_CONFIG[route.status] ?? ROUTE_STATUS_CONFIG['Planejada'];
  const orders = [...(route.delivery_route_orders || [])].sort((a, b) => a.sequence - b.sequence);

  const canEditStatus = route.status === 'Planejada' || route.status === 'Separando Produtos' || route.status === 'Pronta para Sair';
  const isEmAndamento = route.status === 'Em Andamento';
  const isFinalizada = route.status.startsWith('Finalizada');

  const moveOrder = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === orders.length - 1) return;
    
    const newOrders = [...orders];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    [newOrders[index], newOrders[targetIndex]] = [newOrders[targetIndex], newOrders[index]];
    
    const reordered = newOrders.map((o, i) => ({ routeOrderId: o.id, sequence: i + 1 }));
    await onReorder(route.id, reordered);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'var(--color-surface)',
        width: '100%', maxWidth: '640px', height: '100vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
        transition: 'transform 0.3s ease',
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container-low)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: statusCfg.bg, color: statusCfg.color, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                  {statusCfg.label}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>
                  {formatShortDate(route.date + 'T00:00:00')}
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>{route.name}</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'var(--color-on-surface-variant)' }}>close</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ backgroundColor: 'var(--color-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)' }}>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Motorista</p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 700 }}>{route.driver_name || 'Sem motorista definido'}</p>
            </div>
            <div style={{ backgroundColor: 'var(--color-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)' }}>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Previsão de Saída</p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 700 }}>{route.departure_time || '—'}</p>
            </div>
            <div style={{ backgroundColor: 'var(--color-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)' }}>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Valor Total</p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(route.totalAmount || 0)}</p>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', gap: '8px', overflowX: 'auto', backgroundColor: '#fff' }}>
          
          <button onClick={() => onOpenManifest(route)} style={actionBtnStyle}>
            <span className="material-symbols-outlined">receipt_long</span> Romaneio
          </button>
          
          <button onClick={() => onOpenMap(route)} style={actionBtnStyle}>
            <span className="material-symbols-outlined">map</span> Rota no Mapa
          </button>

          {route.status === 'Planejada' && (
            <button disabled={loading} onClick={() => onUpdateStatus(route.id, 'Separando Produtos')} style={{ ...actionBtnStyle, backgroundColor: '#fef3c7', color: '#d97706', borderColor: '#fde68a' }}>
              Separar Produtos
            </button>
          )}

          {route.status === 'Separando Produtos' && (
            <button disabled={loading} onClick={() => onUpdateStatus(route.id, 'Pronta para Sair')} style={{ ...actionBtnStyle, backgroundColor: '#dbeafe', color: '#2563eb', borderColor: '#bfdbfe' }}>
              Marcar Pronta para Sair
            </button>
          )}

          {route.status === 'Pronta para Sair' && (
            <button disabled={loading} onClick={() => onStartRoute(route.id)} style={{ ...actionBtnStyle, backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }}>
              <span className="material-symbols-outlined">local_shipping</span> Iniciar Rota
            </button>
          )}

          {isEmAndamento && (
            <button disabled={loading} onClick={() => onFinishRoute(route.id)} style={{ ...actionBtnStyle, backgroundColor: '#10b981', color: '#fff', borderColor: '#10b981' }}>
              <span className="material-symbols-outlined">task_alt</span> Finalizar Rota
            </button>
          )}

          {canEditStatus && (
            <button disabled={loading} onClick={() => onCancelRoute(route.id)} style={{ ...actionBtnStyle, marginLeft: 'auto', color: '#ef4444' }}>
              Cancelar
            </button>
          )}
        </div>

        {/* Content (Orders) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: 'var(--color-surface)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800 }}>Pedidos na Rota ({orders.length})</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {orders.map((ro, idx) => {
              const p = ro.pedido;
              if (!p) return null;
              
              const waLink = p.cliente?.telefone ? `https://wa.me/55${p.cliente.telefone.replace(/\D/g, '')}` : null;
              const isPendente = ro.status === 'Pendente' || ro.status === 'Em Rota';

              return (
                <div key={ro.id} style={{
                  border: '1px solid var(--color-outline-variant)', borderRadius: '12px', padding: '16px',
                  backgroundColor: ro.status === 'Entregue' ? 'rgba(16,185,129,0.05)' : ro.status === 'Não Entregue' ? 'rgba(239,68,68,0.05)' : 'var(--color-surface)',
                  opacity: ro.status === 'Cancelado' ? 0.6 : 1
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {/* Reorder controls */}
                      {canEditStatus && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <button onClick={() => moveOrder(idx, 'up')} disabled={idx === 0 || loading} style={reorderBtnStyle}><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>expand_less</span></button>
                          <span style={{ fontSize: '11px', fontWeight: 800, margin: '2px 0' }}>{idx + 1}</span>
                          <button onClick={() => moveOrder(idx, 'down')} disabled={idx === orders.length - 1 || loading} style={reorderBtnStyle}><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>expand_more</span></button>
                        </div>
                      )}
                      {!canEditStatus && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-surface-container-highest)', fontWeight: 800, fontSize: '12px' }}>
                          {idx + 1}
                        </div>
                      )}

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>{p.cliente?.nome || p.nome_cliente || '—'}</h4>
                          <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--color-primary)', fontWeight: 700 }}>#{p.numero_pedido}</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                          {p.cliente?.endereco || p.endereco_entrega || 'Endereço não informado'}
                          {p.cliente?.numero ? `, ${p.cliente.numero}` : ''} - {p.cliente?.bairro || p.bairro}
                        </p>
                        {p.itens && p.itens.length > 0 && (
                          <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--color-on-surface)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>inventory_2</span>
                            {p.itens.map(item => `${item.quantidade}x ${item.produto?.nome_produto || 'Produto'}`).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>{formatCurrency(p.valor_total)}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textTransform: 'uppercase' }}>{p.forma_pagamento}</p>
                    </div>
                  </div>

                  {ro.status !== 'Pendente' && ro.status !== 'Em Rota' && (
                    <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'var(--color-surface-container)', fontSize: '12px', fontWeight: 600, color: ro.status === 'Entregue' ? '#10b981' : ro.status === 'Não Entregue' ? '#ef4444' : 'var(--color-on-surface-variant)', display: 'inline-block', marginBottom: '12px' }}>
                      Status: {ro.status} {ro.notes && <span style={{ color: 'var(--color-on-surface-variant)' }}>— {ro.notes}</span>}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {waLink && (
                      <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ ...actionBtnStyle, textDecoration: 'none', color: '#25d366', borderColor: 'rgba(37,211,102,0.3)', backgroundColor: 'rgba(37,211,102,0.05)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chat</span> WhatsApp
                      </a>
                    )}
                    
                    {isEmAndamento && isPendente && (
                      <>
                        <button disabled={loading} onClick={() => onMarkDelivered(route.id, ro.id, p.id)} style={{ ...actionBtnStyle, color: '#10b981', borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.05)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span> Entregue
                        </button>
                        <button disabled={loading} onClick={() => onMarkNotDelivered(route.id, ro.id, p.id)} style={{ ...actionBtnStyle, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span> Não Entregue
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)',
  backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)',
  fontFamily: 'var(--font-headline)', fontSize: '12px', fontWeight: 700,
  cursor: 'pointer', whiteSpace: 'nowrap'
};

const reorderBtnStyle: React.CSSProperties = {
  width: '24px', height: '24px', borderRadius: '4px', border: '1px solid var(--color-outline-variant)',
  backgroundColor: 'var(--color-surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: 'var(--color-on-surface-variant)', padding: 0
};
