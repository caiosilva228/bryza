'use client';

import { useState, useEffect, useTransition } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import Link from 'next/link';
import EmbaixadoresFilter from './EmbaixadoresFilter';
import EmbaixadoresTable from './EmbaixadoresTable';
import ClientesIndicadosTab from './ClientesIndicadosTab';
import Pagination from '@/components/ui/Pagination';
import { getEmbaixadoresPaginados } from './actions';

type ActiveTab = 'embaixadores' | 'clientes_indicados';

export default function EmbaixadoresPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('embaixadores');
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  const [filters, setFilters] = useState({
    search: '',
    cpf: '',
    city: '',
    status: '',
    planId: '',
    startDate: '',
    endDate: ''
  });
  const [isPending, startTransition] = useTransition();

  const offset = (page - 1) * limit;

  const loadData = () => {
    startTransition(async () => {
      try {
        const result = await getEmbaixadoresPaginados({
          limit,
          offset,
          search: filters.search,
          cpf: filters.cpf,
          city: filters.city,
          status: filters.status,
          planId: filters.planId,
          startDate: filters.startDate ? new Date(filters.startDate).toISOString() : undefined,
          endDate: filters.endDate ? new Date(filters.endDate).toISOString() : undefined,
          sortBy: sortBy || undefined,
          sortOrder: sortOrder || undefined,
        });
        setItems(result.items);
        setTotal(result.total);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      }
    });
  };

  useEffect(() => {
    if (activeTab === 'embaixadores') loadData();
  }, [page, limit, filters, sortBy, sortOrder, activeTab]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1);
  };

  // 3-Click Sort Handler
  const handleSort = (key: string) => {
    if (sortBy !== key) {
      // 1º Clique: Maior para Menor (DESC)
      setSortBy(key);
      setSortOrder('desc');
    } else if (sortOrder === 'desc') {
      // 2º Clique: Menor para Maior (ASC)
      setSortOrder('asc');
    } else {
      // 3º Clique: Zera o filtro de ordenação
      setSortBy(null);
      setSortOrder(null);
    }
    setPage(1);
  };

  const tabStyle = (isActive: boolean) => ({
    padding: '12px 22px',
    background: 'none',
    border: 'none',
    borderBottom: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
    color: isActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
    fontWeight: isActive ? 700 : 500,
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'color 0.15s ease',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <MainLayout>
      <div className="page-wrapper">
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700 }}>
              Programa de Embaixadores
            </h1>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
              Gerencie os embaixadores da marca, atribuição de vendas e saques de comissões.
            </p>
          </div>
          <div>
            <Link href="/embaixadores/novo" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
              Novo Embaixador
            </Link>
          </div>
        </div>

        {/* Sistema de Abas */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-outline-variant)', marginBottom: '24px', gap: '4px' }}>
          <button onClick={() => setActiveTab('embaixadores')} style={tabStyle(activeTab === 'embaixadores')}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>group</span>
            Embaixadores
            {activeTab === 'embaixadores' && total > 0 && (
              <span style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                {total}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('clientes_indicados')} style={tabStyle(activeTab === 'clientes_indicados')}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            Clientes Indicados
          </button>
        </div>

        {/* Aba: Embaixadores */}
        {activeTab === 'embaixadores' && (
          <>
            <EmbaixadoresFilter onFilterChange={handleFilterChange} />
            <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-outline-variant)', overflow: 'hidden', minHeight: '300px', opacity: isPending ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
              {items.length === 0 ? (
                <div style={{ padding: '80px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-surface-container-low)' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--color-surface-container-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-outline-variant)' }}>person_off</span>
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '8px' }}>Nenhum embaixador encontrado</h3>
                  <p style={{ color: 'var(--color-on-surface-variant)', maxWidth: '400px', margin: '0 auto', fontSize: '14px' }}>
                    Não encontramos embaixadores correspondentes aos filtros de busca aplicados.
                  </p>
                </div>
              ) : (
                <>
                  <EmbaixadoresTable
                    lista={items}
                    onRefresh={loadData}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                  <Pagination
                    total={total}
                    page={page}
                    pageSize={limit}
                    onPageChange={(p) => setPage(p)}
                    onPageSizeChange={(s) => {
                      setLimit(s);
                      setPage(1);
                    }}
                    pageSizeOptions={[10, 20, 30, 50, 100]}
                  />
                </>
              )}
            </div>
          </>
        )}

        {/* Aba: Clientes Indicados */}
        {activeTab === 'clientes_indicados' && <ClientesIndicadosTab />}
      </div>
    </MainLayout>
  );
}
