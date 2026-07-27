'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import {
  cancelarSolicitacaoSaque,
  getComprovantePaymentUrl,
  getMeusPagamentos,
  solicitarSaqueComissoes,
  type AmbassadorPayment,
  type AmbassadorPaymentsData,
} from '../actions';
import { formatCurrency, formatDate } from '@/utils/format';
import styles from './payments.module.css';

const EMPTY_DATA: AmbassadorPaymentsData = {
  items: [],
  total: 0,
  withdrawal: {
    available_amount: 0,
    available_commission_count: 0,
    minimum_payment_amount: 0,
    payment_frequency: 'mensal',
    program_status: 'ativo',
    pix_key_type: null,
    pix_key_masked: null,
    can_request: false,
    blocked_reason: 'no_available_commissions',
    pending_request: null,
  },
};

const STATUS_LABELS: Record<AmbassadorPayment['status'], string> = {
  pendente: 'Solicitado',
  processando: 'Em processamento',
  paga: 'Pago',
  cancelada: 'Cancelado',
  estornada: 'Estornado',
};

const FREQUENCY_LABELS = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
};

function blockedMessage(data: AmbassadorPaymentsData['withdrawal']) {
  switch (data.blocked_reason) {
    case 'program_inactive':
      return 'As solicitações de saque estão temporariamente indisponíveis.';
    case 'pending_request':
      return 'Você já possui uma solicitação em análise.';
    case 'pix_missing':
      return 'Cadastre sua chave Pix para liberar a solicitação.';
    case 'below_minimum':
      return `Acumule pelo menos ${formatCurrency(Number(data.minimum_payment_amount))} em comissões liberadas.`;
    default:
      return 'Você ainda não possui comissões liberadas para saque.';
  }
}

export default function PagamentosPage() {
  const [data, setData] = useState<AmbassadorPaymentsData>(EMPTY_DATA);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const limit = 10;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getMeusPagamentos({ page, limit }));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Erro ao carregar pagamentos.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const requestWithdrawal = () => {
    startTransition(async () => {
      try {
        const result = await solicitarSaqueComissoes();
        toast.success(result.message);
        await loadData();
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : 'Não foi possível solicitar o saque.');
      }
    });
  };

  const cancelWithdrawal = (requestId: string) => {
    startTransition(async () => {
      try {
        const result = await cancelarSolicitacaoSaque(requestId);
        toast.success(result.message);
        await loadData();
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : 'Não foi possível cancelar a solicitação.');
      }
    });
  };

  const openReceipt = (paymentId: string) => {
    startTransition(async () => {
      try {
        window.open(await getComprovantePaymentUrl(paymentId), '_blank');
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : 'Erro ao carregar comprovante.');
      }
    });
  };

  const withdrawal = data.withdrawal;
  const pendingRequest = withdrawal.pending_request;
  const totalPages = Math.ceil(data.total / limit) || 1;
  const progress = Math.min(
    (Number(withdrawal.available_amount) / Math.max(Number(withdrawal.minimum_payment_amount), 0.01)) * 100,
    100,
  );

  return (
    <MainLayout>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Minhas comissões</span>
            <h1>Pagamentos e saques</h1>
            <p>Solicite o repasse das comissões liberadas e acompanhe seus pagamentos Pix.</p>
          </div>
          <button className={styles.refreshButton} onClick={() => void loadData()} disabled={loading || isPending}>
            <span className="material-symbols-outlined">refresh</span>
            Atualizar
          </button>
        </header>

        <section className={styles.summaryGrid} aria-label="Resumo do saque">
          <SummaryCard
            icon="account_balance_wallet"
            label="Saldo liberado"
            value={formatCurrency(Number(withdrawal.available_amount))}
            detail={`${withdrawal.available_commission_count} comissão(ões)`}
            emphasis
          />
          <SummaryCard
            icon="payments"
            label="Mínimo para saque"
            value={formatCurrency(Number(withdrawal.minimum_payment_amount))}
            detail={`${Math.round(progress)}% alcançado`}
          />
          <SummaryCard
            icon="calendar_month"
            label="Frequência"
            value={FREQUENCY_LABELS[withdrawal.payment_frequency] || withdrawal.payment_frequency}
            detail="Ciclo configurado"
          />
        </section>

        <section className={styles.withdrawalCard}>
          <div className={styles.withdrawalInfo}>
            <span className="material-symbols-outlined">currency_exchange</span>
            <div>
              <h2>Solicitar saque</h2>
              <p>O pedido inclui automaticamente todas as suas comissões atualmente liberadas.</p>
            </div>
          </div>

          <div className={styles.progressTrack} aria-label={`${Math.round(progress)}% do mínimo para saque`}>
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className={styles.pixRow}>
            <span className="material-symbols-outlined">key</span>
            <div>
              <small>Chave {withdrawal.pix_key_type || 'Pix'}</small>
              <strong>{withdrawal.pix_key_masked || 'Não cadastrada'}</strong>
            </div>
            <Link href="/embaixador/perfil">Revisar Pix</Link>
          </div>

          {pendingRequest ? (
            <div className={styles.pendingBox}>
              <div>
                <span className="material-symbols-outlined">hourglass_top</span>
                <div>
                  <strong>Solicitação em análise</strong>
                  <small>
                    {formatCurrency(Number(pendingRequest.amount))} · {pendingRequest.commission_count} comissão(ões) · enviada em {formatDate(pendingRequest.created_at)}
                  </small>
                </div>
              </div>
              <button onClick={() => cancelWithdrawal(pendingRequest.id)} disabled={isPending}>
                Cancelar solicitação
              </button>
            </div>
          ) : (
            <div className={styles.actionRow}>
              <p>{withdrawal.can_request ? 'Seu saldo está pronto para solicitação.' : blockedMessage(withdrawal)}</p>
              <button onClick={requestWithdrawal} disabled={!withdrawal.can_request || isPending || loading}>
                <span className="material-symbols-outlined">send_money</span>
                {isPending
                  ? 'Enviando...'
                  : `Solicitar ${formatCurrency(Number(withdrawal.available_amount))}`}
              </button>
            </div>
          )}
        </section>

        <section className={styles.historyCard}>
          <div className={styles.sectionTitle}>
            <div>
              <span className={styles.eyebrow}>Histórico</span>
              <h2>Solicitações e pagamentos</h2>
            </div>
            <span>{data.total} registro(s)</span>
          </div>

          {loading ? (
            <div className={styles.emptyState}>Carregando pagamentos...</div>
          ) : data.items.length === 0 ? (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined">receipt_long</span>
              <strong>Nenhum saque registrado</strong>
              <p>Suas solicitações e os pagamentos concluídos aparecerão aqui.</p>
            </div>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Status</th>
                      <th>Valor</th>
                      <th>Comprovante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.paid_at || item.created_at)}</td>
                        <td>{item.is_withdrawal_request ? 'Pedido de saque' : 'Pagamento de comissão'}</td>
                        <td><StatusBadge status={item.status} /></td>
                        <td><strong>{formatCurrency(Number(item.amount))}</strong></td>
                        <td>
                          {item.has_receipt ? (
                            <button className={styles.receiptButton} onClick={() => openReceipt(item.id)} disabled={isPending}>
                              Ver comprovante
                            </button>
                          ) : <span className={styles.muted}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <span>Página {page} de {totalPages}</span>
                  <div>
                    <button onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page === 1}>Anterior</button>
                    <button onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={page === totalPages}>Próxima</button>
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

function SummaryCard({
  icon,
  label,
  value,
  detail,
  emphasis = false,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  emphasis?: boolean;
}) {
  return (
    <article className={`${styles.summaryCard} ${emphasis ? styles.summaryEmphasis : ''}`}>
      <span className="material-symbols-outlined">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: AmbassadorPayment['status'] }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
