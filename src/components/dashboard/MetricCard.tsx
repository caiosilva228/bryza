import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  variation?: number;
  icon?: string;
  prefix?: string;
  className?: string;
}

export function MetricCard({ label, value, variation, icon, prefix, className = '' }: MetricCardProps) {
  const isPositive = variation !== undefined && variation > 0;
  const isNegative = variation !== undefined && variation < 0;

  return (
    <div 
      style={{
        backgroundColor: 'var(--color-surface-container-lowest)',
        padding: '24px',
        borderRadius: '20px',
        border: '1px solid var(--color-outline-variant)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        transition: 'all 0.2s ease-in-out',
        ...((className as any)?.style || {})
      }}
      className={className}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <span style={{ 
          color: 'var(--color-on-surface-variant)', 
          fontSize: '12px', 
          fontWeight: 600, 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em' 
        }}>
          {label}
        </span>
        {icon && (
          <span className="material-symbols-outlined" style={{ color: 'var(--color-outline)', fontSize: '20px' }}>
            {icon}
          </span>
        )}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <h3 style={{ 
          fontSize: '28px', 
          margin: 0, 
          fontWeight: 800, 
          color: 'var(--color-on-surface)',
          fontFamily: 'var(--font-headline)'
        }}>
          {prefix && <span style={{ fontSize: '18px', fontWeight: 600, marginRight: '4px', opacity: 0.7 }}>{prefix}</span>}
          {value}
        </h3>
        
        {variation !== undefined && (
          <span style={{ 
            fontSize: '12px', 
            fontWeight: 700, 
            padding: '4px 8px', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center',
            backgroundColor: isPositive ? 'rgba(2, 94, 0, 0.1)' : isNegative ? 'rgba(186, 26, 26, 0.1)' : 'var(--color-surface-container-low)',
            color: isPositive ? 'var(--color-tertiary-container)' : isNegative ? 'var(--color-error)' : 'var(--color-on-surface-variant)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '2px' }}>
              {isPositive ? 'trending_up' : isNegative ? 'trending_down' : 'trending_flat'}
            </span>
            {Math.abs(variation).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
