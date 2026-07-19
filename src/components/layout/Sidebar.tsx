'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/login/actions';
import { createClient } from '@/utils/supabase/client';
import { getCurrentProfile } from '@/services/profiles';
import { Profile } from '@/models/types';
import styles from './layout.module.css';

interface Route {
  label: string;
  path?: string;
  icon: string;
  subItems?: { label: string; path: string; icon: string }[];
}

export const Sidebar = () => {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>(['Vendas', 'Minhas indicações', 'Programa de Embaixadores']);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/profile');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.profile) {
            setProfile(data.profile);
          }
        }
      } catch (e) {
        // Silencioso em caso de HMR
      }
    };

    fetchProfile();

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        fetchProfile();
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const getRoutes = () => {
    // Sem perfil confirmado, não renderizar o menu operacional padrão.
    if (!profile) return [];

    if (profile?.role === 'embaixador') {
      return [
        { label: 'Visão geral', path: '/embaixador/dashboard', icon: 'dashboard' },
        { label: 'Meu link', path: '/embaixador/meu-link', icon: 'link' },
        {
          label: 'Minhas indicações',
          icon: 'group_add',
          subItems: [
            { label: 'Clientes indicados', path: '/embaixador/indicacoes', icon: 'person_add' },
            { label: 'Minha Rede', path: '/embaixador/minha-rede', icon: 'account_tree' },
          ],
        },
        { label: 'Minhas vendas', path: '/embaixador/vendas', icon: 'shopping_bag' },
        { label: 'Minhas comissões', path: '/embaixador/comissoes', icon: 'payments' },
        { label: 'Meus pagamentos', path: '/embaixador/pagamentos', icon: 'account_balance_wallet' },
        { label: 'Calculadora de ganhos', path: '/embaixador/calculadora-de-ganhos', icon: 'calculate' },
        { label: 'Materiais', path: '/embaixador/materiais', icon: 'folder_zip' },
        { label: 'Meu perfil', path: '/embaixador/perfil', icon: 'account_circle' },
      ];
    }
    
    const baseRoutes = [
      { label: 'Dashboard', path: '/', icon: 'dashboard' },
      { label: 'Metas', path: '/metas', icon: 'flag' },
      { label: 'CRM/Clientes', path: '/clientes', icon: 'group' },
      { 
        label: 'Vendas', 
        icon: 'shopping_cart',
        subItems: [
          { label: 'Finalizadas', path: '/vendas', icon: 'history' },
          { label: 'Pedidos', path: '/vendas/pedidos', icon: 'assignment' },
          { label: 'Agendamentos', path: '/vendas/agendamentos', icon: 'calendar_month' },
        ]
      },
      { label: 'Produtos', path: '/produtos', icon: 'inventory' },
      { label: 'Estoque', path: '/estoque', icon: 'inventory_2' },
      { label: 'Logística', path: '/logistica', icon: 'local_shipping' },
      { label: 'Rotas', path: '/rotas', icon: 'map' },
      { label: 'Motoristas', path: '/motoristas', icon: 'directions_car' },
      { label: 'Vendedores', path: '/vendedores', icon: 'person_search' },
    ];

    if (profile?.role === 'admin') {
      baseRoutes.push({
        label: 'Programa de Embaixadores',
        icon: 'loyalty',
        subItems: [
          { label: 'Embaixadores', path: '/embaixadores', icon: 'groups' },
          { label: 'Pagamentos', path: '/embaixadores/pagamentos', icon: 'account_balance_wallet' },
          { label: 'Configurações', path: '/embaixadores/configuracoes', icon: 'settings' },
        ],
      });
    }

    baseRoutes.push({ label: 'Perfil', path: '/perfil', icon: 'account_circle' });
    return baseRoutes;
  };

  const routes = getRoutes();

  const isRouteActive = (path: string) => {
    if (path === '/embaixadores') {
      return pathname === path || (
        pathname.startsWith('/embaixadores/') &&
        !pathname.startsWith('/embaixadores/pagamentos') &&
        !pathname.startsWith('/embaixadores/configuracoes')
      );
    }
    return pathname === path;
  };

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => 
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  };

  const roleLabels: Record<string, string> = {
    'admin': 'Administrador',
    'vendedor': 'Vendedor',
    'logistica': 'Logística',
    'embaixador': 'Embaixador'
  };

  return (
    <aside className={styles.sidebar}>
      <div style={{ padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img 
          src="https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/Bryza/New%20Logo%20Bryza.svg" 
          alt="Bryza Logo" 
          style={{ width: '130px', height: 'auto' }}
        />
        <p style={{ 
          margin: '-2px 0 0', 
          fontSize: '9px', 
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
          const isParentActive = r.subItems?.some(sub => isRouteActive(sub.path));
          const isActive = (r.path ? isRouteActive(r.path) : false) || isParentActive;
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
                <div style={{ marginLeft: '12px', borderLeft: '1px solid var(--color-outline-variant)', marginBottom: '4px' }}>
                  {r.subItems!.map(sub => {
                    const isSubActive = isRouteActive(sub.path);
                    return (
                      <Link 
                        key={sub.path} 
                        href={sub.path} 
                        className={`${styles.navItem}`}
                        style={{ 
                          marginLeft: '8px', 
                          padding: '6px 12px',
                          backgroundColor: isSubActive ? 'var(--color-secondary-container)' : 'transparent',
                          color: isSubActive ? 'var(--color-on-secondary-container)' : 'var(--color-on-surface-variant)',
                          marginBottom: '2px'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{sub.icon}</span>
                        <span className={styles.navItemText} style={{ fontSize: '12px' }}>{sub.label}</span>
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
              width: 'calc(100% - 12px)', 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer',
              color: 'var(--color-error, #f44336)',
              marginTop: '4px',
              textAlign: 'left'
            }}
          >
            <span className="material-symbols-outlined">logout</span>
            <span className={styles.navItemText}>Sair</span>
          </button>
        </form>
      </nav>

      <div style={{ padding: '12px 16px' }}>
        <div style={{ padding: '10px 12px', backgroundColor: 'var(--color-surface-container)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person</span>
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.nome || 'Carregando...'}
            </p>
            <p style={{ margin: 0, fontSize: 9, textTransform: 'uppercase', color: 'var(--color-on-surface-variant)' }}>
              {profile ? (roleLabels[profile.role] || profile.role) : '...'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
