'use client';

import React, { useState, useMemo } from 'react';
import { formatCurrency } from '@/utils/format';
import { MetricCard } from '@/components/dashboard/MetricCard';
import VendaDetailsModal from './VendaDetailsModal';

interface Props {
  vendas: any[];
  statsCards: any[];
}

export default function VendasClientPage({ vendas, statsCards }: Props) {
  const [search, setSearch] = useState('');
  const [selectedVendaId, setSelectedVendaId] = useState<string | null>(null);

  const filteredVendas = useMemo(() => {
    return vendas.filter((venda) => {
      const searchLower = search.toLowerCase();
      const clientName = (venda.cliente?.nome || '').toLowerCase();
      const clienteId = (venda.cliente_id || '').toLowerCase();
      const vendaId = (venda.id || '').toLowerCase();
      
      return (
        clientName.includes(searchLower) ||
        clienteId.includes(searchLower) ||
        vendaId.includes(searchLower)
      );
    });
  }, [vendas, search]);

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

  return (
    <>
      <div className="dashboard-grid-container" style={{ marginBottom: '32px' }}>
        {statsCards.map((card, index) => (
          <MetricCard
            key={index}
            label={card.label}
            value={card.value}
            suffix={card.suffix}
            icon={card.icon}
            colorHint={card.colorHint}
          />
        ))}
      </div>

      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          border: '1px solid var(--color-outline-variant)',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '16px',
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-outline-variant)',
            backgroundColor: 'var(--color-surface-container-low)',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '400px' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-outline)' }}>search</span>
            <input
              type="text"
              placeholder="Buscar por cliente ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px 12px 40px',
                borderRadius: '8px',
                border: '1px solid var(--color-outline-variant)',
                backgroundColor: 'var(--color-surface)',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--color-on-surface)',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--color-on-surface-variant)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_list</span>
              Filtros Avançados
            </button>
          </div>
        </div>

        {filteredVendas.length === 0 ? (
          <div style={{ padding: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--color-surface-container-highest)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-outline)', opacity: 0.5 }}>receipt</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '8px' }}>Nenhuma Venda Encontrada</h3>
            <p style={{ color: 'var(--color-on-surface-variant)', maxWidth: '400px', lineHeight: 1.5, fontSize: '14px', fontFamily: 'var(--font-body)' }}>
              Tente redefinir seus filtros ou termo de busca.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'var(--color-surface-container-highest)', borderBottom: '1px solid var(--color-outline-variant)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Temporalidade</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Identidade do Cliente</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Fluxo Financeiro</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', textAlign: 'center' }}>Estado Logístico</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendas.map((venda) => {
                  const status = getStatusConfig(venda.status_venda);
                  return (
                    <tr key={venda.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
                              {venda.data_venda ? new Date(venda.data_venda).toLocaleDateString('pt-BR', { month: 'short' }) : '---'}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--color-on-surface)' }}>
                              {venda.data_venda ? new Date(venda.data_venda).toLocaleDateString('pt-BR', { day: '2-digit' }) : '--'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-outline)' }}>
                              {venda.data_venda ? new Date(venda.data_venda).toLocaleDateString('pt-BR', { year: 'numeric' }) : '---'}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--color-outline)', fontFamily: 'monospace' }}>
                              #{venda.id?.slice(0, 8).toUpperCase() || 'ID_N/A'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                            {venda.cliente?.nome || 'Entidade Desconhecida'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                            ID: {venda.cliente_id?.slice(0, 8) || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '13px', fontWeight: 900, color: 'var(--color-on-surface)' }}>
                            {formatCurrency(Number(venda.valor_total) || 0)}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--color-outline)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Via {venda.forma_pagamento || 'N/D'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '2px',
                            fontSize: '10px',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            backgroundColor: status.bg,
                            color: status.color,
                            border: `1px solid ${status.color}40`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{status.icon}</span>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedVendaId(venda.id)}
                          style={{
                            padding: '4px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: 'var(--color-surface-container-low)',
                            color: 'var(--color-on-surface)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)'; }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_outward</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedVendaId && (
        <VendaDetailsModal
          vendaId={selectedVendaId}
          isOpen={!!selectedVendaId}
          onClose={() => setSelectedVendaId(null)}
        />
      )}
    </>
  );
}
