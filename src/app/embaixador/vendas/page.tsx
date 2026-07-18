'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getMinhasVendas } from '../actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';

export default function VendasPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 10;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getMinhasVendas({ page, limit, status: statusFilter });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar vendas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, statusFilter]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <MainLayout>
      <div style={{ maxWidth: '1100px', margin: '0 auto 40px' }}>
        <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700, margin: 0 }}>
              Minhas Vendas
            </h1>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
              Histórico de vendas atribuídas ao seu código e respectivas comissões.
            </p>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid var(--color-outline-variant)',
                backgroundColor: 'var(--color-surface-container-low)',
                color: 'var(--color-on-surface)',
                fontSize: '14px'
              }}
            >
              <option value="">Todos os status</option>
              <option value="finalizado">Finalizado / Aprovado</option>
              <option value="pendente">Pendente</option>
              <option value="cancelado">Cancelado / Estornado</option>
            </select>
          </div>
        </header>

        <div style={{
          backgroundColor: 'var(--color-surface-container-low)',
          padding: '24px',
          borderRadius: '20px',
          border: '1px solid var(--color-outline-variant)'
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>Carregando vendas...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
              Nenhuma venda encontrada para os filtros selecionados.
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
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'right' }}>Valor Total</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Status Venda</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'center' }}>% Comis.</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'right' }}>Comissão (R$)</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Status Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'monospace' }}>{item.codigo_pedido}</td>
                        <td style={{ padding: '12px' }}>{formatDate(item.created_at)}</td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{item.cliente_nome_mascarado}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.valor_total)}</td>
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
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700 }}>
                          {item.commission_percentage ? `${item.commission_percentage}%` : '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
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
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-outline-variant)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                    Página {page} de {totalPages} ({total} vendas)
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
