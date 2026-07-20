'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

  const [sortConfig, setSortConfig] = useState<{ key: keyof Produto | 'disponivel', direction: 'asc' | 'desc' } | null>(null);
  const [expandedImage, setExpandedImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedImage(null);
      }
    };
    if (expandedImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expandedImage]);

  const produtosFiltrados = useMemo(() => {
    let result = produtos.filter(p => {
      const matchNome = (p.nome_produto || '').toLowerCase().includes(filtroNome.toLowerCase());
      const matchCategoria = filtroCategoria === '' || p.categoria === filtroCategoria;
      
      const status = (p.estoque_atual - (p.estoque_reservado || 0)) <= 0 ? 'critico' : (p.estoque_atual - (p.estoque_reservado || 0)) <= p.estoque_minimo ? 'baixo' : 'ok';
      const matchStatus = filtroStatus === '' || status === filtroStatus;
      
      return matchNome && matchCategoria && matchStatus;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Produto];
        let bValue: any = b[sortConfig.key as keyof Produto];
        
        if (sortConfig.key === 'disponivel') {
          aValue = a.estoque_atual - (a.estoque_reservado || 0);
          bValue = b.estoque_atual - (b.estoque_reservado || 0);
        }
        
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return result;
  }, [produtos, filtroNome, filtroCategoria, filtroStatus, sortConfig]);

  const requestSort = (key: keyof Produto | 'disponivel') => {
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

  const getSortIcon = (columnKey: keyof Produto | 'disponivel') => {
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
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('codigo_produto')}>Cod{getSortIcon('codigo_produto')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('nome_produto')}>Produto{getSortIcon('nome_produto')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('categoria')}>Categoria{getSortIcon('categoria')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('estoque_atual')}>Físico (TOTAL){getSortIcon('estoque_atual')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('estoque_reservado')}>Em Pedidos{getSortIcon('estoque_reservado')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('disponivel')}>Disponível{getSortIcon('disponivel')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('disponivel')}>Status{getSortIcon('disponivel')}</th>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div 
                          onClick={(e) => {
                            if (p.imagem_url) {
                              e.stopPropagation();
                              setExpandedImage({ url: p.imagem_url, title: p.nome_produto });
                            }
                          }}
                          title={p.imagem_url ? 'Clique para expandir a imagem' : undefined}
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--color-surface-container-high)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                            border: '1px solid var(--color-outline-variant)',
                            cursor: p.imagem_url ? 'pointer' : 'default',
                            transition: 'transform 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (p.imagem_url) e.currentTarget.style.transform = 'scale(1.08)';
                          }}
                          onMouseLeave={(e) => {
                            if (p.imagem_url) e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          {p.imagem_url ? (
                            <img
                              src={p.imagem_url}
                              alt={p.nome_produto}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-outline)' }}>
                              inventory_2
                            </span>
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '13px' }}>{p.nome_produto}</div>
                          <div style={{ fontSize: '10px', color: 'var(--color-outline)' }}>Unid: {p.unidade}</div>
                        </div>
                      </div>
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

      {/* Modal de Imagem Expandida (Lightbox) */}
      {expandedImage && (
        <div
          onClick={() => setExpandedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '24px',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              border: '1px solid var(--color-outline-variant)'
            }}
          >
            {/* Header com Nome do Produto e Botão X */}
            <div style={{
              width: '100%',
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-surface-container-lowest)',
              borderBottom: '1px solid var(--color-outline-variant)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary)' }}>
                  image
                </span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--color-on-surface)' }}>
                  {expandedImage.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setExpandedImage(null)}
                title="Fechar (ESC)"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-surface-container-high)',
                  border: 'none',
                  color: 'var(--color-on-surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-highest)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            {/* Imagem Expandida */}
            <div style={{
              padding: '32px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#fafafa',
              maxHeight: 'calc(90vh - 70px)',
              overflow: 'auto'
            }}>
              <img
                src={expandedImage.url}
                alt={expandedImage.title}
                style={{
                  maxWidth: '80vw',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

