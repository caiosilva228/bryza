'use client';
import { COMPENSATION_MODEL_LABELS, VEHICLE_TYPE_LABELS, DRIVER_STATUS_LABELS } from '@/utils/formatDriverCompensation';
import type { DriverCompensationModel } from '@/models/types';

interface Props {
  search: string;
  statusFilter: string;
  compensationFilter: string;
  vehicleFilter: string;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onCompensationChange: (v: string) => void;
  onVehicleChange: (v: string) => void;
  onClear: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: '8px',
  border: '1px solid var(--color-outline-variant)',
  backgroundColor: 'var(--color-surface)', fontSize: '13px',
  fontFamily: 'var(--font-body)', color: 'var(--color-on-surface)', outline: 'none',
};

export default function DriversFilters({
  search, statusFilter, compensationFilter, vehicleFilter,
  onSearchChange, onStatusChange, onCompensationChange, onVehicleChange, onClear,
}: Props) {
  const hasFilters = search || statusFilter !== 'all' || compensationFilter || vehicleFilter;

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
      <div style={{ position: 'relative', flex: '2 1 200px' }}>
        <span className="material-symbols-outlined" style={{
          position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
          fontSize: '18px', color: 'var(--color-outline)',
        }}>search</span>
        <input
          type="text" placeholder="Buscar motorista, telefone, cidade, veículo..."
          value={search} onChange={e => onSearchChange(e.target.value)}
          style={{ ...inputStyle, paddingLeft: '36px', width: '100%' }}
        />
      </div>

      <select value={statusFilter} onChange={e => onStatusChange(e.target.value)} style={{ ...inputStyle, flex: '0 1 130px' }}>
        <option value="all">Todos os status</option>
        {Object.entries(DRIVER_STATUS_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      <select value={compensationFilter} onChange={e => onCompensationChange(e.target.value)} style={{ ...inputStyle, flex: '0 1 200px' }}>
        <option value="">Todos os modelos</option>
        {(Object.entries(COMPENSATION_MODEL_LABELS) as [DriverCompensationModel, string][]).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      <select value={vehicleFilter} onChange={e => onVehicleChange(e.target.value)} style={{ ...inputStyle, flex: '0 1 140px' }}>
        <option value="">Todos os veículos</option>
        {Object.entries(VEHICLE_TYPE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={onClear}
          style={{
            padding: '9px 14px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)',
            backgroundColor: 'transparent', cursor: 'pointer',
            color: 'var(--color-on-surface-variant)', fontSize: '13px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '4px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>filter_list_off</span>
          Limpar
        </button>
      )}
    </div>
  );
}
