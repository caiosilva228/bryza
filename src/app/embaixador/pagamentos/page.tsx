'use client';

import { useState, useEffect, useTransition } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getMeusPagamentos, getComprovantePaymentUrl } from '../actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';

export default function PagamentosPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const limit = 10;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getMeusPagamentos({ page, limit });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar pagamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

  const handleOpenReceipt = (paymentId: string) => {
    startTransition(async () => {
      try {
        const url = await getComprovantePaymentUrl(paymentId);
        window.open(url, '_blank');
      } catch (e: any) {
        toast.error(e.message || 'Erro ao carregar comprovante.');
      }
    });
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <MainLayout>
      <div style={{ maxWidth: '1000px', margin: '0 auto 40px' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700, margin: 0 }}>
            Meus Pagamentos & Saques
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
            Histórico dos repasses Pix efetuados pela administração com comprovantes seguros.
          </p>
        </header>

        <div style={{
          backgroundColor: 'var(--color-surface-container-low)',
          padding: '24px',
          borderRadius: '20px',
          border: '1px solid var(--color-outline-variant)'
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>Carregando pagamentos...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
              Nenhum pagamento registrado até o momento.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Data do Pagamento</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Método</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'right' }}>Valor Pago</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Observações</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'center' }}>Comprovante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{formatDate(item.created_at)}</td>
                        <td style={{ padding: '12px', textTransform: 'uppercase', fontWeight: 700 }}>{item.payment_method || 'Pix'}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {formatCurrency(item.amount)}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontSize: '13px' }}>
                          {item.notes || '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {item.has_receipt ? (
                            <button
                              onClick={() => handleOpenReceipt(item.id)}
                              disabled={isPending}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--color-primary)',
                                backgroundColor: 'transparent',
                                color: 'var(--color-primary)',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>description</span>
                              Ver Comprovante
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Sem arquivo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-outline-variant)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                    Página {page} de {totalPages} ({total} pagamentos)
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setPage(p => Math.max(p - 1, 1))}
                      disabled={page === 1}
                      style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--color-outline)', background: 'transparent', cursor: 'pointer', opacity: page === 1 ? 0.5 : 1 }}
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                      disabled={page === totalPages}
                      style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--color-outline)', background: 'transparent', cursor: 'pointer', opacity: page === totalPages ? 0.5 : 1 }}
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
