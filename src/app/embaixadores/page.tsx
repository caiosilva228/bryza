'use client';

import { useState, useEffect, useTransition } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import Link from 'next/link';
import EmbaixadoresFilter from './EmbaixadoresFilter';
import EmbaixadoresTable from './EmbaixadoresTable';
import { getEmbaixadoresPaginados } from './actions';

export default function EmbaixadoresPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);
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
          endDate: filters.endDate ? new Date(filters.endDate).toISOString() : undefined
        });
        setItems(result.items);
        setTotal(result.total);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [offset, filters]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setOffset(0); // Reiniciar paginação ao filtrar
  };

  const handlePageChange = (direction: 'next' | 'prev') => {
    if (direction === 'next' && offset + limit < total) {
      setOffset(prev => prev + limit);
    } else if (direction === 'prev' && offset - limit >= 0) {
      setOffset(prev => prev - limit);
    }
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <MainLayout>
      <div className="page-wrapper">
        <div className="page-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div>
            <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700 }}>
              Programa de Embaixadores
            </h1>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
              Gerencie os embaixadores da marca, atribuição de vendas e saques de comissões.
            </p>
          </div>
          <div>
            <Link href="/embaixadores/novo" className="btn-primary" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '14px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
              Novo Embaixador
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <EmbaixadoresFilter onFilterChange={handleFilterChange} />

        {/* Tabela de Resultados */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          border: '1px solid var(--color-outline-variant)',
          overflow: 'hidden',
          minHeight: '300px',
          opacity: isPending ? 0.6 : 1,
          transition: 'opacity 0.2s ease',
          position: 'relative'
        }}>
          {items.length === 0 ? (
            <div style={{
              padding: '80px 32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--color-surface-container-low)'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-surface-container-high)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-outline-variant)' }}>person_off</span>
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '8px' }}>Nenhum embaixador encontrado</h3>
              <p style={{ color: 'var(--color-on-surface-variant)', maxWidth: '400px', margin: '0 auto', fontSize: '14px' }}>
                Não encontramos embaixadores correspondentes aos filtros de busca aplicados.
              </p>
            </div>
          ) : (
            <>
              <EmbaixadoresTable lista={items} onRefresh={loadData} />
              
              {/* Controles de Paginação */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                backgroundColor: 'var(--color-surface-container-low)',
                borderTop: '1px solid var(--color-outline-variant)'
              }}>
                <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                  Página {currentPage} de {totalPages} (Total: {total} embaixadores)
                </span>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => handlePageChange('prev')}
                    disabled={offset === 0 || isPending}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-outline)',
                      background: 'transparent',
                      color: 'var(--color-on-surface)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: offset === 0 ? 0.5 : 1
                    }}
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => handlePageChange('next')}
                    disabled={offset + limit >= total || isPending}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-outline)',
                      background: 'transparent',
                      color: 'var(--color-on-surface)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: offset + limit >= total ? 0.5 : 1
                    }}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
