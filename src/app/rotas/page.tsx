import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import RotasClientPage from './RotasClientPage';
import { fetchRoutes, fetchAvailableOrdersForRoute } from '@/services/routesService';
import { fetchActiveDrivers } from '@/services/driversService';

export const metadata = {
  title: 'Rotas | BRYZA',
};

export default async function RotasPage() {
  const [routes, availableOrders, drivers] = await Promise.all([
    fetchRoutes(),
    fetchAvailableOrdersForRoute(),
    fetchActiveDrivers(),
  ]);

  return (
    <MainLayout>
      <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: 'var(--color-background)' }}>
        <RotasClientPage 
          initialRoutes={routes} 
          availableOrders={availableOrders} 
          drivers={drivers} 
        />
      </div>
    </MainLayout>
  );
}
