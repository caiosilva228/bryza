import React from 'react';

export type MetricColorHint = 'primary' | 'secondary' | 'tertiary' | 'error' | 'success' | 'warning' | 'default';

interface MetricCardProps {
  label: string;
  value: string | number;
  variation?: number;
  icon?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  colorHint?: MetricColorHint;
}

export function MetricCard({ label, value, variation, icon, prefix, suffix, className = '', colorHint = 'default' }: MetricCardProps) {
  const isPositive = variation !== undefined && variation > 0;
  const isNegative = variation !== undefined && variation < 0;

  // Map color hints to specific CSS variables
  const colorMap: Record<MetricColorHint, { main: string, bg: string }> = {
    primary: { main: 'var(--color-primary)', bg: 'var(--color-primary-container)' },
    secondary: { main: 'var(--color-secondary)', bg: 'var(--color-secondary-container)' },
    tertiary: { main: 'var(--color-tertiary)', bg: 'var(--color-tertiary-container)' },
    error: { main: 'var(--color-error)', bg: 'var(--color-error-container)' },
    success: { main: '#025e00', bg: 'rgba(2, 94, 0, 0.1)' },
    warning: { main: '#a47200', bg: 'rgba(164, 114, 0, 0.1)' },
    default: { main: 'var(--color-on-surface-variant)', bg: 'var(--color-surface-container)' }
  };

  const hint = colorMap[colorHint];

  return (
    <div className={`metric-card ${className}`}>
      {/* Top Accent Line based on colorHint */}
      {colorHint !== 'default' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: hint.main, opacity: 0.8 }} />
      )}

      <div className="content-group">
        <div className="label-group">
          {icon && (
            <span className="material-symbols-outlined" style={{ color: hint.main, fontSize: '16px' }}>
              {icon}
            </span>
          )}
          <span style={{ fontSize: '11px', fontWeight: 800, color: hint.main, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
          </span>
        </div>
        
        <div className="value-row">
          {prefix && <span className="prefix-text" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>{prefix}</span>}
          <span className="value-text" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-on-surface)', lineHeight: 1 }}>
            {value}
          </span>
          {suffix && <span className="suffix-text" style={{ fontSize: '11px', color: 'var(--color-outline)', marginLeft: '4px' }}>{suffix}</span>}
        </div>
      </div>
      
      {variation !== undefined && (
        <span className="variation-badge" style={{ 
          fontSize: '11px', 
          fontWeight: 700, 
          padding: '4px 6px', 
          borderRadius: '6px', 
          display: 'flex', 
          alignItems: 'center',
          backgroundColor: isPositive ? 'rgba(2, 94, 0, 0.1)' : isNegative ? 'rgba(186, 26, 26, 0.1)' : 'var(--color-surface-container-low)',
          color: isPositive ? '#025e00' : isNegative ? 'var(--color-error)' : 'var(--color-on-surface-variant)',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '2px' }}>
            {isPositive ? 'trending_up' : isNegative ? 'trending_down' : 'trending_flat'}
          </span>
          {Math.abs(variation).toFixed(1)}%
        </span>
      )}
    </div>
  );
}

