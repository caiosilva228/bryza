'use client';

import { useCallback, useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getMinhasIndicacoes } from '../actions';
import type { AmbassadorReferral } from '../actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';
import styles from './page.module.css';

const PAGE_SIZE = 10;

function isActivated(item: AmbassadorReferral) {
  if (item.is_active) return true;
  if (item.activated_at) return true;
  if (item.activation_status === true) return true;
  return ['ativo', 'ativado', 'active'].includes(String(item.activation_status).toLowerCase());
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
        <small>Aguardando pagamento confirmado</small>
      )}
    </div>
  );
}

export default function IndicacoesPage() {
  const [items, setItems] = useState<AmbassadorReferral[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (pageNumber: number) => {
    setLoading(true);
    try {
      const result = await getMinhasIndicacoes({ page: pageNumber, limit: PAGE_SIZE });
      setItems(result.items || []);
      setTotal(result.total || 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar indicações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(page);
  }, [loadData, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <MainLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1>Minhas Indicações</h1>
          <p>Acompanhe os clientes atribuídos ao seu código e veja quando cada indicação foi ativada.</p>
        </header>

        <section className={styles.card}>
          {loading ? (
            <div className={styles.empty}>Carregando indicações...</div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>Nenhuma indicação registrada até o momento.</div>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Data da indicação</th>
                      <th>Origem</th>
                      <th>Status vinculação</th>
                      <th>Ativação</th>
                      <th className={styles.center}>Pedidos realizados</th>
                      <th className={styles.right}>Valor agregado aprovado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Cliente" className={styles.customer}>{item.cliente_nome_mascarado}</td>
                        <td data-label="Data da indicação">{formatDate(item.created_at)}</td>
                        <td data-label="Origem">{item.referral_source || 'Link'}</td>
                        <td data-label="Status vinculação">
                          <span className={`${styles.linkBadge} ${item.is_locked ? styles.locked : styles.temporary}`}>
                            {item.is_locked ? 'Fixo' : 'Temporário'}
                          </span>
                        </td>
                        <td data-label="Ativação"><ActivationCell item={item} /></td>
                        <td data-label="Pedidos realizados" className={styles.centerStrong}>{item.total_pedidos}</td>
                        <td data-label="Valor agregado" className={styles.amount}>{formatCurrency(item.valor_aprovado_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <nav className={styles.pagination} aria-label="Paginação das indicações">
                  <span>Página {page} de {totalPages} ({total} indicações)</span>
                  <div>
                    <button onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page === 1}>Anterior</button>
                    <button onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={page === totalPages}>Próxima</button>
                  </div>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
