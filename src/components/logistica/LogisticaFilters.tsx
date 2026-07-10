'use client';

import React from 'react';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  bairroFilter: string;
  onBairroChange: (v: string) => void;
  motoristaFilter: string;
  onMotoristaChange: (v: string) => void;
  pagamentoFilter: string;
  onPagamentoChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  onClear: () => void;
  bairros: string[];
  motoristas: string[];
}

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'pronto_para_entrega', label: 'Pronto para Entrega' },
  { value: 'em_rota', label: 'Em Rota de Entrega' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const PAGAMENTO_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pix', label: 'PIX' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--color-outline-variant)',
  backgroundColor: 'var(--color-surface)',
  fontFamily: 'var(--font-body)',
  fontSize: '13px',
  color: 'var(--color-on-surface)',
  outline: 'none',
};

export default function LogisticaFilters({
  search, onSearchChange,
  statusFilter, onStatusChange,
  bairroFilter, onBairroChange,
  motoristaFilter, onMotoristaChange,
  pagamentoFilter, onPagamentoChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
  onClear,
  bairros,
  motoristas,
}: Props) {
  const hasActiveFilter = search || statusFilter !== 'todos' || bairroFilter || motoristaFilter ||
    pagamentoFilter !== 'todos' || dateFrom || dateTo;

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-outline-variant)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}>
      {/* Linha 1: Busca + Status + Pagamento */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Busca */}
        <div style={{ flex: '2 1 240px', position: 'relative' }}>
          <span className="material-symbols-outlined" style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '18px', color: 'var(--color-outline)',
          }}>search</span>
          <input
            type="text"
            placeholder="Buscar por cliente, telefone ou nº do pedido..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '38px' }}
          />
        </div>

        {/* Status */}
        <div style={{ flex: '1 1 180px' }}>
          <select value={statusFilter} onChange={e => onStatusChange(e.target.value)} style={inputStyle}>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Pagamento */}
        <div style={{ flex: '1 1 140px' }}>
          <select value={pagamentoFilter} onChange={e => onPagamentoChange(e.target.value)} style={inputStyle}>
            {PAGAMENTO_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Linha 2: Bairro + Motorista + Datas + Limpar */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Bairro */}
        <div style={{ flex: '1 1 160px' }}>
          <select value={bairroFilter} onChange={e => onBairroChange(e.target.value)} style={inputStyle}>
            <option value="">Todos os Bairros</option>
            {bairros.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Motorista */}
        <div style={{ flex: '1 1 160px' }}>
          <select value={motoristaFilter} onChange={e => onMotoristaChange(e.target.value)} style={inputStyle}>
            <option value="">Todos os Motoristas</option>
            {motoristas.length === 0 && <option value="" disabled>Nenhum motorista cadastrado</option>}
            {motoristas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Data de */}
        <div style={{ flex: '1 1 140px' }}>
          <input
            type="date"
            value={dateFrom}
            onChange={e => onDateFromChange(e.target.value)}
            style={inputStyle}
            title="Data de início"
          />
        </div>

        {/* Data até */}
        <div style={{ flex: '1 1 140px' }}>
          <input
            type="date"
            value={dateTo}
            onChange={e => onDateToChange(e.target.value)}
            style={inputStyle}
            title="Data de fim"
          />
        </div>

        {/* Limpar */}
        {hasActiveFilter && (
          <button
            onClick={onClear}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'transparent',
              color: 'var(--color-error)',
              cursor: 'pointer',
              fontFamily: 'var(--font-headline)',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>filter_alt_off</span>
            Limpar Filtros
          </button>
        )}
      </div>
    </div>
  );
}
