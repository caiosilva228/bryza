import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getVendas } from '@/services/vendas';
import { formatCurrency } from '@/utils/format';
import { VendasFilter } from '@/components/vendas/VendasFilter';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export const revalidate = 0;

export default async function VendasPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const from = searchParams.from;
  const to = searchParams.to;

  const startDate = typeof from === 'string' ? from : format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const endDate = typeof to === 'string' ? to : format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const vendasRaw = await getVendas(startDate, endDate);
  
  // Garantir que vendas é um array
  const vendas = Array.isArray(vendasRaw) ? vendasRaw : [];

  // Cálculo de estatísticas simples para o layout Bento
  const faturamentoTotal = vendas.reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0);
  const ticketMedio = vendas.length > 0 ? faturamentoTotal / vendas.length : 0;
  const clientesUnicos = new Set(vendas.map(v => v.cliente_id)).size;

  const getStatusConfig = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'pago': 
      case 'finalizado': return { label: 'Finalizado', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: 'check_circle' };
      case 'em_entrega': return { label: 'Em Trânsito', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: 'local_shipping' };
      case 'pendente': 
      case 'aguardando_pagamento': return { label: 'Pendente', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: 'schedule' };
      case 'cancelado': return { label: 'Cancelado', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: 'cancel' };
      default: return { label: status?.replace('_', ' ').toUpperCase() || 'N/D', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)', icon: 'info' };
    }
  };

  return (
    <MainLayout>
      <div style={{ padding: '32px' }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>history</span>
              Histórico de Vendas
            </h1>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px' }}>
              Rastreabilidade total e inteligência financeira do ecossistema Bryza.
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-on-surface-variant)',
              border: '1px solid var(--color-outline-variant)',
              padding: '12px 16px',
              borderRadius: '12px',
              fontFamily: 'var(--font-headline)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
              Exportar
            </button>
            <a href="/vendas/pedidos" style={{
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '12px',
              fontFamily: 'var(--font-headline)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(var(--color-primary-rgb), 0.3)'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>receipt_long</span>
              Nova Transação
            </a>
          </div>
        </div>

        {/* Filters Section */}
        <VendasFilter />

        {/* Bento Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          
          {/* Faturamento Total */}
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '24px', border: '1px solid var(--color-outline-variant)', display: 'flex', flexDirection: 'column' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ padding: '8px', backgroundColor: 'rgba(59, 130, 246, 0.15)', borderRadius: '12px', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                  <span className="material-symbols-outlined">attach_money</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '4px 8px', borderRadius: '100px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>trending_up</span>
                  +12.5%
                </div>
             </div>
             <p style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Faturamento Total</p>
             <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--color-on-surface)' }}>{formatCurrency(faturamentoTotal)}</h2>
          </div>

          {/* Ticket Médio */}
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '24px', border: '1px solid var(--color-outline-variant)', display: 'flex', flexDirection: 'column' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ padding: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: '12px', color: '#10b981', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                  <span className="material-symbols-outlined">receipt</span>
                </div>
             </div>
             <p style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Ticket Médio</p>
             <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--color-on-surface)' }}>{formatCurrency(ticketMedio)}</h2>
          </div>

          {/* Clientes Únicos */}
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '24px', border: '1px solid var(--color-outline-variant)', display: 'flex', flexDirection: 'column' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ padding: '8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', borderRadius: '12px', color: '#6366f1', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                  <span className="material-symbols-outlined">group</span>
                </div>
             </div>
             <p style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Clientes Únicos</p>
             <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--color-on-surface)' }}>{clientesUnicos}</h2>
          </div>

          {/* Vendas Totais */}
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '24px', border: '1px solid var(--color-outline-variant)', display: 'flex', flexDirection: 'column' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ padding: '8px', backgroundColor: 'var(--color-surface-container-highest)', borderRadius: '12px', color: 'var(--color-on-surface-variant)', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                  <span className="material-symbols-outlined">calendar_today</span>
                </div>
             </div>
             <p style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Vendas Totais</p>
             <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--color-on-surface)' }}>{vendas.length}</h2>
          </div>

        </div>

        {/* Content Section */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          border: '1px solid var(--color-outline-variant)',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          {/* List Toolbar */}
          <div style={{
            display: 'flex',
            gap: '16px',
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-outline-variant)',
            backgroundColor: 'var(--color-surface-container-low)',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '400px' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-outline)' }}>search</span>
              <input 
                type="text" 
                placeholder="Buscar por cliente ou ID..."
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
              <button style={{
                display: 'flex', alignItems: 'center', gap: '8px', 
                padding: '12px 16px', fontSize: '13px', fontWeight: 700, 
                color: 'var(--color-on-surface-variant)', backgroundColor: 'transparent',
                border: 'none', cursor: 'pointer'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_list</span>
                Filtros Avançados
              </button>
            </div>
          </div>

          {vendas.length === 0 ? (
            <div style={{ padding: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--color-surface-container-highest)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-outline)', opacity: 0.5 }}>receipt</span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '8px' }}>Histórico Silencioso</h3>
              <p style={{ color: 'var(--color-on-surface-variant)', maxWidth: '400px', lineHeight: 1.5, fontSize: '14px', fontFamily: 'var(--font-body)' }}>
                Ainda não há registros de vendas finalizadas. O fluxo comercial começará a pulsar aqui assim que os primeiros pedidos forem concluídos.
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
                  {vendas.map(v => {
                    const status = getStatusConfig(v.status_venda);
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
                                {v.data_venda ? new Date(v.data_venda).toLocaleDateString('pt-BR', { month: 'short' }) : '---'}
                              </span>
                              <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--color-on-surface)' }}>
                                {v.data_venda ? new Date(v.data_venda).toLocaleDateString('pt-BR', { day: '2-digit' }) : '--'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-outline)' }}>
                                {v.data_venda ? new Date(v.data_venda).toLocaleDateString('pt-BR', { year: 'numeric' }) : '---'}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--color-outline)', fontFamily: 'monospace' }}>
                                #{v.id?.slice(0, 8).toUpperCase() || 'ID_N/A'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                              {v.cliente?.nome || 'Entidade Desconhecida'}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                              ID: {v.cliente_id?.slice(0, 8) || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '13px', fontWeight: 900, color: 'var(--color-on-surface)' }}>
                              {formatCurrency(Number(v.valor_total) || 0)}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--color-outline)', fontWeight: 700, textTransform: 'uppercase' }}>
                              Via {v.forma_pagamento || 'N/D'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
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
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button style={{
                            padding: '4px', borderRadius: '4px', border: 'none',
                            backgroundColor: 'var(--color-surface-container-low)', color: 'var(--color-on-surface)',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                          }}>
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
      </div>
    </MainLayout>
  );
}
