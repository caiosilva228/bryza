'use client';
import { useState, useMemo } from 'react';
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
  const [sortConfig, setSortConfig] = useState<{ key: keyof Driver, direction: 'asc' | 'desc' } | null>(null);

  const sortedDrivers = useMemo(() => {
    if (!sortConfig) return drivers;
    
    const sorted = [...drivers];
    sorted.sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];
      
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [drivers, sortConfig]);

  const requestSort = (key: keyof Driver) => {
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        setSortConfig({ key, direction: 'desc' });
      } else {
        setSortConfig(null);
      }
    } else {
      setSortConfig({ key, direction: 'asc' });
    }
  };

  const getSortIcon = (columnKey: keyof Driver) => {
    if (sortConfig && sortConfig.key === columnKey) {
      return (
        <span className="material-symbols-outlined" style={{ fontSize: '14px', marginLeft: '4px', verticalAlign: 'middle', color: 'var(--color-primary)' }}>
          {sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
        </span>
      );
    }
    return (
      <span className="material-symbols-outlined" style={{ fontSize: '14px', marginLeft: '4px', verticalAlign: 'middle', color: 'var(--color-outline-variant)' }}>
        unfold_more
      </span>
    );
  };

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
              {[
                { label: 'Motorista', key: 'full_name' },
                { label: 'Veículo', key: 'vehicle_type' },
                { label: 'Cidade', key: 'city' },
                { label: 'Modelo de Remuneração', key: 'compensation_type' },
                { label: 'Status', key: 'status' }
              ].map(col => (
                <th key={col.key} style={{
                  padding: '12px 16px', textAlign: 'left', fontSize: '11px',
                  fontWeight: 800, color: 'var(--color-on-surface-variant)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderBottom: '1px solid var(--color-outline-variant)',
                  cursor: 'pointer', userSelect: 'none'
                }} onClick={() => requestSort(col.key as keyof Driver)}>
                  {col.label}
                  {getSortIcon(col.key as keyof Driver)}
                </th>
              ))}
              <th style={{
                  padding: '12px 16px', textAlign: 'left', fontSize: '11px',
                  fontWeight: 800, color: 'var(--color-on-surface-variant)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderBottom: '1px solid var(--color-outline-variant)'
                }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedDrivers.map((driver, i) => {
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
