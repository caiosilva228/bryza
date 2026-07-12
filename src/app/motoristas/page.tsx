import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import MotoristasClientPage from './MotoristasClientPage';
import { fetchDrivers, fetchDriversStats } from '@/services/driversService';

export const metadata = {
  title: 'Motoristas | BRYZA',
  description: 'Cadastro de motoristas e gestão de remuneração',
};

export default async function MotoristasPage() {
  const [drivers, stats] = await Promise.all([
    fetchDrivers(),
    fetchDriversStats(),
  ]);

  return (
    <MainLayout>
      <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: 'var(--color-background)' }}>
        <MotoristasClientPage
          initialDrivers={drivers}
          initialStats={stats}
        />
      </div>
    </MainLayout>
  );
}
