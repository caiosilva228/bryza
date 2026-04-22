import React from 'react';

interface DashboardBlockProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  columns?: number;
}

export function DashboardBlock({ title, icon, children, className = '', columns = 4 }: DashboardBlockProps) {
  // Lógica de grid nativa via inline styles
  const getGridStyle = () => {
    return {
      display: 'grid',
      gap: '16px',
      gridTemplateColumns: `repeat(auto-fit, minmax(${columns >= 4 ? '240px' : '300px'}, 1fr))`
    };
  };

  return (
    <section style={{ marginBottom: '32px' }} className={className}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        {icon && (
          <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface)', fontWeight: 'bold' }}>
            {icon}
          </span>
        )}
        <h2 style={{ 
          fontSize: '14px', 
          fontWeight: 800, 
          color: 'var(--color-on-surface-variant)', 
          textTransform: 'uppercase', 
          letterSpacing: '0.1em',
          margin: 0
        }}>
          {title}
        </h2>
      </div>
      
      <div style={getGridStyle()}>
        {children}
      </div>
    </section>
  );
}
