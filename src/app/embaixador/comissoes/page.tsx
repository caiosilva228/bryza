'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getMinhasComissoes } from '../actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';

export default function ComissoesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 10;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getMinhasComissoes({ page, limit, status: statusFilter });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar comissões.');
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
      <div style={{ maxWidth: '1000px', margin: '0 auto 40px' }}>
        <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700, margin: 0 }}>
              Minhas Comissões
            </h1>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
              Extrato detalhado de todas as suas comissões por vendas indicadas.
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
              <option value="aguardando_entrega">Aguardando Entrega</option>
              <option value="liberada">Liberada</option>
              <option value="paga">Paga</option>
              <option value="cancelada">Cancelada</option>
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
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>Carregando comissões...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
              Nenhuma comissão encontrada para o filtro selecionado.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Data</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Pedido</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'right' }}>Valor do Pedido</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'center' }}>Comissão</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600, textAlign: 'right' }}>Valor Comissão</th>
                      <th style={{ padding: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <td style={{ padding: '12px' }}>{formatDate(item.created_at)}</td>
                        <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'monospace' }}>{item.order_code}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.order_amount)}</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700 }}>
                          {item.commission_type === 'first_purchase_bonus' ? 'Bônus 1ª compra' : `${item.commission_percentage}%`}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
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
                            {item.status}
                          </span>
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
                    Página {page} de {totalPages} ({total} registros)
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
