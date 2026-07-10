'use client';

import React from 'react';
import { Pedido } from '@/models/types';

export type LogisticaTab = 'prontos' | 'em_rota' | 'entregues' | 'problemas' | 'todos';

interface Props {
  activeTab: LogisticaTab;
  onTabChange: (tab: LogisticaTab) => void;
  pedidos: Pedido[];
}

export default function LogisticaTabs({ activeTab, onTabChange, pedidos }: Props) {
  const counts = {
    prontos: pedidos.filter(p => p.status_pedido === 'pronto_para_entrega').length,
    em_rota: pedidos.filter(p => p.status_pedido === 'em_rota').length,
    entregues: pedidos.filter(p => p.status_pedido === 'entregue').length,
    problemas: pedidos.filter(p => p.status_pedido === 'cancelado' || p.delivery_problem_type).length,
    todos: pedidos.length,
  };

  const tabs: { key: LogisticaTab; label: string; icon: string; color?: string }[] = [
    { key: 'todos', label: 'Todos', icon: 'list_alt' },
    { key: 'prontos', label: 'Prontos', icon: 'inventory', color: '#3b82f6' },
    { key: 'em_rota', label: 'Em Rota', icon: 'local_shipping', color: '#8b5cf6' },
    { key: 'entregues', label: 'Entregues', icon: 'check_circle', color: '#10b981' },
    { key: 'problemas', label: 'Problemas', icon: 'report_problem', color: '#ef4444' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      backgroundColor: 'var(--color-surface-container-low)',
      borderRadius: '12px',
      padding: '4px',
      marginBottom: '20px',
      overflowX: 'auto',
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.key;
        const count = counts[tab.key];
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-headline)',
              fontWeight: 700,
              fontSize: '13px',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              backgroundColor: isActive ? 'var(--color-surface)' : 'transparent',
              color: isActive ? (tab.color ?? 'var(--color-primary)') : 'var(--color-on-surface-variant)',
              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '17px', color: isActive ? (tab.color ?? 'var(--color-primary)') : 'var(--color-on-surface-variant)' }}>
              {tab.icon}
            </span>
            {tab.label}
            {count > 0 && (
              <span style={{
                backgroundColor: isActive ? (tab.color ?? 'var(--color-primary)') : 'var(--color-outline)',
                color: '#fff',
                borderRadius: '10px',
                padding: '1px 7px',
                fontSize: '11px',
                fontWeight: 800,
                minWidth: '20px',
                textAlign: 'center',
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
