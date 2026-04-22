import React from 'react';
import { PedidoStats as PedidoStatsType } from '@/models/types';

interface Props {
  stats: PedidoStatsType;
}

export default function PedidoStats({ stats }: Props) {
  const cards = [
    {
      label: 'Fila Técnica',
      title: 'EM PREPARAÇÃO',
      value: stats.preparacao,
      icon: 'schedule',
      color: 'var(--color-primary)'
    },
    {
      label: 'Logística Ativa',
      title: 'EM ROTA',
      value: stats.rota,
      icon: 'local_shipping',
      color: 'var(--color-secondary)'
    },
    {
      label: 'Concluído Hoje',
      title: 'ENTREGUES',
      value: stats.entregues,
      icon: 'check_circle',
      color: 'var(--color-tertiary)'
    },
    {
      label: 'Arquivo',
      title: 'FINALIZADOS',
      value: stats.finalizados,
      icon: 'inventory_2',
      color: 'var(--color-outline)'
    },
    {
      label: 'Volume Total',
      title: 'TOTAL GERAL',
      value: stats.total,
      icon: 'layers',
      color: 'var(--color-primary)'
    }
  ];

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
      gap: '20px',
      marginBottom: '32px'
    }}>
      {cards.map((card, idx) => (
        <div 
          key={idx} 
          style={{
            backgroundColor: 'var(--color-surface)',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid var(--color-outline-variant)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: `${card.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span className="material-symbols-outlined" style={{ color: card.color, fontSize: '20px' }}>{card.icon}</span>
            </div>
            <span style={{
              fontSize: '9px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '4px 8px',
              borderRadius: '6px',
              backgroundColor: `${card.color}15`,
              color: card.color
            }}>
              {card.label}
            </span>
          </div>
          
          <div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-outline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.title}</p>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '28px', fontWeight: 900, color: 'var(--color-on-surface)', letterSpacing: '-0.02em' }}>{card.value}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}
