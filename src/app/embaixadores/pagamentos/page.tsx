'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { createCommissionPaymentAction, listReleasedCommissionsAction } from './actions';
import type { AmbassadorCommissionGroup, ReleasedCommissionsData } from './types';
import type { ReleasedCommission } from './types';
import styles from './payments.module.css';

const EMPTY_DATA: ReleasedCommissionsData = {
  summary: { releasedAmount: 0, commissionCount: 0, ambassadorCount: 0, minimumPaymentAmount: 0 },
  groups: [],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
}

function commissionLabel(commission: ReleasedCommission) {
  return commission.commissionType === 'first_purchase_bonus'
    ? 'Bônus 1ª compra'
    : `Nível ${commission.level}`;
}

export default function AdminCommissionPaymentsPage() {
  const [data, setData] = useState<ReleasedCommissionsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [modalGroup, setModalGroup] = useState<AmbassadorCommissionGroup | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [overrideMinimum, setOverrideMinimum] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [isPending, startTransition] = useTransition();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listReleasedCommissionsAction();
      setData(result);
      setSelected({});
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Não foi possível carregar os pagamentos.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedCommissions = useMemo(() => {
    if (!modalGroup) return [];
    const ids = new Set(selected[modalGroup.ambassadorId] || []);
    return modalGroup.commissions.filter((commission) => ids.has(commission.id));
  }, [modalGroup, selected]);

  const selectedAmount = selectedCommissions.reduce((total, commission) => total + commission.amount, 0);
  const belowMinimum = Boolean(modalGroup && selectedAmount < modalGroup.minimumPaymentAmount);

  const toggleCommission = (group: AmbassadorCommissionGroup, commissionId: string) => {
    setSelected((current) => {
      const currentIds = current[group.ambassadorId] || [];
      const nextIds = currentIds.includes(commissionId)
        ? currentIds.filter((id) => id !== commissionId)
        : [...currentIds, commissionId];
      return { ...current, [group.ambassadorId]: nextIds };
    });
  };

  const toggleAll = (group: AmbassadorCommissionGroup) => {
    setSelected((current) => {
      const currentIds = current[group.ambassadorId] || [];
      const allSelected = currentIds.length === group.commissions.length;
      return { ...current, [group.ambassadorId]: allSelected ? [] : group.commissions.map((item) => item.id) };
    });
  };

  const openConfirmation = (group: AmbassadorCommissionGroup) => {
    if (!(selected[group.ambassadorId] || []).length) {
      toast.error('Selecione ao menos uma comissão liberada.');
      return;
    }
    setPaymentReference('');
    setNotes('');
    setOverrideMinimum(false);
    setOverrideReason('');
    setModalGroup(group);
  };

  const closeModal = () => {
    if (!isPending) setModalGroup(null);
  };

  const submitPayment = () => {
    if (!modalGroup) return;
    if (!paymentReference.trim()) {
      toast.error('Informe a referência do pagamento.');
      return;
    }
    if (belowMinimum && !overrideMinimum) {
      toast.error('O total está abaixo do mínimo. Autorize o override para continuar.');
      return;
    }
    if (overrideMinimum && overrideReason.trim().length < 10) {
      toast.error('Descreva o motivo do override com pelo menos 10 caracteres.');
      return;
    }

    startTransition(async () => {
      try {
        const result = await createCommissionPaymentAction({
          ambassadorId: modalGroup.ambassadorId,
          commissionIds: selectedCommissions.map((item) => item.id),
          paymentReference,
          notes,
          overrideMinimum,
          overrideReason,
        });

        if (!result.success) {
          toast.error(result.message);
          return;
        }

        toast.success(result.message);
        setModalGroup(null);
        await loadData();
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : 'Não foi possível registrar o pagamento.');
      }
    });
  };

  return (
    <MainLayout>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Financeiro · Embaixadores</span>
            <h1>Pagamentos de comissões</h1>
            <p>Selecione comissões liberadas e registre repasses Pix com rastreabilidade.</p>
          </div>
          <button className={styles.refreshButton} onClick={() => void loadData()} disabled={loading || isPending}>
            <span className="material-symbols-outlined">refresh</span>
            Atualizar
          </button>
        </header>

        <section className={styles.summaryGrid} aria-label="Resumo de comissões liberadas">
          <SummaryCard icon="account_balance_wallet" label="Total liberado" value={formatCurrency(data.summary.releasedAmount)} emphasis />
          <SummaryCard icon="receipt_long" label="Comissões liberadas" value={String(data.summary.commissionCount)} />
          <SummaryCard icon="groups" label="Embaixadores a pagar" value={String(data.summary.ambassadorCount)} />
          <SummaryCard icon="payments" label="Mínimo padrão" value={formatCurrency(data.summary.minimumPaymentAmount)} />
        </section>

        {loading ? (
          <div className={styles.stateCard}><span className={`${styles.spinner} material-symbols-outlined`}>progress_activity</span><strong>Carregando comissões...</strong></div>
        ) : error ? (
          <div className={styles.stateCard} role="alert">
            <span className="material-symbols-outlined">error</span>
            <strong>{error}</strong>
            <button onClick={() => void loadData()}>Tentar novamente</button>
          </div>
        ) : data.groups.length === 0 ? (
          <div className={styles.stateCard}>
            <span className="material-symbols-outlined">task_alt</span>
            <strong>Nenhuma comissão liberada para pagamento</strong>
            <p>Quando uma comissão ficar disponível, ela aparecerá aqui agrupada por embaixador.</p>
          </div>
        ) : (
          <section className={styles.groups}>
            {data.groups.map((group) => {
              const selectedIds = selected[group.ambassadorId] || [];
              const selectionAmount = group.commissions
                .filter((item) => selectedIds.includes(item.id))
                .reduce((total, item) => total + item.amount, 0);
              const allSelected = selectedIds.length === group.commissions.length;

              return (
                <article className={styles.groupCard} key={group.ambassadorId}>
                  <div className={styles.groupHeader}>
                    <div className={styles.identity}>
                      <div className={styles.avatar}>{group.name.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <h2>{group.name}</h2>
                        <span>{group.username}</span>
                      </div>
                    </div>
                    <div className={styles.groupTotals}>
                      <span>Total liberado</span>
                      <strong>{formatCurrency(group.releasedAmount)}</strong>
                      <small className={group.meetsMinimum ? styles.minimumOk : styles.minimumWarning}>
                        {group.meetsMinimum ? 'Mínimo atingido' : `Mínimo: ${formatCurrency(group.minimumPaymentAmount)}`}
                      </small>
                    </div>
                  </div>

                  <div className={styles.pixRow}>
                    <span className="material-symbols-outlined">key</span>
                    <div><small>Chave {group.pixType}</small><strong>{group.pixMasked}</strong></div>
                    <span className={styles.privacyBadge}>mascarada</span>
                  </div>

                  <div className={styles.tableWrap}>
                    <table>
                      <thead><tr><th><input type="checkbox" checked={allSelected} onChange={() => toggleAll(group)} aria-label={`Selecionar todas as comissões de ${group.name}`} /></th><th>Pedido</th><th>Disponível em</th><th>Tipo / nível</th><th>Valor</th></tr></thead>
                      <tbody>
                        {group.commissions.map((commission) => (
                          <tr key={commission.id}>
                            <td><input type="checkbox" checked={selectedIds.includes(commission.id)} onChange={() => toggleCommission(group, commission.id)} aria-label={`Selecionar comissão do pedido ${commission.orderNumber}`} /></td>
                            <td><strong>{commission.orderNumber}</strong></td>
                            <td>{formatDate(commission.createdAt)}</td>
                            <td><span className={styles.levelBadge}>{commissionLabel(commission)}</span></td>
                            <td><strong>{formatCurrency(commission.amount)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.mobileCommissions}>
                    {group.commissions.map((commission) => (
                      <label className={styles.mobileCommission} key={commission.id}>
                        <input type="checkbox" checked={selectedIds.includes(commission.id)} onChange={() => toggleCommission(group, commission.id)} />
                        <span><strong>{commission.orderNumber}</strong><small>{formatDate(commission.createdAt)} · {commissionLabel(commission)}</small></span>
                        <b>{formatCurrency(commission.amount)}</b>
                      </label>
                    ))}
                  </div>

                  <footer className={styles.groupFooter}>
                    <div><span>{selectedIds.length} selecionada(s)</span><strong>{formatCurrency(selectionAmount)}</strong></div>
                    <button onClick={() => openConfirmation(group)} disabled={selectedIds.length === 0 || isPending}>
                      Registrar pagamento
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </footer>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {modalGroup && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
            <header><div><span className={styles.eyebrow}>Confirmação financeira</span><h2 id="payment-modal-title">Registrar pagamento</h2></div><button onClick={closeModal} disabled={isPending} aria-label="Fechar"><span className="material-symbols-outlined">close</span></button></header>

            <div className={styles.confirmationSummary}>
              <div><span>Beneficiário</span><strong>{modalGroup.name}</strong><small>{modalGroup.username}</small></div>
              <div><span>Pix {modalGroup.pixType}</span><strong>{modalGroup.pixMasked}</strong><small>Chave mascarada</small></div>
              <div><span>Comissões</span><strong>{selectedCommissions.length}</strong><small>Somente liberadas</small></div>
              <div><span>Total do repasse</span><strong>{formatCurrency(selectedAmount)}</strong><small>Mínimo {formatCurrency(modalGroup.minimumPaymentAmount)}</small></div>
            </div>

            {belowMinimum && <div className={styles.warningBox}><span className="material-symbols-outlined">warning</span><p>O total selecionado está abaixo do mínimo configurado. Para continuar, autorize e justifique a exceção.</p></div>}

            <label className={styles.field}><span>Referência do pagamento *</span><input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} maxLength={120} placeholder="Ex.: PIX-2026-000123" autoFocus /></label>
            <label className={styles.field}><span>Observações</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} placeholder="Informações internas opcionais" /></label>

            {belowMinimum && (
              <div className={styles.overrideBox}>
                <label className={styles.overrideToggle}><input type="checkbox" checked={overrideMinimum} onChange={(e) => setOverrideMinimum(e.target.checked)} /><span><strong>Autorizar pagamento abaixo do mínimo</strong><small>Esta exceção deve ser auditada.</small></span></label>
                {overrideMinimum && <label className={styles.field}><span>Motivo do override *</span><textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} minLength={10} maxLength={500} rows={3} placeholder="Explique por que o pagamento deve ser antecipado" /></label>}
              </div>
            )}

            <footer><button className={styles.cancelButton} onClick={closeModal} disabled={isPending}>Cancelar</button><button className={styles.confirmButton} onClick={submitPayment} disabled={isPending}>{isPending ? 'Registrando...' : `Confirmar ${formatCurrency(selectedAmount)}`}</button></footer>
          </section>
        </div>
      )}
    </MainLayout>
  );
}

function SummaryCard({ icon, label, value, emphasis = false }: { icon: string; label: string; value: string; emphasis?: boolean }) {
  return <article className={`${styles.summaryCard} ${emphasis ? styles.summaryEmphasis : ''}`}><span className="material-symbols-outlined">{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>;
}
