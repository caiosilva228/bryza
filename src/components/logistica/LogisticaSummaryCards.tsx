'use client';

import React from 'react';
import { Pedido } from '@/models/types';
import { formatCurrency } from '@/utils/format';

interface Props {
  pedidos: Pedido[];
}

interface CardConfig {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  bg: string;
  sub?: string;
}

export default function LogisticaSummaryCards({ pedidos }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prontos = pedidos.filter(p => p.status_pedido === 'pronto_para_entrega');
  const emRota = pedidos.filter(p => p.status_pedido === 'em_rota');
  const entregues = pedidos.filter(p => p.status_pedido === 'entregue');
  const cancelados = pedidos.filter(p => p.status_pedido === 'cancelado');
  const comProblema = pedidos.filter(p => p.delivery_problem_type);

  const finalizadosHoje = pedidos.filter(p => {
    if (p.status_pedido !== 'finalizado') return false;
    const ref = p.finalized_at ?? p.updated_at;
    return ref ? new Date(ref) >= today : false;
  });

  const valorEmRota = emRota.reduce((acc, p) => acc + (p.valor_total ?? 0), 0);
  const valorAguardandoConf = entregues.reduce((acc, p) => acc + (p.valor_total ?? 0), 0);
  const valorFinalizadoHoje = finalizadosHoje.reduce((acc, p) => acc + (p.valor_total ?? 0), 0);

  const cards: CardConfig[] = [
    {
      label: 'Prontos para Entrega',
      value: prontos.length,
      icon: 'inventory',
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.10)',
      sub: 'Aguardando saída',
    },
    {
      label: 'Em Rota',
      value: emRota.length,
      icon: 'local_shipping',
      color: '#8b5cf6',
      bg: 'rgba(139,92,246,0.10)',
      sub: formatCurrency(valorEmRota) + ' em trânsito',
    },
    {
      label: 'Aguardando Conferência',
      value: entregues.length,
      icon: 'pending_actions',
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.10)',
      sub: formatCurrency(valorAguardandoConf),
    },
    {
      label: 'Finalizados Hoje',
      value: finalizadosHoje.length,
      icon: 'task_alt',
      color: '#047857',
      bg: 'rgba(4,120,87,0.10)',
      sub: formatCurrency(valorFinalizadoHoje),
    },
    {
      label: 'Cancelados / Problemas',
      value: cancelados.length + comProblema.filter(p => p.status_pedido !== 'cancelado').length,
      icon: 'report_problem',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.10)',
      sub: `${cancelados.length} cancelados`,
    },
    {
      label: 'Valor em Rota',
      value: formatCurrency(valorEmRota),
      icon: 'currency_exchange',
      color: '#8b5cf6',
      bg: 'rgba(139,92,246,0.10)',
      sub: `${emRota.length} pedidos`,
    },
    {
      label: 'Valor para Conferir',
      value: formatCurrency(valorAguardandoConf),
      icon: 'receipt_long',
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.10)',
      sub: `${entregues.length} pedidos`,
    },
    {
      label: 'Valor Finalizado Hoje',
      value: formatCurrency(valorFinalizadoHoje),
      icon: 'attach_money',
      color: '#047857',
      bg: 'rgba(4,120,87,0.10)',
      sub: `${finalizadosHoje.length} pedidos`,
    },
  ];

  return (
    <div className="summary-cards-grid">
      {cards.map((card, i) => (
        <div key={i} className="summary-card">
          <div className="summary-card-icon-wrapper" style={{ backgroundColor: card.bg }}>
            <span className="material-symbols-outlined" style={{ color: card.color }}>{card.icon}</span>
          </div>
          <div className="summary-card-content">
            <p className="summary-card-label">
              {card.label}
            </p>
            <p className="summary-card-value">
              {card.value}
            </p>
            {card.sub && (
              <p className="summary-card-sub">{card.sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
