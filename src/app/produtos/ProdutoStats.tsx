'use client';

import React from 'react';
import { MetricCard, MetricColorHint } from '@/components/dashboard/MetricCard';
import { formatCurrency } from '@/utils/format';

interface ProdutoStatsProps {
  stats: {
    total: number;
    ativos: number;
    estoqueBaixo: number;
    valorPotencial: number;
  };
}

export default function ProdutoStats({ stats }: ProdutoStatsProps) {
  const cards: {
    label: string;
    value: string | number;
    suffix: string;
    icon: string;
    colorHint: MetricColorHint;
  }[] = [
    {
      label: 'CATALOGADOS',
      value: stats.total,
      suffix: 'Produtos',
      icon: 'inventory_2',
      colorHint: 'primary',
    },
    {
      label: 'ATIVOS',
      value: stats.ativos,
      suffix: 'Em Operação',
      icon: 'check_circle',
      colorHint: 'secondary',
    },
    {
      label: 'ESTOQUE BAIXO',
      value: stats.estoqueBaixo,
      suffix: stats.estoqueBaixo > 0 ? 'Atenção' : 'Estável',
      icon: 'warning',
      colorHint: stats.estoqueBaixo > 0 ? 'error' : 'success',
    },
    {
      label: 'VALOR POTENCIAL',
      value: formatCurrency(stats.valorPotencial),
      suffix: 'Preço de Venda',
      icon: 'payments',
      colorHint: 'tertiary',
    },
  ];

  return (
    <div className="dashboard-grid-container" style={{ marginBottom: '24px' }}>
      {cards.map((card, index) => (
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
  );
}
