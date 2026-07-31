'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getMinhasIndicacoes } from '../actions';
import type { AmbassadorReferral } from '../actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';
import styles from './page.module.css';

function isActivated(item: AmbassadorReferral) {
  if (item.is_active) return true;
  if (item.activated_at) return true;
  if (item.activation_status === true) return true;
  return ['ativo', 'ativado', 'active'].includes(String(item.activation_status).toLowerCase());
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'C';
}

function ActivationCell({ item }: { item: AmbassadorReferral }) {
  const activated = isActivated(item);

  return (
    <div className={styles.activationCell}>
      <span className={`${styles.statusBadge} ${activated ? styles.activeBadge : styles.pendingBadge}`}>
        <span className="material-symbols-outlined" aria-hidden="true">
          {activated ? 'check_circle' : 'schedule'}
        </span>
        {activated ? 'Ativo' : 'Não ativo'}
      </span>
      {activated && item.activated_at ? (
        <small>
          Pago em {formatDate(item.activated_at)}
          {item.activation_order_code ? ` · Pedido ${item.activation_order_code}` : ''}
        </small>
      ) : (
        <small>Aguardando 1ª compra</small>
      )}
    </div>
  );
}

export default function IndicacoesPage() {
  const [items, setItems] = useState<AmbassadorReferral[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (pageNumber: number, limitNumber: number) => {
    setLoading(true);
    try {
      const result = await getMinhasIndicacoes({
        page: pageNumber,
        limit: limitNumber,
        status: statusFilter === 'todos' ? undefined : statusFilter,
      });
      setItems(result.items || []);
      setTotal(result.total || 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar indicações.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData(page, pageSize);
  }, [loadData, page, pageSize]);

  // Filtro de busca por nome em tempo real no cliente
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter((item) =>
      item.cliente_nome_mascarado.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <MainLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1>Minhas Indicações</h1>
          <p>Acompanhe os clientes atribuídos ao seu código e veja o status de cada indicação.</p>
        </header>

        <section className={styles.card}>
          {/* Barra de Filtros e Opções */}
          <div className={styles.filterBar}>
            <div className={styles.filterGroup}>
              {/* Campo de Busca */}
              <div className={styles.searchInputWrapper}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', fontSize: '18px' }}>search</span>
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              {/* Filtro de Status */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className={styles.selectInput}
              >
                <option value="todos">Todos os Status</option>
                <option value="ativo">Ativos (Compraram)</option>
                <option value="pendente">Não Ativos (Pendente)</option>
              </select>
            </div>

            {/* Seletor de Itens por Página */}
            <div className={styles.pageSizeGroup}>
              <label htmlFor="pageSizeSelect">Exibir:</label>
              <select
                id="pageSizeSelect"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className={styles.selectInput}
              >
                <option value={10}>10 por página</option>
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>
          </div>

          {/* Conteúdo em Modo Lista (Cards) */}
          {loading ? (
            <div className={styles.empty}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>sync</span>
              <p style={{ marginTop: '12px' }}>Carregando indicações...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.empty}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px', opacity: 0.5 }}>group_off</span>
              <p style={{ marginTop: '8px' }}>Nenhuma indicação encontrada com os filtros selecionados.</p>
            </div>
          ) : (
            <>
              <div className={styles.listGrid}>
                {filteredItems.map((item) => (
                  <article key={item.id} className={styles.itemCard}>
                    <div className={styles.itemCardHeader}>
                      <div className={styles.customerInfo}>
                        <div className={styles.avatar}>
                          {initials(item.cliente_nome_mascarado)}
                        </div>
                        <div>
                          <h3 className={styles.customerName}>{item.cliente_nome_mascarado}</h3>
                          <small style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px' }}>
                            Indicação feita em {formatDate(item.created_at)}
                          </small>
                        </div>
                      </div>

                      <div className={styles.badgesGroup}>
                        <span className={`${styles.linkBadge} ${item.is_locked ? styles.locked : styles.temporary}`}>
                          {item.is_locked ? '🔒 Vinculação Fixa' : '⏳ Vinculação Temp.'}
                        </span>
                        <ActivationCell item={item} />
                      </div>
                    </div>

                    <div className={styles.itemCardBody}>
                      <div className={styles.metricField}>
                        <small>Origem da Indicação</small>
                        <span>{item.referral_source || 'Link de Vendas'}</span>
                      </div>

                      <div className={styles.metricField}>
                        <small>Pedidos Realizados</small>
                        <span>{item.total_pedidos} {item.total_pedidos === 1 ? 'pedido' : 'pedidos'}</span>
                      </div>

                      <div className={styles.metricField}>
                        <small>Valor Total Aprovado</small>
                        <span className={styles.amount}>{formatCurrency(item.valor_aprovado_total)}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Paginação */}
              <nav className={styles.pagination} aria-label="Paginação das indicações">
                <span>
                  Mostrando <strong>{filteredItems.length}</strong> de <strong>{total}</strong> indicações (Página {page} de {totalPages})
                </span>
                <div className={styles.paginationControls}>
                  <button
                    className={styles.pageButton}
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    disabled={page === 1}
                  >
                    ← Anterior
                  </button>
                  <button
                    className={styles.pageButton}
                    onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                    disabled={page === totalPages}
                  >
                    Próxima →
                  </button>
                </div>
              </nav>
            </>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
