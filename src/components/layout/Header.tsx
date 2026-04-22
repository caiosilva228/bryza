'use client';

import styles from './layout.module.css';

export const Header = () => {
  return (
    <header className={styles.header}>
      <div style={{ flex: 1 }}>
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: 'var(--color-surface-container-high)',
          padding: '8px 16px', borderRadius: '24px', width: '320px'
        }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)' }}>search</span>
          <input 
            type="text" 
            placeholder="Buscar clientes, pedidos ou rotas..." 
            style={{ 
              border: 'none', background: 'transparent', width: '100%', 
              outline: 'none', color: 'var(--color-on-surface)',
              fontFamily: 'var(--font-body)', fontSize: '14px'
            }} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button style={{ 
          background: 'none', border: 'none', cursor: 'pointer',
          width: 40, height: 40, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-on-surface-variant)'
        }}>
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </div>
    </header>
  );
};
