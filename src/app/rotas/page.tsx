import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import RotasClientPage from './RotasClientPage';
import { fetchRoutes, fetchAvailableOrdersForRoute } from '@/services/routesService';
import { createClient } from '@/utils/supabase/server';
import { Driver } from '@/models/types';

export const metadata = {
  title: 'Rotas | BRYZA',
};

export default async function RotasPage() {
  const [routes, availableOrders, driversRes] = await Promise.all([
    fetchRoutes(),
    fetchAvailableOrdersForRoute(),
    (await createClient()).from('profiles').select('id, nome').eq('ativo', true)
  ]);

  const drivers = driversRes.data as Driver[] || [];

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
