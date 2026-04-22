import React, { Suspense } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import PedidoClientPage from './components/PedidoClientPage';
import { getClientes } from '@/services/clientes';
import { getProdutos } from '@/services/produtos';
import { getVendedores } from '@/services/profiles';
import { getPedidos, getPedidosStats } from './actions';

export const metadata = {
  title: 'Pedidos - Bryza',
  description: 'Gerenciamento operacional de pedidos e reservas de estoque.',
};

export default async function PedidosPage() {
  // Busca inicial de dados em paralelo no servidor
  const [pedidos, stats, clientes, produtos, vendedores] = await Promise.all([
    getPedidos(),
    getPedidosStats(),
    getClientes(),
    getProdutos(),
    getVendedores(),
  ]);

  return (
    <MainLayout>
      <div style={{ padding: '32px' }}>
        <Suspense fallback={<div style={{ height: '400px', backgroundColor: 'var(--color-surface-container)', borderRadius: '24px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />}>
          <PedidoClientPage 
            initialPedidos={pedidos} 
            initialStats={stats}
            clientes={clientes}
            produtos={produtos}
            vendedores={vendedores}
          />
        </Suspense>
      </div>
    </MainLayout>
  );
}
