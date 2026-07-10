import React, { Suspense } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import LogisticaClientPage from './LogisticaClientPage';
import { getPedidosLogistica } from './actions';

export const revalidate = 0;

export const metadata = {
  title: 'Logística - Bryza',
  description: 'Central operacional de entregas, conferência de pagamentos e acompanhamento de pedidos em rota.',
};

function SkeletonCard() {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface-container)',
      borderRadius: '16px',
      height: '100px',
      animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
    }} />
  );
}

function LogisticaSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div style={{ backgroundColor: 'var(--color-surface-container)', borderRadius: '16px', height: '100px', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
      <div style={{ backgroundColor: 'var(--color-surface-container)', borderRadius: '16px', height: '400px', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

async function LogisticaData() {
  let pedidos;
  try {
    pedidos = await getPedidosLogistica();
  } catch {
    return (
      <div style={{
        padding: '64px 32px',
        textAlign: 'center',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '16px',
        border: '1px solid var(--color-outline-variant)',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-error)', display: 'block', marginBottom: '16px' }}>
          error
        </span>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-headline)' }}>Não foi possível carregar os pedidos da logística.</h3>
        <p style={{ margin: '8px 0 0', color: 'var(--color-on-surface-variant)' }}>Verifique sua conexão e tente recarregar a página.</p>
      </div>
    );
  }

  return <LogisticaClientPage initialPedidos={pedidos} />;
}

export default function LogisticaPage() {
  return (
    <MainLayout>
      <div className="page-wrapper">
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 800,
              fontFamily: 'var(--font-headline)',
              margin: 0,
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>local_shipping</span>
              Logística
            </h1>
            <p style={{
              margin: '6px 0 0',
              fontSize: '14px',
              color: 'var(--color-on-surface-variant)',
              fontFamily: 'var(--font-body)',
            }}>
              Controle de entregas, conferência de pagamentos e acompanhamento dos pedidos em rota.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Rota — Em breve */}
            <button
              disabled
              title="Em breve: criação de rotas"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '11px 18px', borderRadius: '12px',
                border: '1px dashed var(--color-outline-variant)',
                backgroundColor: 'transparent',
                color: 'var(--color-outline)',
                fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: '14px',
                cursor: 'not-allowed', opacity: 0.7,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>map</span>
              Rotas — Em breve
            </button>

            <a
              href="/vendas/pedidos"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '11px 20px', borderRadius: '12px',
                backgroundColor: 'var(--color-primary)', color: '#fff',
                textDecoration: 'none',
                fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: '14px',
                boxShadow: '0 4px 12px rgba(0,86,117,0.25)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>receipt_long</span>
              Ver Pedidos
            </a>
          </div>
        </div>

        {/* Conteúdo assíncrono */}
        <Suspense fallback={<LogisticaSkeleton />}>
          <LogisticaData />
        </Suspense>
      </div>
    </MainLayout>
  );
}
