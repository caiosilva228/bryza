'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import {
  getSignedPhotoUrl,
  alterarStatus,
  getEmbaixadoresNetworkStats,
  getEmbaixadoresActivationStatus,
  ativarEmbaixadoresEmLote,
  ativarComissoesMensaisEmLote,
  type AmbassadorActivationStatus,
  type AmbassadorBulkActionResult,
} from './actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';

interface EmbaixadorItem {
  id: string;
  user_id: string | null;
  full_name: string;
  display_name: string;
  username: string;
  referral_code: string;
  phone: string;
  email: string;
  instagram: string;
  city: string;
  state: string;
  plano_nome: string;
  status: 'pendente' | 'ativo' | 'inativo' | 'bloqueado';
  created_at: string;
  photo_path: string | null;
  total_vendas: number;
  comissao_liberada: number;
  total_recebido: number;
}

interface NetworkStat {
  ambassador_id: string;
  clients_active: number;
  clients_inactive: number;
  sub_ambassadors_active: number;
  sub_ambassadors_inactive: number;
}

interface TableProps {
  lista: EmbaixadorItem[];
  onRefresh: () => void;
  sortBy?: string | null;
  sortOrder?: 'asc' | 'desc' | null;
  onSort?: (key: string) => void;
}

function isMissingServerActionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to find server action|server action.*(?:was )?not found on the server/i.test(message);
}

export default function EmbaixadoresTable({ lista, onRefresh, sortBy, sortOrder, onSort }: TableProps) {
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [networkStats, setNetworkStats] = useState<Record<string, NetworkStat>>({});
  const [activationStats, setActivationStats] = useState<Record<string, AmbassadorActivationStatus>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activationTargets, setActivationTargets] = useState<EmbaixadorItem[]>([]);
  const [activationReason, setActivationReason] = useState('');
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [isBulkPending, startBulkTransition] = useTransition();
  const [isActivationPending, startActivationTransition] = useTransition();

  const selectedSet = new Set(selectedIds);
  const allSelected = lista.length > 0 && lista.every((item) => selectedSet.has(item.id));
  const someSelected = lista.some((item) => selectedSet.has(item.id));
  const inactiveSelected = lista.filter(
    (item) => selectedSet.has(item.id) && (item.status !== 'ativo' || !item.user_id)
  );
  const commissionEligibleSelected = lista.filter(
    (item) => selectedSet.has(item.id)
      && item.status === 'ativo'
      && activationStats[item.id]
      && !activationStats[item.id].qualified
  );

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => lista.some((item) => item.id === id)));
  }, [lista]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [allSelected, someSelected]);

  useEffect(() => {
    const fetchPhotos = async () => {
      const urls: Record<string, string> = {};
      const promises = lista.map(async (item) => {
        if (item.photo_path) {
          try {
            const url = await getSignedPhotoUrl(item.photo_path);
            if (url) urls[item.id] = url;
          } catch (e) {
            console.error('Erro ao buscar signed URL para foto:', e);
          }
        }
      });
      await Promise.all(promises);
      setPhotoUrls(urls);
    };

    const fetchNetworkStats = async () => {
      if (!lista.length) return;
      try {
        const ids = lista.map((i) => i.id);
        const stats = await getEmbaixadoresNetworkStats(ids);
        const map: Record<string, NetworkStat> = {};
        stats.forEach((s) => { map[s.ambassador_id] = s; });
        setNetworkStats(map);
      } catch (e) {
        console.error('Erro ao buscar stats de rede:', e);
      }
    };

    const fetchActivationStats = async () => {
      if (!lista.length) return;
      try {
        const ids = lista.map((item) => item.id);
        const statuses = await getEmbaixadoresActivationStatus(ids);
        const map: Record<string, AmbassadorActivationStatus> = {};
        statuses.forEach((status) => { map[status.ambassador_id] = status; });
        setActivationStats(map);
      } catch (e) {
        console.error('Erro ao buscar ativações mensais:', e);
      }
    };

    fetchPhotos();
    fetchNetworkStats();
    fetchActivationStats();
  }, [lista]);

  const handleStatusChange = async (id: string, newStatus: string, name: string) => {
    try {
      const result = await alterarStatus(id, newStatus);
      toast.success(
        result.accountCreated
          ? `Status de ${name} alterado para ativo. O acesso foi criado: login e senha temporária usam o telefone canônico.`
          : `Status de ${name} alterado para ${newStatus}.`,
      );
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar status.');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    ));
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : lista.map((item) => item.id));
  };

  const showBulkResult = (
    result: AmbassadorBulkActionResult,
    processedLabel: string,
    alreadyLabel: string
  ) => {
    if (result.processed > 0) {
      toast.success(`${result.processed} ${processedLabel}`);
    } else if (result.alreadyActive > 0 && result.failed === 0) {
      toast.success(`${result.alreadyActive} ${alreadyLabel}`);
    }

    const notProcessed = result.skipped + result.failed;
    if (notProcessed > 0) {
      toast.warning(`${notProcessed} seleção(ões) não puderam ser processadas.`);
    }
  };

  const handleBulkStatusActivation = () => {
    if (!selectedIds.length || isBulkPending) return;

    startBulkTransition(async () => {
      try {
        const result = await ativarEmbaixadoresEmLote(selectedIds);
        showBulkResult(
          result,
          'embaixador(es) ativado(s).',
          'embaixador(es) já estavam ativos.'
        );
        setSelectedIds([]);
        onRefresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao ativar embaixadores.');
      }
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string; label: string }> = {
      pendente: { bg: '#FEF3C7', text: '#D97706', label: 'Pendente' },
      ativo: { bg: '#D1FAE5', text: '#059669', label: 'Ativo' },
      inativo: { bg: '#F3F4F6', text: '#4B5563', label: 'Inativo' },
      bloqueado: { bg: '#FEE2E2', text: '#DC2626', label: 'Bloqueado' }
    };
    const badge = colors[status] || { bg: '#F3F4F6', text: '#4B5563', label: status };
    return (
      <span style={{
        backgroundColor: badge.bg,
        color: badge.text,
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600
      }}>
        {badge.label}
      </span>
    );
  };

  const getActivationBadge = (activation?: AmbassadorActivationStatus) => {
    if (!activation) {
      return <span style={{ color: 'var(--color-outline)', fontSize: '12px' }}>Carregando...</span>;
    }

    if (activation.qualified) {
      const isAdministrative = activation.status === 'exception';
      return (
        <span style={{
          backgroundColor: isAdministrative ? '#EDE9FE' : '#D1FAE5',
          color: isAdministrative ? '#6D28D9' : '#047857',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}>
          {isAdministrative ? 'Ativação administrativa' : 'Comissões ativas'}
        </span>
      );
    }

    return (
      <span style={{
        backgroundColor: '#FEF3C7',
        color: '#B45309',
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}>
        Comissões inativas
      </span>
    );
  };

  const handleCommissionActivation = () => {
    if (!activationTargets.length) return;

    startActivationTransition(async () => {
      try {
        const result = await ativarComissoesMensaisEmLote(
          activationTargets.map((target) => target.id),
          activationReason
        );
        showBulkResult(
          result,
          'comissão(ões) ativada(s) até o fim do mês.',
          'comissão(ões) já estavam ativas.'
        );
        setActivationTargets([]);
        setActivationReason('');
        setSelectedIds([]);
        onRefresh();
      } catch (error) {
        if (isMissingServerActionError(error)) {
          window.location.reload();
          return;
        }
        toast.error(error instanceof Error ? error.message : 'Erro ao ativar comissões.');
      }
    });
  };

  const renderTh = (label: string, key?: string, align: 'left' | 'center' | 'right' = 'left') => {
    if (!key || !onSort) {
      return (
        <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)', textAlign: align, whiteSpace: 'nowrap' }}>
          {label}
        </th>
      );
    }

    const isSorted = sortBy === key;
    return (
      <th
        onClick={() => onSort(key)}
        style={{
          padding: '16px 20px',
          fontWeight: 600,
          color: isSorted ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
          cursor: 'pointer',
          userSelect: 'none',
          textAlign: align,
          whiteSpace: 'nowrap',
        }}
        title={`Clique para ordenar (1º Maior→Menor, 2º Menor→Maior, 3º Zera)`}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
          <span>{label}</span>
          {isSorted ? (
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary)', fontWeight: 700 }}>
              {sortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
            </span>
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline-variant)', opacity: 0.4 }}>
              unfold_more
            </span>
          )}
        </div>
      </th>
    );
  };

  return (
    <>
    <div style={{
      minHeight: '64px',
      padding: '12px 20px',
      borderBottom: '1px solid var(--color-outline-variant)',
      backgroundColor: selectedIds.length ? '#F5F3FF' : 'var(--color-surface-container-low)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap',
    }}>
      <label style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '9px',
        color: 'var(--color-on-surface)',
        fontSize: '13px',
        fontWeight: 700,
        cursor: isBulkPending ? 'not-allowed' : 'pointer',
      }}>
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          disabled={isBulkPending || isActivationPending}
          aria-label="Selecionar todos os embaixadores desta página"
          style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
        />
        Selecionar todos desta página
        {selectedIds.length > 0 && (
          <span style={{
            borderRadius: '999px',
            backgroundColor: '#6D28D9',
            color: '#FFFFFF',
            padding: '3px 9px',
            fontSize: '11px',
          }}>
            {selectedIds.length} selecionado(s)
          </span>
        )}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={!inactiveSelected.length || isBulkPending || isActivationPending}
          onClick={handleBulkStatusActivation}
          style={{
            padding: '9px 14px',
            borderRadius: '9px',
            border: '1px solid rgba(5, 150, 105, 0.3)',
            backgroundColor: '#ECFDF5',
            color: '#047857',
            cursor: !inactiveSelected.length || isBulkPending || isActivationPending ? 'not-allowed' : 'pointer',
            opacity: !inactiveSelected.length || isBulkPending || isActivationPending ? 0.55 : 1,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
          {isBulkPending ? 'Ativando...' : `Ativar embaixador${inactiveSelected.length === 1 ? '' : 'es'}`}
        </button>
        <button
          type="button"
          disabled={!commissionEligibleSelected.length || isBulkPending || isActivationPending}
          onClick={() => {
            setActivationTargets(commissionEligibleSelected);
            setActivationReason('');
          }}
          style={{
            padding: '9px 14px',
            borderRadius: '9px',
            border: '1px solid rgba(109, 40, 217, 0.3)',
            backgroundColor: '#F5F3FF',
            color: '#6D28D9',
            cursor: !commissionEligibleSelected.length || isBulkPending || isActivationPending ? 'not-allowed' : 'pointer',
            opacity: !commissionEligibleSelected.length || isBulkPending || isActivationPending ? 0.55 : 1,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>paid</span>
          {commissionEligibleSelected.length > 1
            ? `Ativar ${commissionEligibleSelected.length} comissões`
            : 'Ativar comissão'}
        </button>
      </div>
    </div>
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        textAlign: 'left',
        fontSize: '14px'
      }}>
        <thead>
          <tr style={{
            borderBottom: '1px solid var(--color-outline-variant)',
            backgroundColor: 'var(--color-surface-container-low)'
          }}>
            <th style={{ padding: '16px 12px', textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={isBulkPending || isActivationPending}
                aria-label="Selecionar todos os embaixadores desta página"
                style={{ width: '17px', height: '17px', accentColor: 'var(--color-primary)' }}
              />
            </th>
            {renderTh('Foto')}
            {renderTh('Nome / Exibição', 'nome')}
            {renderTh('Usuário/Código', 'username')}
            {renderTh('Telefone', 'telefone')}
            {renderTh('Instagram')}
            {renderTh('Cidade', 'cidade')}
            {renderTh('Plano', 'plano')}
            {renderTh('Vendas', 'vendas', 'center')}
            {renderTh('C. Liberada', 'comissao_liberada', 'right')}
            {renderTh('Total Pago', 'total_recebido', 'right')}
            {renderTh('Rede')}
            {renderTh('Comissões')}
            {renderTh('Status', 'status')}
            {renderTh('Cadastro', 'created_at')}
            {renderTh('Ações', undefined, 'center')}
          </tr>
        </thead>
        <tbody>
          {lista.map((item) => {
            const photoUrl = photoUrls[item.id] || null;
            const net = networkStats[item.id];
            return (
              <tr key={item.id} style={{
                borderBottom: '1px solid var(--color-outline-variant)',
                transition: 'background-color 0.15s ease'
              }} className="table-row-hover">
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    disabled={isBulkPending || isActivationPending}
                    aria-label={`Selecionar ${item.full_name}`}
                    style={{ width: '17px', height: '17px', accentColor: 'var(--color-primary)' }}
                  />
                </td>
                {/* Foto */}
                <td style={{ padding: '12px 20px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-surface-container-high)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--color-outline-variant)'
                  }}>
                    {photoUrl ? (
                      <img src={photoUrl} alt={item.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-outline)' }}>person</span>
                    )}
                  </div>
                </td>

                {/* Nome */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>{item.full_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>{item.display_name}</div>
                </td>

                {/* Código/Usuário */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap', fontFamily: 'monospace', fontWeight: 700 }}>
                  {item.username}
                </td>

                {/* Telefone */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap', color: 'var(--color-on-surface-variant)' }}>
                  {item.phone || '-'}
                </td>

                {/* Instagram */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  {item.instagram ? (
                    <a 
                      href={`https://instagram.com/${item.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}
                    >
                      {item.instagram}
                    </a>
                  ) : '-'}
                </td>

                {/* Cidade */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  {item.city ? `${item.city} - ${item.state || ''}` : '-'}
                </td>

                {/* Plano */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  {item.plano_nome}
                </td>

                {/* Vendas */}
                <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 700 }}>
                  {item.total_vendas}
                </td>

                {/* Comissao Liberada */}
                <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--color-success, #059669)' }}>
                  {formatCurrency(item.comissao_liberada)}
                </td>

                {/* Total Recebido */}
                <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>
                  {formatCurrency(item.total_recebido)}
                </td>

                {/* Rede */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  {net ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)' }}>person</span>
                        <span style={{ color: '#059669', fontWeight: 700 }}>{net.clients_active}</span>
                        {net.clients_inactive > 0 && <span style={{ color: 'var(--color-on-surface-variant)' }}>+{net.clients_inactive} in.</span>}
                        <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px' }}>clientes</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)' }}>workspace_premium</span>
                        <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{net.sub_ambassadors_active}</span>
                        {net.sub_ambassadors_inactive > 0 && <span style={{ color: 'var(--color-on-surface-variant)' }}>+{net.sub_ambassadors_inactive} in.</span>}
                        <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px' }}>emb.</span>
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>—</span>
                  )}
                </td>

                {/* Ativação mensal de comissões */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  {getActivationBadge(activationStats[item.id])}
                </td>

                {/* Status */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  {getStatusBadge(item.status)}
                </td>

                {/* Cadastro */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap', color: 'var(--color-on-surface-variant)' }}>
                  {formatDate(item.created_at)}
                </td>

                {/* Ações */}
                <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <Link 
                      href={`/embaixadores/${item.id}`}
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        color: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--color-primary-container)'
                      }}
                      title="Visualizar Detalhes"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                    </Link>

                    <Link 
                      href={`/embaixadores/${item.id}/editar`}
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        color: 'var(--color-outline)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--color-outline-variant)'
                      }}
                      title="Editar Cadastro"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                    </Link>

                    {(item.status !== 'ativo' || !item.user_id) && (
                      <button
                        onClick={() => handleStatusChange(item.id, 'ativo', item.full_name)}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          color: '#059669',
                          border: '1px solid rgba(5, 150, 105, 0.2)',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={item.status === 'ativo' ? 'Criar acesso' : 'Ativar Conta'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                          {item.status === 'ativo' ? 'key' : 'check_circle'}
                        </span>
                      </button>
                    )}

                    {item.status === 'ativo' && (
                      <button
                        onClick={() => handleStatusChange(item.id, 'inativo', item.full_name)}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          color: '#D97706',
                          border: '1px solid rgba(217, 119, 6, 0.2)',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Inativar Conta"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>block</span>
                      </button>
                    )}

                    {item.status === 'ativo' && activationStats[item.id] && !activationStats[item.id].qualified && (
                      <button
                        onClick={() => {
                          setActivationTargets([item]);
                          setActivationReason('');
                        }}
                        aria-label={`Ativar comissões de ${item.full_name}`}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          color: '#6D28D9',
                          border: '1px solid rgba(109, 40, 217, 0.25)',
                          backgroundColor: '#F5F3FF',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Ativar comissões até o fim do mês"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>paid</span>
                      </button>
                    )}

                    {item.status !== 'bloqueado' && (
                      <button
                        onClick={() => handleStatusChange(item.id, 'bloqueado', item.full_name)}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          color: '#DC2626',
                          border: '1px solid rgba(220, 38, 38, 0.2)',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Bloquear Acesso"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {activationTargets.length > 0 && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activation-dialog-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !isActivationPending) {
            setActivationTargets([]);
            setActivationReason('');
          }
        }}
      >
        <div style={{
          width: '100%',
          maxWidth: '500px',
          borderRadius: '18px',
          backgroundColor: 'var(--color-surface)',
          padding: '28px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: '#EDE9FE',
            color: '#6D28D9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>paid</span>
          </div>
          <h2 id="activation-dialog-title" style={{ margin: '0 0 8px', fontSize: '21px' }}>
            {activationTargets.length === 1 ? 'Ativar comissão' : 'Ativar comissões em lote'}
          </h2>
          <p style={{ margin: '0 0 20px', color: 'var(--color-on-surface-variant)', fontSize: '14px', lineHeight: 1.5 }}>
            {activationTargets.length === 1 ? (
              <>
                <strong>{activationTargets[0].full_name}</strong> ficará ativo para receber novas comissões até o último dia deste mês.
              </>
            ) : (
              <>
                As comissões de <strong>{activationTargets.length} embaixadores</strong> serão ativadas até o último dia deste mês.
              </>
            )}
            {' '}Comissões anteriores não serão pagas retroativamente.
          </p>
          <label htmlFor="activation-reason" style={{
            display: 'block',
            marginBottom: '7px',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--color-on-surface-variant)',
          }}>
            MOTIVO DA ATIVAÇÃO
          </label>
          <textarea
            id="activation-reason"
            value={activationReason}
            onChange={(event) => setActivationReason(event.target.value)}
            minLength={5}
            maxLength={500}
            rows={4}
            disabled={isActivationPending}
            autoFocus
            placeholder="Ex.: ativação administrativa autorizada pela gestão"
            style={{
              width: '100%',
              resize: 'vertical',
              borderRadius: '10px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-on-surface)',
              padding: '12px',
              font: 'inherit',
            }}
          />
          <p style={{ margin: '6px 0 22px', fontSize: '11px', color: 'var(--color-outline)' }}>
            O motivo e o administrador responsável ficarão registrados na auditoria.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              disabled={isActivationPending}
              onClick={() => {
                setActivationTargets([]);
                setActivationReason('');
              }}
              style={{
                padding: '10px 18px',
                borderRadius: '9px',
                border: '1px solid var(--color-outline-variant)',
                backgroundColor: 'transparent',
                color: 'var(--color-on-surface)',
                cursor: isActivationPending ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isActivationPending || activationReason.trim().length < 5}
              onClick={handleCommissionActivation}
              style={{
                padding: '10px 20px',
                borderRadius: '9px',
                border: 'none',
                backgroundColor: '#6D28D9',
                color: '#FFFFFF',
                cursor: isActivationPending || activationReason.trim().length < 5 ? 'not-allowed' : 'pointer',
                opacity: isActivationPending || activationReason.trim().length < 5 ? 0.55 : 1,
                fontWeight: 700,
              }}
            >
              {isActivationPending
                ? 'Ativando...'
                : activationTargets.length === 1
                  ? 'Confirmar ativação'
                  : `Ativar ${activationTargets.length} comissões`}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
