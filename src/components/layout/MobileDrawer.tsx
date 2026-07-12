'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/login/actions';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Route {
  label: string;
  path?: string;
  icon: string;
  subItems?: { label: string; path: string; icon: string }[];
}

const DRAWER_ROUTES: Route[] = [
  { label: 'Dashboard', path: '/', icon: 'dashboard' },
  { label: 'Metas', path: '/metas', icon: 'flag' },
  { label: 'CRM / Clientes', path: '/clientes', icon: 'group' },
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
  { label: 'Perfil', path: '/perfil', icon: 'account_circle' },
];

export const MobileDrawer = ({ isOpen, onClose }: MobileDrawerProps) => {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>(['Vendas']);

  // Fechar ao pressionar Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Travar scroll do body quando drawer está aberto
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => 
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 200,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Drawer */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '280px',
          backgroundColor: 'var(--color-surface-container-low)',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowY: 'auto',
          boxShadow: isOpen ? '4px 0 24px rgba(0,0,0,0.15)' : 'none',
        }}
      >
        {/* Header do Drawer */}
        <div
          style={{
            padding: '24px 20px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--color-outline-variant)',
          }}
        >
          <img
            src="https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/Bryza/New%20Logo%20Bryza.svg"
            alt="Bryza Logo"
            style={{ width: '120px', height: 'auto' }}
          />
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-on-surface-variant)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {DRAWER_ROUTES.map((route) => {
            const isParentActive = route.subItems?.some(sub => pathname === sub.path);
            const active = route.path === pathname || isParentActive;
            const hasSubItems = !!route.subItems;
            const isOpenMenu = openMenus.includes(route.label);

            return (
              <div key={route.label}>
                {hasSubItems ? (
                  <div
                    onClick={() => toggleMenu(route.label)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 20px',
                      margin: '2px 8px',
                      borderRadius: '12px',
                      color: active ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
                      backgroundColor: active ? 'var(--color-primary-container)' : 'transparent',
                      fontWeight: active ? 700 : 500,
                      fontSize: '15px',
                      fontFamily: 'var(--font-headline)',
                      cursor: 'pointer',
                      minHeight: '48px',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{route.icon}</span>
                      <span>{route.label}</span>
                    </div>
                    <span className="material-symbols-outlined" style={{
                      fontSize: '20px',
                      transition: 'transform 0.2s',
                      transform: isOpenMenu ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}>
                      expand_more
                    </span>
                  </div>
                ) : (
                  <Link
                    href={route.path!}
                    onClick={onClose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '14px 20px',
                      margin: '2px 8px',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      color: active ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
                      backgroundColor: active ? 'var(--color-primary-container)' : 'transparent',
                      fontWeight: active ? 700 : 500,
                      fontSize: '15px',
                      fontFamily: 'var(--font-headline)',
                      transition: 'background-color 0.15s ease',
                      WebkitTapHighlightColor: 'transparent',
                      minHeight: '48px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{route.icon}</span>
                    {route.label}
                  </Link>
                )}

                {hasSubItems && isOpenMenu && (
                  <div style={{ marginLeft: '24px', borderLeft: '1px solid var(--color-outline-variant)', marginBottom: '8px' }}>
                    {route.subItems!.map(sub => {
                      const isSubActive = pathname === sub.path;
                      return (
                        <Link
                          key={sub.path}
                          href={sub.path}
                          onClick={onClose}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 16px',
                            marginLeft: '12px',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            backgroundColor: isSubActive ? 'var(--color-secondary-container)' : 'transparent',
                            color: isSubActive ? 'var(--color-on-secondary-container)' : 'var(--color-on-surface-variant)',
                            fontWeight: isSubActive ? 700 : 500,
                            fontSize: '13px',
                            fontFamily: 'var(--font-headline)',
                            transition: 'background-color 0.15s ease',
                            WebkitTapHighlightColor: 'transparent',
                            minHeight: '36px',
                            marginBottom: '2px'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{sub.icon}</span>
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Rodapé — Logout */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid var(--color-outline-variant)',
          }}
        >
          <form action={logout}>
            <button
              type="submit"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 20px',
                borderRadius: '12px',
                background: 'transparent',
                border: '1px solid rgba(186, 26, 26, 0.2)',
                cursor: 'pointer',
                color: 'var(--color-error, #ba1a1a)',
                fontWeight: 700,
                fontSize: '14px',
                fontFamily: 'var(--font-headline)',
                minHeight: '48px',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                logout
              </span>
              Sair do sistema
            </button>
          </form>
        </div>
      </aside>
    </>
  );
};
