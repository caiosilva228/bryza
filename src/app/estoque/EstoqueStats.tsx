'use client';

import React from 'react';
import { MetricCard, MetricColorHint } from '@/components/dashboard/MetricCard';
import { formatCurrency } from '@/utils/format';

interface EstoqueStatsProps {
  stats: {
    totalProdutos: number;
    totalUnidades: number;
    estoqueBaixo: number;
    valorTotal: number;
  };
}

export const EstoqueStats = ({ stats }: EstoqueStatsProps) => {
  const cards: {
    label: string;
    value: string | number;
    suffix: string;
    icon: string;
    colorHint: MetricColorHint;
  }[] = [
    {
      label: 'PRODUTOS',
      value: stats.totalProdutos,
      icon: 'inventory_2',
      suffix: 'Cadastrados',
      colorHint: 'primary'
    },
    {
      label: 'UNIDADES',
      value: stats.totalUnidades,
      icon: 'database',
      suffix: 'Em Estoque',
      colorHint: 'secondary'
    },
    {
      label: 'ESTOQUE BAIXO',
      value: stats.estoqueBaixo,
      icon: 'warning',
      suffix: stats.estoqueBaixo > 0 ? 'Requer Atenção' : 'Sob Controle',
      colorHint: stats.estoqueBaixo > 0 ? 'error' : 'success'
    },
    {
      label: 'VALOR TOTAL',
      value: formatCurrency(stats.valorTotal),
      icon: 'payments',
      suffix: 'Custo',
      colorHint: 'tertiary'
    }
  ];

  return (
    <div className="dashboard-grid-container" style={{ marginBottom: '32px' }}>
      {cards.map((card, i) => (
        <MetricCard
          key={i}
          label={card.label}
          value={card.value}
          suffix={card.suffix}
          icon={card.icon}
          colorHint={card.colorHint}
        />
      ))}
    </div>
  );
};
