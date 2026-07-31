'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getMinhasComissoes } from '../actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';

export default function ComissoesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [sortOrder, setSortOrder] = useState<'recentes' | 'antigas' | 'maior_valor' | 'menor_valor'>('recentes');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMinhasComissoes({ page, limit: pageSize, status: statusFilter });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar comissões.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtros locais e ordenação
  const processedItems = useMemo(() => {
    let result = [...items];

    // Busca por código do pedido
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) =>
        String(item.order_code || '').toLowerCase().includes(q)
      );
    }

    // Filtro por tipo
    if (typeFilter !== 'todos') {
      if (typeFilter === 'bonus') {
        result = result.filter((item) => item.commission_type === 'first_purchase_bonus');
      } else if (typeFilter === 'rede') {
        result = result.filter((item) => item.commission_type !== 'first_purchase_bonus');
      }
    }

    // Ordenação
    result.sort((a, b) => {
      if (sortOrder === 'recentes') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOrder === 'antigas') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortOrder === 'maior_valor') {
        return Number(b.commission_amount || 0) - Number(a.commission_amount || 0);
      }
      if (sortOrder === 'menor_valor') {
        return Number(a.commission_amount || 0) - Number(b.commission_amount || 0);
      }
      return 0;
    });

    return result;
  }, [items, searchQuery, typeFilter, sortOrder]);

  // Totalizador das comissões visíveis na página
  const pageTotalCommission = useMemo(() => {
    return processedItems.reduce((acc, item) => acc + Number(item.commission_amount || 0), 0);
  }, [processedItems]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <MainLayout>
      <div style={{ maxWidth: '1180px', margin: '0 auto 40px' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700, margin: 0 }}>
            Minhas Comissões
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
            Extrato detalhado e organizado de todas as suas comissões por vendas indicadas.
          </p>
        </header>

        <div style={{
          backgroundColor: 'var(--color-surface-container-low)',
          padding: '24px',
          borderRadius: '20px',
          border: '1px solid var(--color-outline-variant)'
        }}>
          {/* Barra de Filtros e Controles */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--color-outline-variant)'
          }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: '1 1 300px' }}>
              {/* Busca por Pedido */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--color-surface-container-high)',
                border: '1px solid var(--color-outline-variant)',
                padding: '8px 14px',
                borderRadius: '12px',
                minWidth: '200px',
                flex: 1
              }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', fontSize: '18px' }}>search</span>
                <input
                  type="text"
                  placeholder="Buscar por código de pedido..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    color: 'var(--color-on-surface)',
                    fontSize: '14px',
                    width: '100%'
                  }}
                />
              </div>

              {/* Filtro Status da Comissão */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                style={{
                  padding: '9px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface-container-high)',
                  color: 'var(--color-on-surface)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="">Todos os status</option>
                <option value="liberada">Liberada</option>
                <option value="paga">Paga</option>
                <option value="aguardando_entrega">Aguardando Entrega</option>
                <option value="cancelada">Cancelada</option>
              </select>

              {/* Filtro Tipo de Comissão */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface-container-high)',
                  color: 'var(--color-on-surface)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="todos">Todos os Tipos</option>
                <option value="rede">🔗 Comissão de Rede</option>
                <option value="bonus">🏆 Bônus 1ª Compra</option>
              </select>

              {/* Ordenação */}
              <select
                value={sortOrder}
                onChange={(e: any) => setSortOrder(e.target.value)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface-container-high)',
                  color: 'var(--color-on-surface)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="recentes">Mais recentes</option>
                <option value="antigas">Mais antigas</option>
                <option value="maior_valor">Maior comissão</option>
                <option value="menor_valor">Menor comissão</option>
              </select>
            </div>

            {/* Seletor de Itens por Página */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
              <span>Exibir:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface-container-high)',
                  color: 'var(--color-on-surface)',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                <option value={10}>10 por página</option>
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>
          </div>

          {/* Banner Totalizador Filtrado */}
          {!loading && processedItems.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--color-primary-container, #e0f2fe)',
              padding: '12px 18px',
              borderRadius: '12px',
              marginBottom: '16px',
              color: 'var(--color-on-primary-container, #0369a1)',
              fontSize: '14px',
              fontWeight: 600
            }}>
              <span>Total de comissões na exibição:</span>
              <strong style={{ fontSize: '16px', fontWeight: 800 }}>{formatCurrency(pageTotalCommission)}</strong>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>sync</span>
              <p style={{ marginTop: '12px' }}>Carregando comissões...</p>
            </div>
          ) : processedItems.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px', opacity: 0.5 }}>payments_off</span>
              <p style={{ marginTop: '8px' }}>Nenhuma comissão encontrada para os filtros selecionados.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Data</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Pedido</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Tipo de Comissão</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'right' }}>Valor do Pedido</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'right' }}>Valor Comissão</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedItems.map((item) => {
                      const isBonus = item.commission_type === 'first_purchase_bonus';

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                          <td style={{ padding: '12px' }}>{formatDate(item.created_at)}</td>
                          <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'monospace' }}>{item.order_code}</td>
                          
                          {/* Tipo de Comissão Badge */}
                          <td style={{ padding: '12px' }}>
                            {isBonus ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                color: '#a16207',
                                border: '1px solid rgba(234, 179, 8, 0.3)'
                              }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>workspace_premium</span>
                                Bônus 1ª Compra
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: '#E0F2FE',
                                color: '#0369A1'
                              }}>
                                🔗 Comissão {item.commission_percentage ? `(${item.commission_percentage}%)` : ''}
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(item.order_amount)}
                          </td>

                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, fontSize: '15px', color: isBonus ? '#a16207' : 'var(--color-primary)' }}>
                            {formatCurrency(item.commission_amount)}
                          </td>

                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: item.status === 'liberada' ? '#D1FAE5' : item.status === 'paga' ? '#E0F2FE' : item.status === 'cancelada' ? '#FEE2E2' : '#FEF3C7',
                              color: item.status === 'liberada' ? '#059669' : item.status === 'paga' ? '#0369A1' : item.status === 'cancelada' ? '#DC2626' : '#D97706'
                            }}>
                              {item.status === 'liberada' ? 'Liberada' : item.status === 'paga' ? 'Paga' : item.status === 'cancelada' ? 'Cancelada' : 'Aguardando'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-outline-variant)', flexWrap: 'wrap', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                  Mostrando <strong>{processedItems.length}</strong> de <strong>{total}</strong> comissões (Página {page} de {totalPages})
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '10px',
                      border: '1px solid var(--color-outline-variant)',
                      background: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: page === 1 ? 'not-allowed' : 'pointer',
                      opacity: page === 1 ? 0.45 : 1
                    }}
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                    disabled={page === totalPages}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '10px',
                      border: '1px solid var(--color-outline-variant)',
                      background: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: page === totalPages ? 'not-allowed' : 'pointer',
                      opacity: page === totalPages ? 0.45 : 1
                    }}
                  >
                    Próxima →
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
