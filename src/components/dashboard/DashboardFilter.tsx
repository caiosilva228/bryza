'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, subDays, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Preset = 'hoje' | 'ontem' | 'ultimos_7_dias' | 'ultimos_30_dias' | 'este_mes';

export function DashboardFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const periodParam = searchParams.get('period');

  const getInitialPreset = (): Preset | 'custom' => {
    if (periodParam && ['hoje', 'ontem', 'ultimos_7_dias', 'ultimos_30_dias', 'este_mes'].includes(periodParam)) {
      return periodParam as Preset;
    }
    if (from || to) {
      return 'custom';
    }
    return 'hoje';
  };

  const [tempFrom, setTempFrom] = React.useState(from);
  const [tempTo, setTempTo] = React.useState(to);
  const [selectedPreset, setSelectedPreset] = React.useState<Preset | 'custom'>(getInitialPreset);

  React.useEffect(() => {
    setTempFrom(from);
    setTempTo(to);
    setSelectedPreset(getInitialPreset());
  }, [from, to, periodParam]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPresetLabel = (preset: Preset) => {
    switch (preset) {
      case 'hoje': return 'Hoje';
      case 'ontem': return 'Ontem';
      case 'ultimos_7_dias': return 'Últimos 7 dias';
      case 'ultimos_30_dias': return 'Últimos 30 dias';
      case 'este_mes': return 'Esse mês';
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = parseISO(dateStr);
      if (!isValid(date)) return '';
      return format(date, "dd 'de' MMM", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const handleApply = () => {
    const params = new URLSearchParams();
    if (selectedPreset === 'custom') {
      if (tempFrom) params.set('from', tempFrom);
      if (tempTo) params.set('to', tempTo);
      params.set('period', 'custom');
    } else {
      params.set('period', selectedPreset);
    }
    router.push(`?${params.toString()}`);
    setIsOpen(false);
  };

  const applyPresetDirectly = (preset: Preset) => {
    const today = new Date();
    let nextFrom = '';
    let nextTo = '';

    switch (preset) {
      case 'hoje':
        nextFrom = format(today, 'yyyy-MM-dd');
        nextTo = format(today, 'yyyy-MM-dd');
        break;
      case 'ontem': {
        const yesterday = subDays(today, 1);
        nextFrom = format(yesterday, 'yyyy-MM-dd');
        nextTo = format(yesterday, 'yyyy-MM-dd');
        break;
      }
      case 'ultimos_7_dias':
        nextFrom = format(subDays(today, 6), 'yyyy-MM-dd');
        nextTo = format(today, 'yyyy-MM-dd');
        break;
      case 'ultimos_30_dias':
        nextFrom = format(subDays(today, 29), 'yyyy-MM-dd');
        nextTo = format(today, 'yyyy-MM-dd');
        break;
      case 'este_mes':
        nextFrom = format(startOfMonth(today), 'yyyy-MM-dd');
        nextTo = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
    }

    setTempFrom(nextFrom);
    setTempTo(nextTo);
    setSelectedPreset(preset);
  };

  const clearFilters = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push('?');
    setIsOpen(false);
  };

  const rangeLabel = periodParam && periodParam !== 'custom' && ['hoje', 'ontem', 'ultimos_7_dias', 'ultimos_30_dias', 'este_mes'].includes(periodParam)
    ? getPresetLabel(periodParam as Preset)
    : from && to
      ? `${formatDisplayDate(from)} - ${formatDisplayDate(to)}`
      : from
        ? `A partir de ${formatDisplayDate(from)}`
        : to
          ? `Até ${formatDisplayDate(to)}`
          : 'Hoje';

  return (
    <div style={{ position: 'relative', marginBottom: '32px' }} ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'var(--color-surface-container-lowest)',
          padding: '12px 20px',
          borderRadius: '16px',
          border: isOpen ? '1px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
          boxShadow: isOpen ? '0 4px 12px rgba(0,0,0,0.08)' : '0 2px 6px rgba(0,0,0,0.02)',
          cursor: 'pointer',
          width: 'fit-content',
          minWidth: '280px',
          userSelect: 'none',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            color: (from || to || (periodParam && periodParam !== 'hoje')) ? 'var(--color-primary)' : 'var(--color-outline)',
            fontSize: '22px',
          }}
        >
          calendar_month
        </span>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--color-outline)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '2px',
            }}
          >
            Período
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: (from || to || (periodParam && periodParam !== 'hoje'))
                ? 'var(--color-on-surface)'
                : 'var(--color-on-surface-variant)',
            }}
          >
            {rangeLabel}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(from || to || (periodParam && periodParam !== 'hoje')) && (
            <button
              onClick={clearFilters}
              className="material-symbols-outlined"
              style={{
                fontSize: '18px',
                color: 'var(--color-error)',
                border: 'none',
                background: 'transparent',
                padding: '4px',
                borderRadius: '50%',
                cursor: 'pointer',
              }}
            >
              close
            </button>
          )}
          <span
            className="material-symbols-outlined"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
              color: 'var(--color-outline)',
            }}
          >
            expand_more
          </span>
        </div>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 100,
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: '20px',
            border: '1px solid var(--color-outline-variant)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            padding: '24px',
            width: '360px',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>Selecionar Intervalo</h4>

            <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
              {(['hoje', 'ontem', 'ultimos_7_dias', 'ultimos_30_dias', 'este_mes'] as Preset[]).map((preset) => {
                const isActive = selectedPreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyPresetDirectly(preset)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                      backgroundColor: isActive ? 'var(--color-primary-container)' : 'var(--color-surface)',
                      color: isActive ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
                      textAlign: 'left',
                      fontFamily: 'var(--font-headline)'
                    }}
                  >
                    {getPresetLabel(preset)}
                  </button>
                );
              })}
              
              <button
                type="button"
                onClick={() => {
                  setSelectedPreset('custom');
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${selectedPreset === 'custom' ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                  backgroundColor: selectedPreset === 'custom' ? 'var(--color-primary-container)' : 'var(--color-surface)',
                  color: selectedPreset === 'custom' ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
                  textAlign: 'left',
                  fontFamily: 'var(--font-headline)'
                }}
              >
                Data personalizada
              </button>
            </div>

            {selectedPreset === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', marginBottom: '6px' }}>DE</label>
                  <input
                    type="date"
                    value={tempFrom}
                    onChange={(e) => {
                      setTempFrom(e.target.value);
                    }}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch {}
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid var(--color-outline-variant)',
                      backgroundColor: 'var(--color-surface)',
                      fontSize: '14px',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-on-surface)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', marginBottom: '6px' }}>ATÉ</label>
                  <input
                    type="date"
                    value={tempTo}
                    onChange={(e) => {
                      setTempTo(e.target.value);
                    }}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch {}
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid var(--color-outline-variant)',
                      backgroundColor: 'var(--color-surface)',
                      fontSize: '14px',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-on-surface)'
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--color-outline)',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-headline)'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApply}
                style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-headline)'
                }}
              >
                Aplicar Filtro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
