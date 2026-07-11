'use client';

import React from 'react';
import { DeliveryRoute } from '@/models/types';
import { formatCurrency } from '@/utils/format';

interface Props {
  routes: DeliveryRoute[];
}

export default function RoutesSummaryCards({ routes }: Props) {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const todayStr = todayDate.toISOString().split('T')[0];

  const routesToday = routes.filter(r => r.date === todayStr);
  const emAndamento = routes.filter(r => r.status === 'Em Andamento');
  const prontasSair = routes.filter(r => r.status === 'Pronta para Sair');
  const finalizadasHoje = routesToday.filter(r => r.status.startsWith('Finalizada'));
  const pendencias = routes.filter(r => r.status === 'Finalizada com Pendências');

  const pedidosHoje = routesToday.reduce((acc, r) => acc + (r.totalOrders || 0), 0);
  const valorHoje = routesToday.reduce((acc, r) => acc + (r.totalAmount || 0), 0);

  const cards = [
    {
      label: 'Rotas de Hoje',
      value: routesToday.length,
      icon: 'map',
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.1)',
      sub: `${pedidosHoje} pedidos`
    },
    {
      label: 'Prontas para Sair',
      value: prontasSair.length,
      icon: 'local_shipping',
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
    },
    {
      label: 'Em Andamento',
      value: emAndamento.length,
      icon: 'route',
      color: '#8b5cf6',
      bg: 'rgba(139,92,246,0.1)',
    },
    {
      label: 'Finalizadas Hoje',
      value: finalizadasHoje.length,
      icon: 'task_alt',
      color: '#10b981',
      bg: 'rgba(16,185,129,0.1)',
    },
    {
      label: 'Valor em Rotas (Hoje)',
      value: formatCurrency(valorHoje),
      icon: 'attach_money',
      color: '#0ea5e9',
      bg: 'rgba(14,165,233,0.1)',
    },
    {
      label: 'Pendências',
      value: pendencias.length,
      icon: 'warning',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.1)',
      sub: 'Rotas concluídas com falhas'
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '32px',
    }}>
      {cards.map((card, i) => (
        <div key={i} style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-outline-variant)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex', flexDirection: 'column', gap: '12px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '10px',
            backgroundColor: card.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '22px', color: card.color }}>{card.icon}</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {card.label}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 900, fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {card.value}
            </p>
            {card.sub && (
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>{card.sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
