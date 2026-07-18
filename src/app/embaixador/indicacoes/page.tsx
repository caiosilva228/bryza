'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getMinhasIndicacoes } from '../actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';

export default function IndicacoesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  const loadData = async (pageNumber: number) => {
    setLoading(true);
    try {
      const res = await getMinhasIndicacoes({ page: pageNumber, limit });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar indicações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(page);
  }, [page]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <MainLayout>
      <div style={{ maxWidth: '1000px', margin: '0 auto 40px' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700, margin: 0 }}>
            Minhas Indicações
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
            Acompanhe os clientes atribuídos ao seu código com total privacidade.
          </p>
        </header>

        <div style={{
          backgroundColor: 'var(--color-surface-container-low)',
          padding: '24px',
          borderRadius: '20px',
          border: '1px solid var(--color-outline-variant)'
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>Carregando indicações...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
              Nenhuma indicação registrada até o momento.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Cliente</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Data da Indicação</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Origem</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Status Vinculação</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'center' }}>Pedidos Realizados</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'right' }}>Valor Agregado Aprovado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                          {item.cliente_nome_mascarado}
                        </td>
                        <td style={{ padding: '12px' }}>{formatDate(item.created_at)}</td>
                        <td style={{ padding: '12px' }}>{item.referral_source || 'Link'}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: item.is_locked ? '#E0F2FE' : '#FEF3C7',
                            color: item.is_locked ? '#0369A1' : '#D97706'
                          }}>
                            {item.is_locked ? 'Fixo' : 'Temporário'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>{item.total_pedidos}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {formatCurrency(item.valor_aprovado_total)}
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
                    Página {page} de {totalPages} ({total} indicações)
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
