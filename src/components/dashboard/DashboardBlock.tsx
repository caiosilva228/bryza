import React from 'react';

interface DashboardBlockProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  columns?: number;
}

export function DashboardBlock({ title, icon, children, className = '', columns = 4 }: DashboardBlockProps) {
  return (
    <section style={{ marginBottom: '40px' }} className={className}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        {icon && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: 'var(--color-surface-container)',
            borderRadius: '8px',
            width: '32px',
            height: '32px'
          }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', fontSize: '18px' }}>
              {icon}
            </span>
          </div>
        )}
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: 700, 
          color: 'var(--color-on-surface)', 
          letterSpacing: '-0.01em',
          margin: 0
        }}>
          {title}
        </h2>
      </div>
      
      <div className="dashboard-grid-container">
        {children}
      </div>
    </section>
  );
}
