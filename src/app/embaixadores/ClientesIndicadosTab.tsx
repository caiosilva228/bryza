'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getClientesIndicadosPaginados,
  promoverClienteParaEmbaixador,
} from './actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

interface ClienteIndicado {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  status_cliente: string;
  data_cadastro: string;
  total_compras: number;
  valor_total_gasto: number;
  ticket_medio: number;
  ambassador_id: string;
  ambassador_name: string;
  ambassador_username: string;
  ambassador_referral_code: string;
  ambassador_status: string;
}

interface Plano {
  id: string;
  name: string;
}

interface Embaixador {
  id: string;
  full_name: string;
  username: string;
}

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  lead: { label: 'Lead', bg: '#EDE9FE', text: '#6D28D9' },
  cliente: { label: 'Cliente', bg: '#D1FAE5', text: '#059669' },
  recorrente: { label: 'Recorrente', bg: '#DBEAFE', text: '#1D4ED8' },
  inativo: { label: 'Inativo', bg: '#F3F4F6', text: '#4B5563' },
};

export default function ClientesIndicadosTab() {
  const [items, setItems] = useState<ClienteIndicado[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [ambassadorFilter, setAmbassadorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ambassadors, setAmbassadors] = useState<Embaixador[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [modalCliente, setModalCliente] = useState<ClienteIndicado | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [isPending, startTransition] = useTransition();
  const [loadingData, setLoadingData] = useState(true);

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;

  const loadData = () => {
    setLoadingData(true);
    startTransition(async () => {
      try {
        const result = await getClientesIndicadosPaginados({
          limit,
          offset,
          search: search || undefined,
          ambassadorId: ambassadorFilter || undefined,
          status: statusFilter || undefined,
        });
        setItems(result.items);
        setTotal(result.total);
      } catch (e: any) {
        toast.error(e.message || 'Erro ao carregar clientes indicados.');
      } finally {
        setLoadingData(false);
      }
    });
  };

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('ambassadors')
      .select('id, full_name, username')
      .eq('status', 'ativo')
      .order('full_name')
      .then(({ data }) => { if (data) setAmbassadors(data); });
    supabase
      .from('commission_plans')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) {
          setPlanos(data);
          if (data.length > 0) setSelectedPlanId(data[0].id);
        }
      });
  }, []);

  useEffect(() => { loadData(); }, [offset, search, ambassadorFilter, statusFilter]);

  const handlePromote = () => {
    if (!modalCliente) return;
    startTransition(async () => {
      try {
        const result = await promoverClienteParaEmbaixador({
          clienteId: modalCliente.id,
          planId: selectedPlanId || undefined,
          initialStatus: 'pendente',
        });
        toast.success(`✅ ${modalCliente.nome} promovido(a)! Código: ${result.referral_code}`);
        setModalCliente(null);
        setOffset(0);
        loadData();
      } catch (e: any) {
        toast.error(e.message || 'Erro ao promover cliente.');
      }
    });
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_LABELS[status] || { label: status, bg: '#F3F4F6', text: '#4B5563' };
    return (
      <span style={{ backgroundColor: s.bg, color: s.text, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
        {s.label}
      </span>
    );
  };

  return (
    <>
      {/* Filtros */}
      <div style={{ backgroundColor: 'var(--color-surface-container-low)', borderRadius: '12px', border: '1px solid var(--color-outline-variant)', padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>BUSCAR CLIENTE</label>
          <div style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: 'var(--color-outline)' }}>search</span>
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} placeholder="Nome, telefone ou e-mail..." style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', fontSize: '13px' }} />
          </div>
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>FILTRAR POR EMBAIXADOR</label>
          <select value={ambassadorFilter} onChange={(e) => { setAmbassadorFilter(e.target.value); setOffset(0); }} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', fontSize: '13px' }}>
            <option value="">Todos os embaixadores</option>
            {ambassadors.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name} (@{a.username})</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '0 1 160px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>STATUS DO CLIENTE</label>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', fontSize: '13px' }}>
            <option value="">Todos</option>
            <option value="lead">Lead</option>
            <option value="cliente">Cliente</option>
            <option value="recorrente">Recorrente</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>

        {(search || ambassadorFilter || statusFilter) && (
          <button onClick={() => { setSearch(''); setAmbassadorFilter(''); setStatusFilter(''); setOffset(0); }} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'transparent', color: 'var(--color-on-surface-variant)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-end' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>filter_alt_off</span>
            Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-outline-variant)', overflow: 'hidden', opacity: isPending || loadingData ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
        {items.length === 0 && !loadingData ? (
          <div style={{ padding: '80px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-surface-container-low)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--color-surface-container-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-outline-variant)' }}>group_off</span>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '8px' }}>Nenhum cliente indicado encontrado</h3>
            <p style={{ color: 'var(--color-on-surface-variant)', maxWidth: '420px', fontSize: '14px' }}>
              {ambassadorFilter ? 'Este embaixador ainda não indicou clientes, ou todos já viraram embaixadores.' : 'Não há clientes indicados por embaixadores que ainda não participem do programa.'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container-low)' }}>
                    {['Cliente', 'Telefone', 'Cidade', 'Status', 'Embaixador Indicador', 'Cadastro', 'Compras', 'Total Gasto', 'Ações'].map((h) => (
                      <th key={h} style={{ padding: '14px 16px', fontWeight: 700, fontSize: '12px', color: 'var(--color-on-surface-variant)', whiteSpace: 'nowrap', textAlign: h === 'Compras' || h === 'Total Gasto' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--color-outline-variant)', transition: 'background-color 0.15s ease' }} className="table-row-hover">
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '14px' }}>{item.nome}</div>
                        {item.email && <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>{item.email}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--color-on-surface-variant)', fontSize: '13px' }}>{item.telefone || '—'}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>{item.cidade ? `${item.cidade} - ${item.estado || ''}` : '—'}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{getStatusBadge(item.status_cliente)}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '13px' }}>{item.ambassador_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>@{item.ambassador_username} · {item.ambassador_referral_code}</div>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>{formatDate(item.data_cadastro)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>{item.total_compras || 0}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '14px', color: 'var(--color-primary)' }}>{formatCurrency(item.valor_total_gasto || 0)}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => setModalCliente(item)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--color-primary)', backgroundColor: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>workspace_premium</span>
                          Tornar Embaixador
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', backgroundColor: 'var(--color-surface-container-low)', borderTop: '1px solid var(--color-outline-variant)' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                Página {currentPage} de {totalPages} · {total} cliente{total !== 1 ? 's' : ''} indicado{total !== 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setOffset((p) => p - limit)} disabled={offset === 0 || isPending} style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--color-outline)', background: 'transparent', color: 'var(--color-on-surface)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: offset === 0 ? 0.5 : 1 }}>Anterior</button>
                <button onClick={() => setOffset((p) => p + limit)} disabled={offset + limit >= total || isPending} style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--color-outline)', background: 'transparent', color: 'var(--color-on-surface)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: offset + limit >= total ? 0.5 : 1 }}>Próxima</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de Promoção */}
      {modalCliente && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) setModalCliente(null); }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '20px', padding: '32px', maxWidth: '480px', width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--color-primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--color-primary)' }}>workspace_premium</span>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 8px' }}>Tornar Embaixador</h2>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', margin: '0 0 24px' }}>
              O cliente <strong>{modalCliente.nome}</strong> será promovido a embaixador com status <strong>Pendente</strong>. O admin poderá ativar o acesso depois via "Redefinir Acesso".
            </p>

            <div style={{ backgroundColor: 'var(--color-surface-container-low)', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
              <div><strong>Indicado por:</strong> {modalCliente.ambassador_name} (@{modalCliente.ambassador_username})</div>
              <div style={{ marginTop: '4px' }}><strong>Cidade:</strong> {modalCliente.cidade || '—'} · <strong>Compras:</strong> {modalCliente.total_compras} ({formatCurrency(modalCliente.valor_total_gasto)})</div>
            </div>

            {planos.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: '8px' }}>PLANO DE COMISSÃO</label>
                <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', fontSize: '14px' }}>
                  {planos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalCliente(null)} disabled={isPending} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'transparent', color: 'var(--color-on-surface)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handlePromote} disabled={isPending} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                {isPending ? 'Promovendo...' : 'Confirmar Promoção'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
