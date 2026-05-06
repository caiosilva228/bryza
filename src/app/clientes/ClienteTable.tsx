'use client';

import { Cliente } from '@/models/types';
import { useState, useMemo } from 'react';
import ClienteInfoModal from './ClienteInfoModal';
import { formatDate } from '@/utils/format';
import { useIsMobile } from '@/hooks/useIsMobile';
import Pagination from '@/components/ui/Pagination';


interface ClienteTableProps {
  clientes: Cliente[];
}

type SortKey = 'codigo' | 'nome' | 'cidade' | 'vendedor' | 'status' | 'atividade';
type SortDirection = 'asc' | 'desc';

const textCollator = new Intl.Collator('pt-BR', {
  sensitivity: 'base',
  numeric: true,
});

const getLastPurchaseTimestamp = (cliente: Cliente) => {
  if (!cliente.data_ultima_compra) {
    return null;
  }

  const timestamp = new Date(cliente.data_ultima_compra).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

export default function ClienteTable({ clientes }: ClienteTableProps) {
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const isMobile = useIsMobile();

  const sortedClientes = useMemo(() => {
    if (!sortKey) {
      return clientes;
    }

    const sorted = [...clientes];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'codigo':
          comparison = (a.codigo_cliente || 0) - (b.codigo_cliente || 0);
          break;
        case 'nome':
          comparison = textCollator.compare(a.nome || '', b.nome || '');
          break;
        case 'cidade':
          comparison = textCollator.compare(
            `${a.cidade || ''} ${a.estado || ''}`,
            `${b.cidade || ''} ${b.estado || ''}`
          );
          break;
        case 'vendedor':
          comparison = textCollator.compare(
            a.vendedor?.nome || 'Sem vendedor',
            b.vendedor?.nome || 'Sem vendedor'
          );
          break;
        case 'status':
          comparison = textCollator.compare(a.status_cliente || '', b.status_cliente || '');
          break;
        case 'atividade': {
          const aTimestamp = getLastPurchaseTimestamp(a);
          const bTimestamp = getLastPurchaseTimestamp(b);

          if (aTimestamp === null && bTimestamp === null) {
            comparison = textCollator.compare(a.nome || '', b.nome || '');
            break;
          }

          if (aTimestamp === null) {
            comparison = -1;
            break;
          }

          if (bTimestamp === null) {
            comparison = 1;
            break;
          }

          comparison = aTimestamp - bTimestamp;
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [clientes, sortDirection, sortKey]);

  const paginatedClientes = useMemo(() => {
    return sortedClientes.slice((page - 1) * pageSize, page * pageSize);
  }, [page, pageSize, sortedClientes]);

  const handleSort = (key: SortKey) => {
    setPage(1);

    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
      return;
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc');
      return;
    }

    setSortKey(null);
    setSortDirection('asc');
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return 'unfold_more';
    }

    return sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
  };

  const getSortHint = (key: SortKey) => {
    if (sortKey !== key) {
      if (key === 'atividade') {
        return 'Ordenar pela ultima compra';
      }

      if (key === 'codigo') {
        return 'Ordenar em ordem crescente';
      }

      return 'Ordenar em ordem alfabetica';
    }

    if (sortDirection === 'asc') {
      return 'Ordenacao crescente ativa. Clique para inverter.';
    }

    return 'Ordenacao decrescente ativa. Clique para limpar.';
  };

  const renderSortableHeader = (label: string, key: SortKey) => {
    const isActive = sortKey === key;

    return (
      <th
        aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        style={{ padding: 0 }}
      >
        <button
          type="button"
          onClick={() => handleSort(key)}
          title={getSortHint(key)}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            cursor: 'pointer',
            color: isActive ? 'var(--color-primary)' : 'var(--color-on-surface)',
            fontSize: '11px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textAlign: 'left',
          }}
        >
          <span>{label}</span>
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: '16px',
              color: isActive ? 'var(--color-primary)' : 'var(--color-outline)',
            }}
          >
            {getSortIcon(key)}
          </span>
        </button>
      </th>
    );
  };


  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === clientes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clientes.map(c => c.id)));
    }
  };

  const baixarCSV = () => {
    const selectedClientes = clientes.filter(c => selectedIds.has(c.id));
    
    // Header do CSV
    const headers = [
      'Código', 
      'Nome', 
      'Telefone', 
      'Email', 
      'Cidade', 
      'Estado', 
      'Origem', 
      'Vendedor', 
      'Status', 
      'Dias Inativo',
      'Data Cadastro',
      'Última Compra'
    ];

    // Mapear dados para linhas com separador ;
    const rows = selectedClientes.map(c => [
      `C${String(c.codigo_cliente || 0).padStart(5, '0')}`,
      c.nome,
      c.telefone || '',
      c.cidade || '',
      c.estado || '',
      c.origem || 'Direto',
      c.vendedor?.nome || 'N/A',
      c.status_cliente,
      c.dias_sem_comprar || 0,
      c.data_cadastro ? formatDate(c.data_cadastro) : '',
      c.data_ultima_compra ? formatDate(c.data_ultima_compra) : ''
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'));

    // Combinar tudo com BOM UTF-8 para o Excel reconhecer acentos e colunas
    const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `clientes_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusStyle = (status?: string) => {
    const s = status?.toLowerCase();
    if (s === 'cliente') return { bg: '#e8f5e9', text: '#2e7d32', border: '#2e7d32' };
    if (s === 'recorrente') return { bg: '#e3f2fd', text: '#1565c0', border: '#1565c0' };
    if (s === 'inativo') return { bg: '#fbe9e7', text: '#d32f2f', border: '#d32f2f' };
    return { bg: '#eee', text: '#555', border: '#ccc' };
  };

  // ── Barra de ações em massa (shared por ambas as views) ────────────────
  const BulkBar = () =>
    selectedIds.size > 0 ? (
      <div style={{ 
        position: 'sticky', 
        top: '0', 
        zIndex: 10, 
        backgroundColor: 'var(--color-primary-container)', 
        padding: '12px 20px', 
        borderRadius: '4px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid var(--color-primary)'
      }}>
        <span style={{ fontWeight: 850, color: 'var(--color-on-primary-container)', fontSize: '13px', textTransform: 'uppercase' }}>
          {selectedIds.size} {selectedIds.size === 1 ? 'cliente selecionado' : 'clientes selecionados'}
        </span>
        <button 
          onClick={baixarCSV}
          style={{ 
            backgroundColor: 'var(--color-primary)', 
            color: 'var(--color-on-primary)', 
            border: 'none', 
            borderRadius: '4px', 
            padding: '8px 16px', 
            fontWeight: 900, 
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
          EXPORTAR CSV
        </button>
      </div>
    ) : null;

  // ── VIEW MOBILE — Cards ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <BulkBar />

        {/* Seleção em massa mobile */}
        {clientes.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            marginBottom: '8px',
            backgroundColor: 'var(--color-surface-container-low)',
            borderRadius: '8px',
            border: '1px solid var(--color-outline-variant)',
          }}>
            <input 
              type="checkbox" 
              checked={selectedIds.size === clientes.length && clientes.length > 0} 
              onChange={toggleSelectAll}
              style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
              Selecionar todos ({clientes.length})
            </span>
          </div>
        )}

        {clientes.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
            Nenhum cliente disponível.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {paginatedClientes.map(cliente => {

              const statusStyle = getStatusStyle(cliente.status_cliente);
              const isSelected = selectedIds.has(cliente.id);

              return (
                <div
                  key={cliente.id}
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--color-secondary-container)'
                      : 'var(--color-surface-container-lowest)',
                    border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    transition: 'background-color 0.15s ease, border-color 0.15s ease',
                  }}
                >
                  {/* Linha 1: Checkbox + Código + Nome + Status */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(cliente.id)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--color-primary)', marginTop: '2px', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          backgroundColor: '#f0f0f0',
                          padding: '2px 6px',
                          borderRadius: '2px',
                          border: '1px solid #ddd',
                          color: 'var(--color-on-surface)',
                          flexShrink: 0,
                        }}>
                          C{String(cliente.codigo_cliente || 0).padStart(5, '0')}
                        </span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '2px',
                          fontSize: '10px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.text,
                          border: `1px solid ${statusStyle.text}`,
                        }}>
                          {cliente.status_cliente}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 800, color: 'var(--color-on-surface)', fontSize: '14px', lineHeight: '1.2' }}>
                        {cliente.nome.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Linha 2: Telefone + Cidade */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', paddingLeft: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-outline)' }}>phone</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>
                        {cliente.telefone || '--'}
                      </span>
                    </div>
                    {cliente.cidade && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-outline)' }}>location_on</span>
                        <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>
                          {cliente.cidade} - {cliente.estado}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Linha 3: Vendedor + Última compra + Botão */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '28px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-outline)', fontWeight: 600 }}>
                        {cliente.vendedor?.nome?.toUpperCase() || 'SEM VENDEDOR'}
                      </span>
                      <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 700, marginTop: '2px' }}>
                        ÚLT: {cliente.data_ultima_compra ? formatDate(cliente.data_ultima_compra) : 'NUNCA'}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCliente(cliente)}
                      style={{
                        backgroundColor: 'var(--color-surface-container-high)',
                        border: '1px solid var(--color-outline-variant)',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        color: 'var(--color-on-surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 700,
                        fontSize: '12px',
                        minHeight: '40px',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                      Ver
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Pagination
          total={clientes.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />

        {selectedCliente && (
          <ClienteInfoModal 
            cliente={selectedCliente} 
            onClose={() => setSelectedCliente(null)} 
          />
        )}
      </>
    );
  }


  // ── VIEW DESKTOP — Tabela original (INALTERADA) ────────────────────────
  return (
    <>
      {/* Barra de Ações em Massa */}
      <BulkBar />

      <div style={{ 
        backgroundColor: 'var(--color-surface)', 
        borderRadius: '4px', 
        overflow: 'hidden', 
        border: '1px solid var(--color-outline-variant)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
            <thead style={{ backgroundColor: 'var(--color-surface-container-low)', borderBottom: '2px solid var(--color-outline-variant)' }}>
              <tr>
                <th style={{ padding: '12px 16px', width: '40px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.size === clientes.length && clientes.length > 0} 
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                  />
                </th>
                {renderSortableHeader('Cod', 'codigo')}
                {renderSortableHeader('Cliente / Contato', 'nome')}
                {renderSortableHeader('Localidade', 'cidade')}
                {renderSortableHeader('Vendedor', 'vendedor')}
                {renderSortableHeader('Situação', 'status')}
                {renderSortableHeader('Atividade', 'atividade')}
                <th style={{ padding: '12px 16px', fontWeight: 900, color: 'var(--color-on-surface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
                    Nenhum cliente disponível.
                  </td>
                </tr>
              ) : (
                paginatedClientes.map(cliente => {

                  const statusStyle = getStatusStyle(cliente.status_cliente);
                  return (
                    <tr 
                      key={cliente.id} 
                      style={{ 
                        borderBottom: '1px solid var(--color-outline-variant)',
                        backgroundColor: selectedIds.has(cliente.id) ? 'var(--color-primary-container-low)' : 'transparent'
                      }} 
                      onMouseEnter={(e) => { if (!selectedIds.has(cliente.id)) e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)'; }}
                      onMouseLeave={(e) => { if (!selectedIds.has(cliente.id)) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(cliente.id)} 
                          onChange={() => toggleSelect(cliente.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          color: 'var(--color-on-surface)', 
                          fontSize: '12px', 
                          fontWeight: 800,
                          backgroundColor: '#f0f0f0',
                          padding: '2px 6px',
                          borderRadius: '2px',
                          border: '1px solid #ddd'
                        }}>
                          C{String(cliente.codigo_cliente || 0).padStart(5, '0')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 800, color: 'var(--color-on-surface)', fontSize: '13px' }}>{cliente.nome.toUpperCase()}</span>
                          <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>TEL: {cliente.telefone || '--'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--color-on-surface)', fontWeight: 600 }}>
                          {cliente.cidade?.toUpperCase()} - {cliente.estado?.toUpperCase()}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-on-surface)', fontSize: '12px' }}>
                            {cliente.vendedor?.nome?.toUpperCase() || 'SEM VENDEDOR'}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--color-outline)', fontWeight: 800 }}>
                            {cliente.vendedor ? `ID: V${String(cliente.vendedor.codigo_vendedor || 0).padStart(3, '0')}` : '--'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '2px', 
                          fontSize: '10px', 
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.text,
                          border: `1px solid ${statusStyle.text}`,
                          display: 'inline-block'
                        }}>
                          {cliente.status_cliente}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--color-on-surface)', fontWeight: 600 }}>
                            CAD: {cliente.data_cadastro ? formatDate(cliente.data_cadastro) : '--'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 800 }}>
                            ULT: {cliente.data_ultima_compra ? formatDate(cliente.data_ultima_compra) : 'NUNCA'}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button 
                          onClick={() => setSelectedCliente(cliente)}
                          style={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #ccc', 
                            borderRadius: '4px', 
                            padding: '6px 12px', 
                            color: '#333', 
                            cursor: 'pointer', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            fontWeight: 800,
                            fontSize: '11px',
                            textTransform: 'uppercase'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        total={clientes.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />

      {selectedCliente && (
        <ClienteInfoModal 
          cliente={selectedCliente} 
          onClose={() => setSelectedCliente(null)} 
        />
      )}
    </>
  );
}
