'use client';
import type { Driver } from '@/models/types';
import {
  VEHICLE_TYPE_LABELS, DRIVER_STATUS_LABELS,
  formatCompensationRule, formatPhone,
} from '@/utils/formatDriverCompensation';

interface Props {
  drivers: Driver[];
  onEdit: (driver: Driver) => void;
  onViewDetails: (driver: Driver) => void;
  onToggleStatus: (driver: Driver) => void;
}

const statusColors: Record<string, { bg: string; color: string }> = {
  active:   { bg: '#DCFCE7', color: '#166534' },
  inactive: { bg: '#F3F4F6', color: '#6B7280' },
};

export default function DriversTable({ drivers, onEdit, onViewDetails, onToggleStatus }: Props) {
  if (drivers.length === 0) {
    return (
      <div style={{
        padding: '60px 24px', textAlign: 'center',
        border: '1px solid var(--color-outline-variant)',
        borderRadius: '16px', backgroundColor: 'var(--color-surface)',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-outline)', display: 'block', marginBottom: '12px' }}>directions_car</span>
        <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-on-surface)' }}>Nenhum motorista encontrado</p>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>Ajuste os filtros ou cadastre um novo motorista.</p>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid var(--color-outline-variant)', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
          <thead style={{ backgroundColor: 'var(--color-surface-container-highest)' }}>
            <tr>
              {['Motorista', 'Veículo', 'Cidade', 'Modelo de Remuneração', 'Status', 'Ações'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left', fontSize: '11px',
                  fontWeight: 800, color: 'var(--color-on-surface-variant)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderBottom: '1px solid var(--color-outline-variant)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver, i) => {
              const sc = statusColors[driver.status] || statusColors.inactive;
              const isLast = i === drivers.length - 1;
              return (
                <tr
                  key={driver.id}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid var(--color-outline-variant)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                  onClick={() => onViewDetails(driver)}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-container)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Motorista */}
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                      {driver.full_name}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                      {formatPhone(driver.phone)}
                    </p>
                  </td>

                  {/* Veículo */}
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-on-surface)' }}>
                    {driver.vehicle_type ? (
                      <span>
                        <strong>{VEHICLE_TYPE_LABELS[driver.vehicle_type] || driver.vehicle_type}</strong>
                        {driver.vehicle_plate && (
                          <span style={{ marginLeft: '6px', fontFamily: 'monospace', fontSize: '11px', backgroundColor: 'var(--color-surface-container)', padding: '2px 6px', borderRadius: '4px' }}>
                            {driver.vehicle_plate}
                          </span>
                        )}
                      </span>
                    ) : '—'}
                  </td>

                  {/* Cidade */}
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                    {driver.city || '—'}
                  </td>

                  {/* Remuneração */}
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--color-on-surface)', maxWidth: '240px' }}>
                    {formatCompensationRule(driver)}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                      fontSize: '11px', fontWeight: 700,
                      backgroundColor: sc.bg, color: sc.color,
                    }}>
                      {DRIVER_STATUS_LABELS[driver.status] || driver.status}
                    </span>
                  </td>

                  {/* Ações */}
                  <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        onClick={() => onEdit(driver)}
                        title="Editar"
                        style={{
                          padding: '6px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)',
                          backgroundColor: 'var(--color-surface)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>edit</span>
                      </button>
                      <button
                        onClick={() => onToggleStatus(driver)}
                        title={driver.status === 'active' ? 'Inativar' : 'Ativar'}
                        style={{
                          padding: '6px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)',
                          backgroundColor: 'var(--color-surface)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{
                          fontSize: '16px',
                          color: driver.status === 'active' ? 'var(--color-error, #EF4444)' : '#22C55E',
                        }}>
                          {driver.status === 'active' ? 'person_off' : 'person_check'}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
