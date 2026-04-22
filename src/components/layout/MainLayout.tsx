'use client';

import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { MobileDrawer } from './MobileDrawer';
import styles from './layout.module.css';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className={styles.appContainer}>
      {/* Desktop only — hidden via CSS media query on mobile */}
      <Sidebar />
      <Header />

      <main className={styles.mainContent}>
        {children}
      </main>

      {/* Mobile only — hidden via CSS on desktop */}
      <div className="hide-desktop">
        <BottomNav onMenuOpen={() => setIsDrawerOpen(true)} />
        <MobileDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        />
      </div>
    </div>
  );
};
