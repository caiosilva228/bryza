import React from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricColorHint } from '@/components/dashboard/MetricCard';
import { VendasFilter } from '@/components/vendas/VendasFilter';
import { getVendas } from '@/services/vendas';
import { formatCurrency } from '@/utils/format';
import VendasClientPage from './VendasClientPage';

export const revalidate = 0;

export default async function VendasPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const from = searchParams.from;
  const to = searchParams.to;
  const period = searchParams.period;

  const startDate =
    typeof period === 'string' && period === 'maximo'
      ? undefined
      : typeof from === 'string'
        ? from
        : format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const endDate =
    typeof period === 'string' && period === 'maximo'
      ? undefined
      : typeof to === 'string'
        ? to
        : format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const vendasRaw = await getVendas(startDate, endDate);
  const vendas = Array.isArray(vendasRaw) ? vendasRaw : [];

  const vendasAtivas = vendas.filter((v) => v.status_venda !== 'cancelado');

  const faturamentoTotal = vendasAtivas.reduce((acc, venda) => acc + (Number(venda.valor_total) || 0), 0);
  const ticketMedio = vendasAtivas.length > 0 ? faturamentoTotal / vendasAtivas.length : 0;
  const clientesUnicos = new Set(vendasAtivas.map((venda) => venda.cliente_id)).size;

  const statsCards: {
    label: string;
    value: string | number;
    suffix: string;
    icon: string;
    colorHint: MetricColorHint;
  }[] = [
    {
      label: 'FATURAMENTO',
      value: formatCurrency(faturamentoTotal),
      suffix: 'Período',
      icon: 'attach_money',
      colorHint: 'primary',
    },
    {
      label: 'TICKET MÉDIO',
      value: formatCurrency(ticketMedio),
      suffix: 'Por Venda',
      icon: 'receipt',
      colorHint: 'success',
    },
    {
      label: 'CLIENTES ÚNICOS',
      value: clientesUnicos,
      suffix: 'Base Ativa',
      icon: 'group',
      colorHint: 'secondary',
    },
    {
      label: 'VENDAS TOTAIS',
      value: vendasAtivas.length,
      suffix: 'Transações',
      icon: 'calendar_today',
      colorHint: 'default',
    },
  ];

  return (
    <MainLayout>
      <div className="page-wrapper">
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
            <button
              style={{
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
                transition: 'all 0.2s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
              Exportar
            </button>
            <a
              href="/vendas/pedidos"
              style={{
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
                boxShadow: '0 4px 12px rgba(var(--color-primary-rgb), 0.3)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>receipt_long</span>
              Nova Transação
            </a>
          </div>
        </div>

        <VendasFilter />

        <VendasClientPage vendas={vendas} statsCards={statsCards} />
      </div>
    </MainLayout>
  );
}

