'use client';

import React from 'react';

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'Planejada', label: 'Planejada' },
  { value: 'Separando Produtos', label: 'Separando Produtos' },
  { value: 'Pronta para Sair', label: 'Pronta para Sair' },
  { value: 'Em Andamento', label: 'Em Andamento' },
  { value: 'Finalizada', label: 'Finalizada' },
  { value: 'Finalizada com Pendências', label: 'Finalizada com Pendências' },
  { value: 'Cancelada', label: 'Cancelada' },
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

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  driverFilter: string;
  onDriverChange: (v: string) => void;
  cityFilter: string;
  onCityChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  onClear: () => void;
  drivers: string[];
  cities: string[];
}

export default function RoutesFilters({
  search, onSearchChange,
  statusFilter, onStatusChange,
  driverFilter, onDriverChange,
  cityFilter, onCityChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
  onClear,
  drivers,
  cities,
}: Props) {
  const hasFilter = search || statusFilter !== 'todos' || driverFilter || cityFilter || dateFrom || dateTo;

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
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 240px', position: 'relative' }}>
          <span className="material-symbols-outlined" style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '18px', color: 'var(--color-outline)',
          }}>search</span>
          <input
            type="text"
            placeholder="Buscar por nome da rota..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '38px' }}
          />
        </div>

        <div style={{ flex: '1 1 180px' }}>
          <select value={statusFilter} onChange={e => onStatusChange(e.target.value)} style={inputStyle}>
            {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>

        <div style={{ flex: '1 1 160px' }}>
          <select value={driverFilter} onChange={e => onDriverChange(e.target.value)} style={inputStyle}>
            <option value="">Todos os Motoristas</option>
            {drivers.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div style={{ flex: '1 1 160px' }}>
          <select value={cityFilter} onChange={e => onCityChange(e.target.value)} style={inputStyle}>
            <option value="">Todas as Cidades</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 140px' }}>
          <input type="date" value={dateFrom} onChange={e => onDateFromChange(e.target.value)} style={inputStyle} title="Data inicial" />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <input type="date" value={dateTo} onChange={e => onDateToChange(e.target.value)} style={inputStyle} title="Data final" />
        </div>

        {hasFilter && (
          <button
            onClick={onClear}
            style={{
              padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'transparent', color: 'var(--color-error)',
              cursor: 'pointer', fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '6px'
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
