'use client';

import { Produto } from '@/models/types';

interface ProdutoTableProps {
  produtos: Produto[];
  onEdit: (produto: Produto) => void;
  onToggleAtivo: (id: string, currentStatus: boolean) => void;
}

export default function ProdutoTable({ produtos, onEdit, onToggleAtivo }: ProdutoTableProps) {
  const formatMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--color-outline-variant)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead style={{ backgroundColor: 'var(--color-surface-container-highest)', borderBottom: '1px solid var(--color-outline-variant)' }}>
          <tr>
            <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Cod</th>
            <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Produto</th>
            <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Categoria</th>
            <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Estoque</th>
            <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Pedidos</th>
            <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Disponível</th>
            <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Custo</th>
            <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Venda</th>
            <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Status</th>
            <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', textAlign: 'right' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {produtos.length === 0 ? (
            <tr>
              <td colSpan={10} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-outline)', fontSize: '13px' }}>
                Nenhum produto encontrado.
              </td>
            </tr>
          ) : (
            produtos.map((p) => {
              const isLowStock = p.estoque_atual <= p.estoque_minimo;
              
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-outline)', fontFamily: 'monospace' }}>
                    #{p.codigo_produto || '-'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '13px' }}>{p.nome_produto}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-outline)' }}>Unid: {p.unidade}</div>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ 
                      padding: '2px 6px', 
                      borderRadius: '2px', 
                      fontSize: '10px', 
                      fontWeight: 700,
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface-variant)',
                      border: '1px solid var(--color-outline-variant)',
                      textTransform: 'uppercase'
                    }}>
                      {p.categoria}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ 
                        fontWeight: 700, 
                        fontSize: '14px',
                        color: isLowStock ? 'var(--color-error)' : 'var(--color-on-surface)' 
                      }}>
                        {p.estoque_atual}
                      </span>
                      {isLowStock && (
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-error)' }}>warning</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-outline)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {p.estoque_reservado || 0}
                    </div>
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
                        color: p.ativo ? 'var(--color-primary)' : 'var(--color-outline)'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {p.ativo ? 'check_circle' : 'cancel'}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>{p.ativo ? 'Ativo' : 'Inativo'}</span>
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
                        cursor: 'pointer' 
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
