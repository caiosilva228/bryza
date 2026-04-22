'use client';

import React from 'react';

interface EstoqueStatsProps {
  stats: {
    totalProdutos: number;
    totalUnidades: number;
    estoqueBaixo: number;
    valorTotal: number;
  };
}

export const EstoqueStats = ({ stats }: EstoqueStatsProps) => {
  const cards = [
    {
      label: 'Produtos Cadastrados',
      value: stats.totalProdutos,
      icon: 'inventory_2',
      color: 'var(--color-primary)'
    },
    {
      label: 'Total em Estoque',
      value: stats.totalUnidades,
      icon: 'database',
      color: 'var(--color-secondary)'
    },
    {
      label: 'Estoque Baixo',
      value: stats.estoqueBaixo,
      icon: 'warning',
      color: 'var(--color-error)',
      alert: stats.estoqueBaixo > 0
    },
    {
      label: 'Valor Total (Custo)',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.valorTotal),
      icon: 'payments',
      color: 'var(--color-tertiary)'
    }
  ];

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
      gap: '20px',
      marginBottom: '32px'
    }}>
      {cards.map((card, i) => (
        <div key={i} 
          style={{
            backgroundColor: 'var(--color-surface)',
            padding: '24px',
            borderRadius: '16px',
            border: card.alert ? `2px solid var(--color-error)` : '1px solid var(--color-outline-variant)',
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
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: `${card.color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span className="material-symbols-outlined" style={{ color: card.color, fontSize: '24px' }}>{card.icon}</span>
          </div>
          
          <div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-outline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</p>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '26px', fontWeight: 900, color: 'var(--color-on-surface)', letterSpacing: '-0.02em' }}>{card.value}</h3>
          </div>

          {card.alert && (
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-error)',
              boxShadow: '0 0 10px var(--color-error)'
            }} />
          )}
        </div>
      ))}
    </div>
  );
};
