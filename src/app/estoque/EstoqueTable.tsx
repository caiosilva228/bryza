'use client';

import React, { useState } from 'react';
import { Produto } from '@/models/types';

interface EstoqueTableProps {
  produtos: Produto[];
  onProdutoClick: (produto: Produto) => void;
  onReservaClick: (produto: Produto) => void;
}

export const EstoqueTable = ({ produtos, onProdutoClick, onReservaClick }: EstoqueTableProps) => {
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const produtosFiltrados = produtos.filter(p => {
    const matchNome = (p.nome_produto || '').toLowerCase().includes(filtroNome.toLowerCase());
    const matchCategoria = filtroCategoria === '' || p.categoria === filtroCategoria;
    
    const status = (p.estoque_atual - (p.estoque_reservado || 0)) <= 0 ? 'critico' : (p.estoque_atual - (p.estoque_reservado || 0)) <= p.estoque_minimo ? 'baixo' : 'ok';
    const matchStatus = filtroStatus === '' || status === filtroStatus;
    
    return matchNome && matchCategoria && matchStatus;
  });

  const getStatusBadge = (p: Produto) => {
    const disponivel = p.estoque_atual - (p.estoque_reservado || 0);
    if (disponivel <= 0) return { label: 'Crítico', color: '#ff4d4f', bg: 'rgba(255, 77, 79, 0.15)' };
    if (disponivel <= p.estoque_minimo) return { label: 'Baixo', color: '#faad14', bg: 'rgba(250, 173, 20, 0.15)' };
    return { label: 'Em Estoque', color: '#52c41a', bg: 'rgba(82, 196, 26, 0.15)' };
  };

  return (
    <div style={{ 
      backgroundColor: 'var(--color-surface)', 
      borderRadius: '4px', 
      border: '1px solid var(--color-outline-variant)', 
      overflow: 'hidden'
    }}>
      {/* Filtros Técnicos */}
      <div style={{ 
        padding: '12px 16px', 
        display: 'flex', 
        gap: '8px', 
        flexWrap: 'wrap', 
        backgroundColor: 'var(--color-surface-container-low)',
        borderBottom: '1px solid var(--color-outline-variant)' 
      }}>
        <div style={{ position: 'relative', flex: 2, minWidth: '200px' }}>
          <span className="material-symbols-outlined" style={{ 
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', 
            fontSize: '18px', color: 'var(--color-outline)' 
          }}>search</span>
          <input 
            type="text" 
            placeholder="Pesquisar..." 
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
            style={{ 
              padding: '8px 12px 8px 38px', 
              borderRadius: '4px', 
              border: '1px solid var(--color-outline-variant)', 
              backgroundColor: 'var(--color-surface)',
              width: '100%',
              fontSize: '13px',
              outline: 'none',
              color: 'var(--color-on-surface)'
            }}
          />
        </div>
        
        <select 
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          style={{ 
            padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--color-outline-variant)',
            backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)',
            fontSize: '13px', minWidth: '140px', outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="">Todas Categorias</option>
          <option value="Materia prima">Matéria Prima</option>
          <option value="Embalagem">Embalagem</option>
          <option value="Produto Final">Produto Final</option>
        </select>

        <select 
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          style={{ 
            padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--color-outline-variant)',
            backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)',
            fontSize: '13px', minWidth: '140px', outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="">Qualquer Status</option>
          <option value="ok">Normal (OK)</option>
          <option value="baixo">Alerta (Baixo)</option>
          <option value="critico">Crítico (Zero)</option>
        </select>
      </div>

      {/* Tabela Técnica */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-surface-container-highest)', borderBottom: '1px solid var(--color-outline-variant)' }}>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Cod</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Produto</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Categoria</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Físico (TOTAL)</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Em Pedidos</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary)' }}>Disponível</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-outline)', fontSize: '13px' }}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              produtosFiltrados.map((p) => {
                const status = getStatusBadge(p);
                return (
                  <tr 
                    key={p.id} 
                    onClick={() => onProdutoClick(p)}
                    style={{ borderBottom: '1px solid var(--color-outline-variant)', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-outline)', fontFamily: 'monospace' }}>
                      #{p.codigo_produto || '-'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '13px' }}>{p.nome_produto}</div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ 
                        padding: '2px 6px', borderRadius: '2px', fontSize: '10px', fontWeight: 700,
                        backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)',
                        border: '1px solid var(--color-outline-variant)',
                        textTransform: 'uppercase'
                      }}>
                        {p.categoria}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-outline)', fontSize: '13px' }}>{p.estoque_atual}</span>
                        <span style={{ fontSize: '9px', color: 'var(--color-outline)', fontWeight: 600 }}>{p.unidade}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <button 
                        onClick={(e) => {
                          if ((p.estoque_reservado || 0) > 0) {
                            e.stopPropagation();
                            onReservaClick(p);
                          }
                        }}
                        style={{ 
                          border: 'none', background: 'none', cursor: (p.estoque_reservado || 0) > 0 ? 'pointer' : 'default',
                          display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '4px',
                          backgroundColor: (p.estoque_reservado || 0) > 0 ? 'var(--color-warning-container)' : 'transparent',
                          color: (p.estoque_reservado || 0) > 0 ? 'var(--color-on-warning-container)' : 'var(--color-outline)',
                          fontSize: '13px',
                          fontWeight: 700
                        }}
                      >
                        {p.estoque_reservado || 0}
                      </button>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '15px' }}>{p.estoque_atual - (p.estoque_reservado || 0)}</span>
                        <span style={{ fontSize: '9px', color: 'var(--color-primary)', fontWeight: 600 }}>{p.unidade}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: '2px', fontSize: '10px', fontWeight: 900,
                        textTransform: 'uppercase', backgroundColor: status.bg, color: status.color,
                        border: `1px solid ${status.color}40`
                      }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <button 
                        className="material-symbols-outlined" 
                        style={{ 
                          padding: '4px', borderRadius: '4px', border: '1px solid var(--color-outline-variant)', 
                          backgroundColor: 'var(--color-surface)', 
                          color: 'var(--color-on-surface)', fontSize: '18px', cursor: 'pointer'
                        }}
                      >
                        edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

