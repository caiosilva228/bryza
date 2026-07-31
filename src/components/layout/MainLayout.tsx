'use client';

import { type ReactNode, useState } from 'react';
import { CommissionNotificationProvider } from '@/components/notifications/CommissionNotifications';
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
    <CommissionNotificationProvider>
      <div className={styles.appContainer}>
        <Sidebar />
        <Header />

        <main className={styles.mainContent}>
          {children}
        </main>

        <div className="hide-desktop">
          <BottomNav onMenuOpen={() => setIsDrawerOpen(true)} />
          <MobileDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
          />
        </div>
      </div>
    </CommissionNotificationProvider>
  );
};
