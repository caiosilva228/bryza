'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BottomNavProps {
  onMenuOpen: () => void;
}

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: 'dashboard' },
  { label: 'Pedidos', path: '/vendas/pedidos', icon: 'assignment' },
  { label: 'Clientes', path: '/clientes', icon: 'group' },
  { label: 'Estoque', path: '/estoque', icon: 'inventory_2' },
];

export const BottomNav = ({ onMenuOpen }: BottomNavProps) => {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--mobile-bottom-bar-height, 64px)',
        backgroundColor: 'rgba(248, 250, 251, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--color-outline-variant)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            href={item.path}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              textDecoration: 'none',
              color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              position: 'relative',
              transition: 'color 0.15s ease',
              minHeight: '48px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {active && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '32px',
                  height: '3px',
                  backgroundColor: 'var(--color-primary)',
                  borderRadius: '0 0 3px 3px',
                }}
              />
            )}
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '20px',
                fontVariationSettings: active
                  ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20"
                  : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
              }}
            >
              {item.icon}
            </span>
            <span
              style={{
                fontSize: '9px',
                fontWeight: active ? 700 : 500,
                fontFamily: 'var(--font-headline)',
                letterSpacing: '0.01em',
                lineHeight: 1,
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}

      {/* Botão Menu */}
      <button
        onClick={onMenuOpen}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-on-surface-variant)',
          minHeight: '48px',
          WebkitTapHighlightColor: 'transparent',
          transition: 'color 0.15s ease',
          padding: 0,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '20px' }}
        >
          menu
        </span>
        <span
          style={{
            fontSize: '9px',
            fontWeight: 500,
            fontFamily: 'var(--font-headline)',
            lineHeight: 1,
          }}
        >
          Menu
        </span>
      </button>
    </nav>
  );
};
