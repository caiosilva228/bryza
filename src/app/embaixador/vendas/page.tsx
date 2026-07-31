'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getMinhasVendas } from '../actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';

export default function VendasPage() {
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
      const res = await getMinhasVendas({ page, limit: pageSize, status: statusFilter });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar vendas.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtros locais de busca, tipo de comissão e ordenação
  const processedItems = useMemo(() => {
    let result = [...items];

    // Filtro de busca (código ou cliente)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          String(item.codigo_pedido || '').toLowerCase().includes(q) ||
          String(item.cliente_nome_mascarado || '').toLowerCase().includes(q)
      );
    }

    // Filtro por tipo de comissão
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

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <MainLayout>
      <div style={{ maxWidth: '1180px', margin: '0 auto 40px' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700, margin: 0 }}>
            Minhas Vendas
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
            Histórico de vendas atribuídas ao seu código e detalhamento das comissões.
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
              {/* Busca */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--color-surface-container-high)',
                border: '1px solid var(--color-outline-variant)',
                padding: '8px 14px',
                borderRadius: '12px',
                minWidth: '220px',
                flex: 1
              }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', fontSize: '18px' }}>search</span>
                <input
                  type="text"
                  placeholder="Buscar por pedido ou cliente..."
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

              {/* Filtro Status Pedido */}
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
                <option value="finalizado">Finalizado / Aprovado</option>
                <option value="pendente">Pendente</option>
                <option value="cancelado">Cancelado</option>
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
                <option value="bonus">🏆 Bônus 1ª Venda</option>
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

            {/* Seletor de Limite */}
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

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>sync</span>
              <p style={{ marginTop: '12px' }}>Carregando vendas...</p>
            </div>
          ) : processedItems.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px', opacity: 0.5 }}>search_off</span>
              <p style={{ marginTop: '8px' }}>Nenhuma venda encontrada para os filtros selecionados.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Pedido</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Data</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Cliente</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Tipo de Comissão</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Status Pedido</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'right' }}>Comissão</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Status Comis.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedItems.map((item) => {
                      const isBonus = item.commission_type === 'first_purchase_bonus';

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                          <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'monospace' }}>{item.codigo_pedido}</td>
                          <td style={{ padding: '12px' }}>{formatDate(item.created_at)}</td>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{item.cliente_nome_mascarado}</td>
                          
                          {/* Tipo de Comissão: Distinção Dourada para Bônus de 1ª Venda */}
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
                                Bônus 1ª Venda
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

                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: item.status_pedido === 'finalizado' ? '#D1FAE5' : '#FEF3C7',
                              color: item.status_pedido === 'finalizado' ? '#059669' : '#D97706'
                            }}>
                              {item.status_pedido}
                            </span>
                          </td>

                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, fontSize: '15px', color: isBonus ? '#a16207' : 'var(--color-primary)' }}>
                            {item.commission_amount ? formatCurrency(item.commission_amount) : '-'}
                          </td>

                          <td style={{ padding: '12px' }}>
                            {item.commission_status ? (
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: item.commission_status === 'liberada' ? '#D1FAE5' : item.commission_status === 'paga' ? '#E0F2FE' : '#FEF3C7',
                                color: item.commission_status === 'liberada' ? '#059669' : item.commission_status === 'paga' ? '#0369A1' : '#D97706'
                              }}>
                                {item.commission_status}
                              </span>
                            ) : '-'}
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
                  Mostrando <strong>{processedItems.length}</strong> de <strong>{total}</strong> vendas (Página {page} de {totalPages})
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
