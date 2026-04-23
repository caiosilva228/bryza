'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, subDays, startOfMonth } from 'date-fns';

type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month';

export function DashboardFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentData, setCurrentData] = React.useState('');

  React.useEffect(() => {
    const dataParam = searchParams.get('data');
    if (dataParam) {
      setCurrentData(dataParam);
    } else {
      setCurrentData(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [searchParams]);

  const activePreset = searchParams.get('periodo') as Preset | null;
  const hasDateParam = !!searchParams.get('data');

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams();
    if (val) params.set('data', val);
    router.push(`?${params.toString()}`);
  };

  const applyPreset = (preset: Preset) => {
    const params = new URLSearchParams();
    params.set('periodo', preset);
    router.push(`?${params.toString()}`);
  };

  const goToday = () => {
    router.push('?');
  };

  const presets: { key: Preset; label: string }[] = [
    { key: 'today', label: 'Hoje' },
    { key: 'yesterday', label: 'Ontem' },
    { key: '7d', label: '7 Dias' },
    { key: '30d', label: '30 Dias' },
    { key: 'month', label: 'Este Mês' },
  ];

  const isActive = (key: Preset) => {
    if (key === 'today') return !activePreset && !hasDateParam;
    return activePreset === key;
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '28px',
      backgroundColor: 'var(--color-surface-container-lowest)',
      padding: '14px 20px',
      borderRadius: '16px',
      border: '1px solid var(--color-outline-variant)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
    }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '4px' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-outline)', fontSize: '18px' }}>date_range</span>
        <label htmlFor="dashboard-date" style={{
          fontSize: '11px',
          fontWeight: 800,
          color: 'var(--color-on-surface-variant)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap'
        }}>
          Período:
        </label>
      </div>

      {/* Preset Buttons */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {presets.map(({ key, label }) => {
          const active = isActive(key);
          return (
            <button
              key={key}
              onClick={key === 'today' ? goToday : () => applyPreset(key)}
              style={{
                padding: '7px 16px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                transition: 'all 0.2s',
                cursor: 'pointer',
                border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
                backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface)',
                color: active ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                boxShadow: active ? '0 4px 12px rgba(0,86,117,0.2)' : 'none',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--color-outline-variant)', margin: '0 4px' }} />

      {/* Date Picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-outline)', fontSize: '18px' }}>calendar_today</span>
        <input
          type="date"
          id="dashboard-date"
          value={currentData}
          onChange={handleDateChange}
          style={{
            padding: '7px 14px',
            border: `1px solid ${hasDateParam ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
            borderRadius: '10px',
            color: 'var(--color-on-surface)',
            fontWeight: 600,
            fontSize: '13px',
            outline: 'none',
            backgroundColor: 'var(--color-surface)',
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
}
