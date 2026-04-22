'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function VendasFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const [tempFrom, setTempFrom] = useState(from);
  const [tempTo, setTempTo] = useState(to);

  // Sincronizar estados temporários quando os params mudarem
  useEffect(() => {
    setTempFrom(from);
    setTempTo(to);
  }, [from, to]);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApply = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (tempFrom) params.set('from', tempFrom);
    else params.delete('from');
    
    if (tempTo) params.set('to', tempTo);
    else params.delete('to');

    router.push(`?${params.toString()}`);
    setIsOpen(false);
  };

  const setThisMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');
    
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', start);
    params.set('to', end);
    router.push(`?${params.toString()}`);
    setIsOpen(false);
  };

  const clearFilters = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push('/vendas');
    setIsOpen(false);
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = parseISO(dateStr);
    if (!isValid(date)) return '';
    return format(date, "dd 'de' MMM", { locale: ptBR });
  };

  const rangeLabel = from && to 
    ? `${formatDisplayDate(from)} - ${formatDisplayDate(to)}`
    : from 
      ? `A partir de ${formatDisplayDate(from)}`
      : to 
        ? `Até ${formatDisplayDate(to)}`
        : 'Filtrar por data';

  return (
    <div style={{ position: 'relative', marginBottom: '32px' }} ref={dropdownRef}>
      {/* Trigger: A "única caixa" */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="transition-fast"
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
          userSelect: 'none'
        }}
      >
        <span className="material-symbols-outlined" style={{ 
          color: (from || to) ? 'var(--color-primary)' : 'var(--color-outline)', 
          fontSize: '22px' 
        }}>
          calendar_month
        </span>
        
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 800, 
            color: 'var(--color-outline)', 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '2px'
          }}>
            Período
          </div>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 600, 
            color: (from || to) ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)' 
          }}>
            {rangeLabel}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(from || to) && (
            <button 
              onClick={clearFilters}
              className="material-symbols-outlined hover-bg-low transition-fast"
              style={{ 
                fontSize: '18px', 
                color: 'var(--color-error)',
                border: 'none',
                background: 'transparent',
                padding: '4px',
                borderRadius: '50%',
                cursor: 'pointer'
              }}
            >
              close
            </button>
          )}
          <span className="material-symbols-outlined" style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            color: 'var(--color-outline)'
          }}>
            expand_more
          </span>
        </div>
      </div>

      {/* Popover / Dropdown */}
      {isOpen && (
        <div style={{ 
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
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <style jsx>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700 }}>Selecionar Intervalo</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', marginBottom: '6px' }}>DE</label>
                <input 
                  type="date" 
                  value={tempFrom}
                  onChange={(e) => setTempFrom(e.target.value)}
                  style={{ 
                    width: '100%',
                    padding: '10px 12px', 
                    border: '1px solid var(--color-outline-variant)', 
                    borderRadius: '12px', 
                    fontSize: '14px',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', marginBottom: '6px' }}>ATÉ</label>
                <input 
                  type="date" 
                  value={tempTo}
                  onChange={(e) => setTempTo(e.target.value)}
                  style={{ 
                    width: '100%',
                    padding: '10px 12px', 
                    border: '1px solid var(--color-outline-variant)', 
                    borderRadius: '12px', 
                    fontSize: '14px',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button 
              onClick={setThisMonth}
              className="hover-bg-low transition-fast"
              style={{ 
                flex: 1,
                padding: '10px', 
                borderRadius: '12px', 
                fontSize: '12px', 
                fontWeight: 700, 
                cursor: 'pointer',
                border: '1px solid var(--color-outline-variant)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-on-surface-variant)',
              }}
            >
              Este Mês
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const today = format(new Date(), 'yyyy-MM-dd');
                setTempFrom(today);
                setTempTo(today);
              }}
              className="hover-bg-low transition-fast"
              style={{ 
                flex: 1,
                padding: '10px', 
                borderRadius: '12px', 
                fontSize: '12px', 
                fontWeight: 700, 
                cursor: 'pointer',
                border: '1px solid var(--color-outline-variant)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-on-surface-variant)',
              }}
            >
              Hoje
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ 
                flex: 1,
                padding: '12px', 
                borderRadius: '12px', 
                fontSize: '14px', 
                fontWeight: 700, 
                cursor: 'pointer',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--color-on-surface-variant)',
              }}
            >
              Cancelar
            </button>
            <button 
              onClick={handleApply}
              style={{ 
                flex: 2,
                padding: '12px', 
                borderRadius: '12px', 
                fontSize: '14px', 
                fontWeight: 700, 
                cursor: 'pointer',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                boxShadow: '0 4px 12px rgba(0, 86, 117, 0.2)'
              }}
            >
              Aplicar Filtro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
