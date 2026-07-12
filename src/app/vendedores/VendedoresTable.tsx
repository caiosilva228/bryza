'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { VendedorMetricas } from '@/models/types';

interface Props {
  lista: VendedorMetricas[];
}

export default function VendedoresTable({ lista }: Props) {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const sortedLista = useMemo(() => {
    if (!sortConfig) return lista;
    
    const sorted = [...lista];
    sorted.sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (sortConfig.key) {
        case 'codigo': aValue = a.codigo_vendedor; bValue = b.codigo_vendedor; break;
        case 'nome': aValue = a.nome; bValue = b.nome; break;
        case 'status': aValue = a.ativo ? 1 : 0; bValue = b.ativo ? 1 : 0; break;
        case 'regiao': aValue = a.regiao_atuacao; bValue = b.regiao_atuacao; break;
        case 'vendas': aValue = a.vendas_mes; bValue = b.vendas_mes; break; // sort by month sales
        case 'comissao': aValue = a.comissao_acumulada; bValue = b.comissao_acumulada; break;
        default: break;
      }
      
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [lista, sortConfig]);

  const requestSort = (key: string) => {
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

  const getSortIcon = (columnKey: string) => {
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

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--color-surface-container-low)', borderBottom: '1px solid var(--color-outline-variant)' }}>
            {[
              { label: 'Cód.', key: 'codigo', align: 'left' },
              { label: 'Nome / Contato', key: 'nome', align: 'left' },
              { label: 'Status / Nível', key: 'status', align: 'left' },
              { label: 'Região', key: 'regiao', align: 'left' },
              { label: 'Vendas (D/S/M)', key: 'vendas', align: 'center' },
              { label: 'Comissão Acum.', key: 'comissao', align: 'right' }
            ].map(col => (
              <th key={col.key} style={{
                padding: '16px 24px', fontWeight: 600, color: 'var(--color-on-surface-variant)', fontSize: '12px',
                textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: col.align as any,
                cursor: 'pointer', userSelect: 'none'
              }} onClick={() => requestSort(col.key)}>
                {col.label}
                {getSortIcon(col.key)}
              </th>
            ))}
            <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--color-on-surface-variant)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {sortedLista.map(vendedor => (
            <tr
              key={vendedor.id}
              className="transition-colors hover:bg-[var(--color-surface-container-low)]"
              style={{ borderBottom: '1px solid var(--color-outline-variant)' }}
            >
              <td style={{ padding: '16px 24px' }}>
                <span style={{ color: 'var(--color-primary)', fontSize: '13px', fontWeight: 700 }}>
                  #{String(vendedor.codigo_vendedor || '0').padStart(4, '0')}
                </span>
              </td>
              <td style={{ padding: '16px 24px' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '14px' }}>{vendedor.nome}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>{vendedor.telefone || vendedor.email}</div>
              </td>
              <td style={{ padding: '16px 24px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {vendedor.ativo ? (
                    <span style={{
                      display: 'inline-flex', padding: '4px 10px', borderRadius: '20px', fontSize: '10px',
                      backgroundColor: '#E6F4EA', color: '#137333', fontWeight: 700, textTransform: 'uppercase',
                      border: '1px solid #ceead6'
                    }}>Ativo</span>
                  ) : (
                    <span style={{
                      display: 'inline-flex', padding: '4px 10px', borderRadius: '20px', fontSize: '10px',
                      backgroundColor: '#FCE8E6', color: '#C5221F', fontWeight: 700, textTransform: 'uppercase',
                      border: '1px solid #fad2cf'
                    }}>Inativo</span>
                  )}
                  <span style={{
                    display: 'inline-flex', padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor: vendedor.nivel_comissao === 'Ouro' ? '#fff7e0' : vendedor.nivel_comissao === 'Prata' ? '#f1f3f4' : '#faebe0',
                    color: vendedor.nivel_comissao === 'Ouro' ? '#b28900' : vendedor.nivel_comissao === 'Prata' ? '#5f6368' : '#a85f20',
                    border: vendedor.nivel_comissao === 'Ouro' ? '1px solid #ffe082' : vendedor.nivel_comissao === 'Prata' ? '1px solid #dadce0' : '1px solid #eec3a3'
                  }}>
                    {vendedor.nivel_comissao || 'Bronze'}
                  </span>
                </div>
              </td>
              <td style={{ padding: '16px 24px', color: 'var(--color-on-surface)', fontSize: '14px' }}>
                {vendedor.regiao_atuacao || '--'}
              </td>
              <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', fontSize: '14px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{vendedor.vendas_dia}</span>
                  <span style={{ color: 'var(--color-outline)' }}>/</span>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>{vendedor.vendas_semana}</span>
                  <span style={{ color: 'var(--color-outline)' }}>/</span>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>{vendedor.vendas_mes}</span>
                </div>
              </td>
              <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 800, color: 'var(--color-on-surface)', fontSize: '15px' }}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(isNaN(vendedor.comissao_acumulada) ? 0 : vendedor.comissao_acumulada)}
              </td>
              <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                <Link href={`/vendedores/${vendedor.id}/editar`} style={{
                  display: 'inline-flex',
                  padding: '8px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-surface-container-high)',
                  color: 'var(--color-on-surface-variant)',
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
