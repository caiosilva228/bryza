import React from 'react';
import { PedidoStats as PedidoStatsType } from '@/models/types';
import { MetricCard, MetricColorHint } from '@/components/dashboard/MetricCard';

interface Props {
  stats: PedidoStatsType;
}

export default function PedidoStats({ stats }: Props) {
  const cards: {
    label: string;
    title: string;
    value: number;
    icon: string;
    colorHint: MetricColorHint;
  }[] = [
    {
      label: 'Fila Técnica',
      title: 'EM PREPARAÇÃO',
      value: stats.preparacao,
      icon: 'schedule',
      colorHint: 'primary'
    },
    {
      label: 'Logística Ativa',
      title: 'EM ROTA',
      value: stats.rota,
      icon: 'local_shipping',
      colorHint: 'secondary'
    },
    {
      label: 'Concluído Hoje',
      title: 'ENTREGUES',
      value: stats.entregues,
      icon: 'check_circle',
      colorHint: 'tertiary'
    },
    {
      label: 'Arquivo',
      title: 'FINALIZADOS',
      value: stats.finalizados,
      icon: 'inventory_2',
      colorHint: 'default'
    },
    {
      label: 'Volume Total',
      title: 'TOTAL GERAL',
      value: stats.total,
      icon: 'layers',
      colorHint: 'primary'
    }
  ];

  return (
    <div className="dashboard-grid-container">
      {cards.map((card, idx) => (
        <MetricCard
          key={idx}
          label={card.title}
          value={card.value}
          suffix={card.label}
          icon={card.icon}
          colorHint={card.colorHint}
        />
      ))}
    </div>
  );
}

