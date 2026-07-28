'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  getMeusPedidos,
  type AmbassadorOwnOrder,
  type AmbassadorOwnOrdersData,
} from '../actions';
import styles from './orders.module.css';

const PAGE_SIZE = 10;
const EMPTY_DATA: AmbassadorOwnOrdersData = { items: [], total: 0 };

const FULFILLMENT_LABELS: Record<string, string> = {
  agendado: 'Agendado',
  convertido: 'Pedido criado',
  aguardando_preparacao: 'Em preparação',
  pronto_para_entrega: 'Pronto para entrega',
  em_rota: 'Em rota',
  entregue: 'Entregue',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

const PAYMENT_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  processando: 'Processando',
  aprovado: 'Pago',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
  reembolsado: 'Reembolsado',
  chargeback: 'Contestado',
  em_analise: 'Em análise',
};

const FILTER_OPTIONS = [
  { value: '', label: 'Todos os pedidos' },
  { value: 'agendado', label: 'Agendados' },
  { value: 'aguardando_preparacao', label: 'Em preparação' },
  { value: 'em_rota', label: 'Em rota' },
  { value: 'entregue', label: 'Entregues' },
  { value: 'aprovado', label: 'Pagos' },
  { value: 'pendente', label: 'Pagamento pendente' },
  { value: 'cancelado', label: 'Cancelados' },
];

export default function MeusPedidosPage() {
  const [data, setData] = useState<AmbassadorOwnOrdersData>(EMPTY_DATA);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getMeusPedidos({ page, limit: PAGE_SIZE, status }));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Erro ao carregar seus pedidos.');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const summary = useMemo(() => ({
    paid: data.items.filter((item) => item.payment_status === 'aprovado').length,
    pending: data.items.filter((item) => !isPaid(item)).length,
    inRoute: data.items.filter((item) => item.fulfillment_status === 'em_rota').length,
  }), [data.items]);
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <MainLayout>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Acompanhamento</span>
            <h1>Meus pedidos</h1>
            <p>Acompanhe o preparo, o pagamento e a entrega das suas compras.</p>
          </div>
          <button className={styles.refreshButton} onClick={() => void loadOrders()} disabled={loading}>
            <span className="material-symbols-outlined">refresh</span>
            Atualizar
          </button>
        </header>

        <section className={styles.summaryGrid} aria-label="Resumo dos pedidos desta página">
          <SummaryCard icon="receipt_long" label="Pedidos encontrados" value={data.total} />
          <SummaryCard icon="verified" label="Pagos nesta página" value={summary.paid} positive />
          <SummaryCard icon="pending_actions" label="Não pagos nesta página" value={summary.pending} />
          <SummaryCard icon="local_shipping" label="Em rota nesta página" value={summary.inRoute} />
        </section>

        <section className={styles.ordersCard}>
          <div className={styles.toolbar}>
            <div>
              <span className={styles.eyebrow}>Histórico</span>
              <h2>Pedidos e agendamentos</h2>
            </div>
            <label>
              <span>Filtrar por status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <EmptyState icon="progress_activity" title="Carregando seus pedidos..." />
          ) : data.items.length === 0 ? (
            <EmptyState
              icon="inventory_2"
              title="Nenhum pedido encontrado"
              detail={status ? 'Tente selecionar outro status.' : 'Suas compras aparecerão aqui após o agendamento.'}
            />
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Data</th>
                      <th>Entrega</th>
                      <th>Pagamento</th>
                      <th>Valor</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={`${item.entity_type}-${item.entity_id}`}>
                        <td data-label="Pedido">
                          <strong>#{item.numero}</strong>
                          <small>{item.entity_type === 'agendamento' ? 'Agendamento' : 'Pedido'}</small>
                        </td>
                        <td data-label="Data">{formatDate(item.created_at)}</td>
                        <td data-label="Entrega">
                          <StatusBadge
                            status={item.fulfillment_status}
                            label={FULFILLMENT_LABELS[item.fulfillment_status] || item.fulfillment_status}
                            kind="fulfillment"
                          />
                        </td>
                        <td data-label="Pagamento">
                          <div className={styles.paymentCell}>
                            <StatusBadge
                              status={item.payment_status}
                              label={isPaid(item) ? 'Pago' : 'Não pago'}
                              kind="payment"
                            />
                            <small>
                              {PAYMENT_LABELS[item.payment_status] || item.payment_status}
                              {' · '}
                              {item.payment_timing === 'agora' ? 'Antecipado' : 'Na entrega'}
                            </small>
                          </div>
                        </td>
                        <td data-label="Valor"><strong>{formatCurrency(Number(item.valor_total))}</strong></td>
                        <td data-label="Ação">
                          {item.can_pay_now ? (
                            <button className={styles.futurePayButton} disabled title="Pagamento online em breve">
                              Pagar agora
                              <small>Em breve</small>
                            </button>
                          ) : (
                            <span className={styles.noAction}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <span>Página {page} de {totalPages} · {data.total} registro(s)</span>
                  <div>
                    <button onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page === 1}>
                      Anterior
                    </button>
                    <button onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={page === totalPages}>
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </MainLayout>
  );
}

function isPaid(order: AmbassadorOwnOrder) {
  return order.payment_status === 'aprovado';
}

function SummaryCard({
  icon,
  label,
  value,
  positive = false,
}: {
  icon: string;
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <article className={`${styles.summaryCard} ${positive ? styles.summaryPositive : ''}`}>
      <span className="material-symbols-outlined">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function StatusBadge({
  status,
  label,
  kind,
}: {
  status: string;
  label: string;
  kind: 'fulfillment' | 'payment';
}) {
  const paid = kind === 'payment' && status === 'aprovado';
  return (
    <span
      className={`${styles.statusBadge} ${paid ? styles.statusPaid : styles[`status_${status}`] || styles.statusNeutral}`}
    >
      {kind === 'payment' && (
        <span className="material-symbols-outlined">{paid ? 'check_circle' : 'schedule'}</span>
      )}
      {label}
    </span>
  );
}

function EmptyState({ icon, title, detail }: { icon: string; title: string; detail?: string }) {
  return (
    <div className={styles.emptyState}>
      <span className="material-symbols-outlined">{icon}</span>
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
    </div>
  );
}
