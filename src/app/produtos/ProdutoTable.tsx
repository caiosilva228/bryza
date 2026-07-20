'use client';

import React, { useState, useMemo } from 'react';
import { Produto } from '@/models/types';

interface ProdutoTableProps {
  produtos: Produto[];
  onEdit: (produto: Produto) => void;
  onToggleAtivo: (id: string, currentStatus: boolean) => void;
}

export default function ProdutoTable({ produtos, onEdit, onToggleAtivo }: ProdutoTableProps) {
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

  const sortedProdutos = useMemo(() => {
    let sortableItems = [...produtos];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
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
    return sortableItems;
  }, [produtos, sortConfig]);

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

  const formatMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  if (produtos.length === 0) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid var(--color-outline-variant)',
          padding: '48px 20px',
          textAlign: 'center',
          color: 'var(--color-outline)',
          fontSize: '13px',
        }}
      >
        Nenhum produto encontrado.
      </div>
    );
  }

  return (
    <>
      <div
        className="hide-mobile"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '4px',
          overflow: 'hidden',
          border: '1px solid var(--color-outline-variant)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: 'var(--color-surface-container-highest)', borderBottom: '1px solid var(--color-outline-variant)' }}>
            <tr>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('codigo_produto')}>Cod{getSortIcon('codigo_produto')}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('nome_produto')}>Produto{getSortIcon('nome_produto')}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('categoria')}>Categoria{getSortIcon('categoria')}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('estoque_atual')}>Estoque{getSortIcon('estoque_atual')}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('estoque_reservado')}>Pedidos{getSortIcon('estoque_reservado')}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('disponivel')}>Disponível{getSortIcon('disponivel')}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('custo_unitario')}>Custo{getSortIcon('custo_unitario')}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('preco_venda')}>Venda{getSortIcon('preco_venda')}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('ativo')}>Status{getSortIcon('ativo')}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedProdutos.map((p) => {
              const isLowStock = p.estoque_atual <= p.estoque_minimo;

              return (
                <tr
                  key={p.id}
                  style={{ borderBottom: '1px solid var(--color-outline-variant)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-outline)', fontFamily: 'monospace' }}>
                    #{p.codigo_produto || '-'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div 
                        onClick={() => p.imagem_url && setExpandedImage({ url: p.imagem_url, title: p.nome_produto })}
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
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '2px',
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: 'var(--color-surface-container-high)',
                        color: 'var(--color-on-surface-variant)',
                        border: '1px solid var(--color-outline-variant)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {p.categoria}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '14px',
                          color: isLowStock ? 'var(--color-error)' : 'var(--color-on-surface)',
                        }}
                      >
                        {p.estoque_atual}
                      </span>
                      {isLowStock && (
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-error)' }}>
                          warning
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-outline)' }}>
                    {p.estoque_reservado || 0}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {p.estoque_atual - (p.estoque_reservado || 0)}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--color-on-surface)' }}>
                    {formatMoeda(p.custo_unitario)}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                    {formatMoeda(p.preco_venda)}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <button
                      onClick={() => onToggleAtivo(p.id, p.ativo)}
                      style={{
                        border: '1px solid var(--color-outline-variant)',
                        background: 'var(--color-surface)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        color: p.ativo ? 'var(--color-primary)' : 'var(--color-outline)',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {p.ativo ? 'check_circle' : 'cancel'}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </button>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => onEdit(p)}
                      style={{
                        padding: '4px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-outline-variant)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-on-surface)',
                        cursor: 'pointer',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="hide-desktop" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sortedProdutos.map((p) => {
          const isLowStock = p.estoque_atual <= p.estoque_minimo;
          const disponivel = p.estoque_atual - (p.estoque_reservado || 0);

          return (
            <div
              key={p.id}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: '16px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', minWidth: 0, flex: 1, alignItems: 'center' }}>
                  <div 
                    onClick={() => p.imagem_url && setExpandedImage({ url: p.imagem_url, title: p.nome_produto })}
                    title={p.imagem_url ? 'Clique para expandir a imagem' : undefined}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--color-surface-container-high)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1px solid var(--color-outline-variant)',
                      cursor: p.imagem_url ? 'pointer' : 'default'
                    }}
                  >
                    {p.imagem_url ? (
                      <img
                        src={p.imagem_url}
                        alt={p.nome_produto}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'var(--color-outline)' }}>
                        inventory_2
                      </span>
                    )}
                  </div>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-outline)', fontFamily: 'monospace' }}>
                        #{p.codigo_produto || '-'}
                      </span>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '10px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          backgroundColor: p.ativo ? 'var(--color-primary-container)' : 'var(--color-surface-container-high)',
                          color: p.ativo ? 'var(--color-on-primary-container)' : 'var(--color-outline)',
                        }}
                      >
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-on-surface)', lineHeight: 1.25 }}>
                      {p.nome_produto}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                      Unid: {p.unidade}
                    </span>
                  </div>
                </div>

                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface-variant)',
                    border: '1px solid var(--color-outline-variant)',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  {p.categoria}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--color-surface-container-low)',
                    color: isLowStock ? 'var(--color-error)' : 'var(--color-on-surface)',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {isLowStock && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>warning</span>}
                  Físico {p.estoque_atual}
                </span>
                <span
                  style={{
                    padding: '5px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--color-surface-container-low)',
                    color: 'var(--color-outline)',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  Pedidos {p.estoque_reservado || 0}
                </span>
                <span
                  style={{
                    padding: '5px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--color-primary-container)',
                    color: 'var(--color-on-primary-container)',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  Disp. {disponivel}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--color-outline-variant)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', marginBottom: '2px' }}>
                    Custo
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                    {formatMoeda(p.custo_unitario)}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', marginBottom: '2px' }}>
                    Venda
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {formatMoeda(p.preco_venda)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => onToggleAtivo(p.id, p.ativo)}
                  style={{
                    flex: 1,
                    minHeight: '40px',
                    borderRadius: '10px',
                    border: '1px solid var(--color-outline-variant)',
                    backgroundColor: 'var(--color-surface)',
                    color: p.ativo ? 'var(--color-primary)' : 'var(--color-outline)',
                    fontSize: '12px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {p.ativo ? 'check_circle' : 'cancel'}
                  </span>
                  {p.ativo ? 'Ativo' : 'Inativo'}
                </button>

                <button
                  onClick={() => onEdit(p)}
                  style={{
                    flex: 1,
                    minHeight: '40px',
                    borderRadius: '10px',
                    border: '1px solid var(--color-outline-variant)',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    fontSize: '12px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                  Editar
                </button>
              </div>
            </div>
          );
        })}
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
              justify: 'space-between',
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
              justify: 'center',
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
    </>
  );
}
