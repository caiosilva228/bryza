'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/login/actions';
import styles from './layout.module.css';

interface Route {
  label: string;
  path?: string;
  icon: string;
  subItems?: { label: string; path: string; icon: string }[];
}

export const Sidebar = () => {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>(['Vendas']); // Vendas aberto por padrão para facilitar a visualização inicial

  const routes: Route[] = [
    { label: 'Dashboard', path: '/', icon: 'dashboard' },
    { label: 'Metas', path: '/metas', icon: 'flag' },
    { label: 'CRM/Clientes', path: '/clientes', icon: 'group' },
    { 
      label: 'Vendas', 
      icon: 'shopping_cart',
      subItems: [
        { label: 'Finalizadas', path: '/vendas', icon: 'history' },
        { label: 'Pedidos', path: '/vendas/pedidos', icon: 'assignment' },
      ]
    },
    { label: 'Produtos', path: '/produtos', icon: 'inventory' },
    { label: 'Estoque', path: '/estoque', icon: 'inventory_2' },
    { label: 'Logística', path: '/logistica', icon: 'local_shipping' },
    { label: 'Rotas', path: '/rotas', icon: 'map' },
    { label: 'Vendedores', path: '/vendedores', icon: 'person_search' },
    { label: 'Perfil', path: '/perfil', icon: 'account_circle' },
  ];

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => 
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  };

  return (
    <aside className={styles.sidebar}>
      <div style={{ padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img 
          src="https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/Bryza/New%20Logo%20Bryza.svg" 
          alt="Bryza Logo" 
          style={{ width: '180px', height: 'auto' }}
        />
        <p style={{ 
          margin: '-6px 0 0', 
          fontSize: '10px', 
          color: 'var(--color-on-surface-variant)', 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em',
          fontWeight: 500,
          opacity: 0.7
        }}>
          Sistema de Gestão Versão 1.0
        </p>
      </div>
      
      <nav style={{ flex: 1 }}>
        {routes.map(r => {
          const isParentActive = r.subItems?.some(sub => pathname === sub.path);
          const isActive = r.path === pathname || isParentActive;
          const hasSubItems = !!r.subItems;
          const isOpen = openMenus.includes(r.label);

          return (
            <div key={r.label}>
              {hasSubItems ? (
                <div 
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  onClick={() => toggleMenu(r.label)}
                  style={{ cursor: 'pointer', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="material-symbols-outlined">{r.icon}</span>
                    <span className={styles.navItemText}>{r.label}</span>
                  </div>
                  <span className="material-symbols-outlined" style={{ 
                    fontSize: '18px', 
                    transition: 'transform 0.2s',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}>
                    expand_more
                  </span>
                </div>
              ) : (
                <Link href={r.path!} className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                  <span className="material-symbols-outlined">{r.icon}</span>
                  <span className={styles.navItemText}>{r.label}</span>
                </Link>
              )}

              {hasSubItems && isOpen && (
                <div style={{ marginLeft: '16px', borderLeft: '1px solid var(--color-outline-variant)', marginBottom: '8px' }}>
                  {r.subItems!.map(sub => {
                    const isSubActive = pathname === sub.path;
                    return (
                      <Link 
                        key={sub.path} 
                        href={sub.path} 
                        className={`${styles.navItem}`}
                        style={{ 
                          marginLeft: '12px', 
                          padding: '8px 16px',
                          backgroundColor: isSubActive ? 'var(--color-secondary-container)' : 'transparent',
                          color: isSubActive ? 'var(--color-on-secondary-container)' : 'var(--color-on-surface-variant)',
                          marginBottom: '2px'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{sub.icon}</span>
                        <span className={styles.navItemText} style={{ fontSize: '13px' }}>{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        
        <form action={logout}>
          <button 
            type="submit" 
            className={styles.navItem} 
            style={{ 
              width: '100%', 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer',
              color: 'var(--color-error, #f44336)',
              marginTop: '8px'
            }}
          >
            <span className="material-symbols-outlined">logout</span>
            <span className={styles.navItemText}>Sair</span>
          </button>
        </form>
      </nav>

      <div style={{ padding: '24px' }}>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-container)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined">person</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>Usuário Demo</p>
            <p style={{ margin: 0, fontSize: 10, textTransform: 'uppercase', color: 'var(--color-on-surface-variant)' }}>Administrador</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
