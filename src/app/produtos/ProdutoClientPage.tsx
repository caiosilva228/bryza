'use client';

import { useState } from 'react';
import { Produto } from '@/models/types';
import ProdutoTable from './ProdutoTable';
import ProdutoFormModal from './ProdutoFormModal';
import { toggleStatusProduto } from './actions';

interface ProdutoClientPageProps {
  initialProdutos: Produto[];
}

export default function ProdutoClientPage({ initialProdutos }: ProdutoClientPageProps) {
  const [produtos, setProdutos] = useState<Produto[]>(initialProdutos);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const filteredProdutos = produtos.filter(p => {
    const matchesSearch = p.nome_produto.toLowerCase().includes(search.toLowerCase());
    const matchesCategoria = filterCategoria === '' || p.categoria === filterCategoria;
    return matchesSearch && matchesCategoria;
  });

  const handleOpenModal = (produto?: Produto) => {
    setEditingProduto(produto || null);
    setIsModalOpen(true);
  };

  const handleToggleAtivo = async (id: string, currentStatus: boolean) => {
    const res = await toggleStatusProduto(id, !currentStatus);
    if (res.success) {
      setProdutos(prev => prev.map(p => p.id === id ? { ...p, ativo: !currentStatus } : p));
    }
  };

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <div className="page-header-text">
          <h1 style={{ color: 'var(--color-on-surface)' }}>Catálogo de Produtos</h1>
          <p>Gerencie matérias-primas, embalagens e produtos finais.</p>
        </div>
        <div className="page-header-actions">
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary"
          >
            <span className="material-symbols-outlined">add</span>
            Novo Produto
          </button>
        </div>
      </header>


      {/* Filtros */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        backgroundColor: 'var(--color-surface-container-low)',
        padding: '12px 16px',
        borderRadius: '12px',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: '160px', position: 'relative' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-on-surface-variant)', fontSize: '18px' }}>search</span>
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              borderRadius: '10px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-on-surface)',
              fontSize: '13px',
            }}
          />
        </div>
        <select
          value={filterCategoria}
          onChange={(e) => setFilterCategoria(e.target.value)}
          style={{
            flex: '0 0 auto',
            minWidth: '160px',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid var(--color-outline-variant)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-on-surface)',
            fontSize: '13px',
          }}
        >
          <option value="">Todas as Categorias</option>
          <option value="Materia prima">Matéria Prima</option>
          <option value="Embalagem">Embalagem</option>
          <option value="Produto Final">Produto Final</option>
        </select>
      </div>


      <ProdutoTable 
        produtos={filteredProdutos} 
        onEdit={handleOpenModal} 
        onToggleAtivo={handleToggleAtivo}
      />

      {isModalOpen && (
        <ProdutoFormModal 
          produto={editingProduto} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={(newOrUpdated) => {
            if (editingProduto) {
              setProdutos(prev => prev.map(p => p.id === newOrUpdated.id ? newOrUpdated : p));
            } else {
              setProdutos(prev => [newOrUpdated, ...prev]);
            }
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
