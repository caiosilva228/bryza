'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';

export function DashboardFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentData = searchParams.get('data') || format(new Date(), 'yyyy-MM-dd');

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set('data', val);
    } else {
      params.delete('data');
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      alignItems: 'center', 
      gap: '16px', 
      marginBottom: '32px', 
      backgroundColor: 'var(--color-surface-container-lowest)', 
      padding: '16px 24px', 
      borderRadius: '20px', 
      border: '1px solid var(--color-outline-variant)', 
      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-outline)', fontSize: '20px' }}>calendar_today</span>
        <label htmlFor="dashboard-date" style={{ 
          fontSize: '12px', 
          fontWeight: 800, 
          color: 'var(--color-on-surface-variant)', 
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Data de Referência:
        </label>
      </div>
      
      <input 
        type="date" 
        id="dashboard-date"
        value={currentData}
        onChange={handleDateChange}
        style={{ 
          padding: '8px 16px', 
          border: '1px solid var(--color-outline-variant)', 
          borderRadius: '12px', 
          color: 'var(--color-on-surface)', 
          fontWeight: 600, 
          fontSize: '14px',
          outline: 'none',
          backgroundColor: 'var(--color-surface)',
          cursor: 'pointer'
        }}
      />
      
      <div style={{ 
        height: '24px', 
        width: '1px', 
        backgroundColor: 'var(--color-outline-variant)', 
        margin: '0 8px',
        display: 'none' // Hidden by default, could show md:block via logic if needed
      }}></div>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => router.push('?')}
          style={{ 
            padding: '8px 20px', 
            borderRadius: '12px', 
            fontSize: '12px', 
            fontWeight: 700, 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em',
            transition: 'all 0.2s',
            cursor: 'pointer',
            border: 'none',
            backgroundColor: !searchParams.get('data') ? 'var(--color-primary)' : 'var(--color-surface-container-low)',
            color: !searchParams.get('data') ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
            boxShadow: !searchParams.get('data') ? '0 4px 12px rgba(0, 86, 117, 0.2)' : 'none'
          }}
        >
          Hoje
        </button>
      </div>
    </div>
  );
}
