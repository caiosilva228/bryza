'use client';
import type { DriversStats } from '@/services/driversService';
import { formatCurrency } from '@/utils/format';

interface Props {
  stats: DriversStats;
}

const cardBase: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-outline-variant)',
  borderRadius: '16px',
  padding: '20px',
  display: 'flex', flexDirection: 'column', gap: '8px',
};

export default function DriversSummaryCards({ stats }: Props) {
  const cards = [
    {
      label: 'MOTORISTAS ATIVOS',
      value: stats.total_active.toString(),
      icon: 'directions_car',
      color: 'var(--color-primary)',
      bg: 'rgba(0,102,204,0.08)',
    },
    {
      label: 'EM ROTA AGORA',
      value: stats.total_in_route.toString(),
      icon: 'local_shipping',
      color: '#059669',
      bg: '#DCFCE7',
    },
    {
      label: 'VALORES EM ABERTO',
      value: formatCurrency(stats.total_open_amount),
      icon: 'pending_actions',
      color: '#D97706',
      bg: '#FEF3C7',
    },
    {
      label: 'PAGO NO MÊS',
      value: formatCurrency(stats.total_paid_this_month),
      icon: 'payments',
      color: '#7C3AED',
      bg: '#EDE9FE',
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '28px',
    }}>
      {cards.map(c => (
        <div key={c.label} style={cardBase}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            backgroundColor: '#fff', border: '1px solid var(--color-outline-variant)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ color: c.color, fontSize: '22px' }}>{c.icon}</span>
          </div>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</p>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
