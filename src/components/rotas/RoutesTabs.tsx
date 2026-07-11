'use client';

import React from 'react';

export type RoutesTab = 'hoje' | 'planejadas' | 'andamento' | 'finalizadas' | 'pendencias' | 'todas';

interface Props {
  activeTab: RoutesTab;
  onTabChange: (tab: RoutesTab) => void;
  counts: Record<RoutesTab, number>;
}

export default function RoutesTabs({ activeTab, onTabChange, counts }: Props) {
  const tabs: { key: RoutesTab; label: string; icon: string; color?: string }[] = [
    { key: 'todas', label: 'Todas', icon: 'list_alt' },
    { key: 'hoje', label: 'Hoje', icon: 'today', color: '#3b82f6' },
    { key: 'planejadas', label: 'Planejadas', icon: 'pending_actions', color: '#f59e0b' },
    { key: 'andamento', label: 'Em Andamento', icon: 'route', color: '#8b5cf6' },
    { key: 'finalizadas', label: 'Finalizadas', icon: 'task_alt', color: '#10b981' },
    { key: 'pendencias', label: 'Pendências', icon: 'warning', color: '#ef4444' },
  ];

  return (
    <div style={{
      display: 'flex', gap: '4px',
      backgroundColor: 'var(--color-surface-container-low)',
      borderRadius: '12px', padding: '4px',
      marginBottom: '20px', overflowX: 'auto',
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.key;
        const count = counts[tab.key] || 0;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              cursor: 'pointer', fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: '13px',
              whiteSpace: 'nowrap', transition: 'all 0.2s',
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
                color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 800,
                minWidth: '20px', textAlign: 'center',
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
