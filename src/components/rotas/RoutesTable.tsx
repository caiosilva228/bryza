'use client';

import React from 'react';
import { DeliveryRoute } from '@/models/types';
import { formatCurrency, formatDate, formatShortDate } from '@/utils/format';

export const ROUTE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  'Planejada': { label: 'Planejada', color: '#64748b', bg: '#f1f5f9', icon: 'edit_calendar' },
  'Separando Produtos': { label: 'Separando Produtos', color: '#d97706', bg: '#fef3c7', icon: 'inventory_2' },
  'Pronta para Sair': { label: 'Pronta para Sair', color: '#2563eb', bg: '#dbeafe', icon: 'check_circle' },
  'Em Andamento': { label: 'Em Andamento', color: '#7c3aed', bg: '#ede9fe', icon: 'local_shipping' },
  'Finalizada': { label: 'Finalizada', color: '#059669', bg: '#d1fae5', icon: 'task_alt' },
  'Finalizada com Pendências': { label: 'Finalizada com Pendências', color: '#ea580c', bg: '#ffedd5', icon: 'warning' },
  'Cancelada': { label: 'Cancelada', color: '#dc2626', bg: '#fee2e2', icon: 'cancel' },
};

interface Props {
  routes: DeliveryRoute[];
  onViewDetails: (route: DeliveryRoute) => void;
}

export default function RoutesTable({ routes, onViewDetails }: Props) {
  if (routes.length === 0) {
    return (
      <div style={{
        backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)',
        borderRadius: '16px', padding: '64px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', backgroundColor: 'var(--color-surface-container)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--color-outline)', opacity: 0.5 }}>route</span>
        </div>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-headline)' }}>Nenhuma rota encontrada</h3>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--color-on-surface-variant)' }}>
          Nenhuma rota corresponde aos filtros selecionados.
        </p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-surface-container-highest)', borderBottom: '1px solid var(--color-outline-variant)' }}>
              {['Rota', 'Data', 'Motorista', 'Região', 'Pedidos', 'Valor Total', 'Status', 'Ações'].map(col => (
                <th key={col} style={{
                  padding: '12px 16px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: 'var(--color-on-surface-variant)', textAlign: 'left', whiteSpace: 'nowrap'
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routes.map(r => {
              const statusCfg = ROUTE_STATUS_CONFIG[r.status] ?? ROUTE_STATUS_CONFIG['Planejada'];
              const dateStr = r.date + 'T00:00:00';
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--color-outline-variant)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  
                  {/* Nome da Rota */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>{r.name}</span>
                  </td>

                  {/* Data */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{formatShortDate(dateStr)}</span>
                  </td>

                  {/* Motorista */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{r.driver_name || '—'}</span>
                  </td>

                  {/* Região */}
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{r.city || '—'}</p>
                    {r.neighborhoods && r.neighborhoods.length > 0 && (
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-on-surface-variant)', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.neighborhoods.join(', ')}>
                        {r.neighborhoods.join(', ')}
                      </p>
                    )}
                  </td>

                  {/* Pedidos */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800 }}>{r.totalOrders}</span>
                  </td>

                  {/* Valor Total */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800 }}>{formatCurrency(r.totalAmount || 0)}</span>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '4px 10px', borderRadius: '20px',
                      backgroundColor: statusCfg.bg, color: statusCfg.color,
                      fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{statusCfg.icon}</span>
                      {statusCfg.label}
                    </span>
                  </td>

                  {/* Ações */}
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => onViewDetails(r)}
                      title="Detalhes / Gerenciar Rota"
                      style={{
                        padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-primary)',
                        backgroundColor: 'rgba(0,86,117,0.05)', color: 'var(--color-primary)',
                        fontFamily: 'var(--font-headline)', fontSize: '12px', fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(0,86,117,0.05)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                      Gerenciar
                    </button>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
