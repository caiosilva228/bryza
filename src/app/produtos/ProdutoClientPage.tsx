'use client';

import { useMemo, useState } from 'react';
import { Kit, Produto } from '@/models/types';
import ProdutoTable from './ProdutoTable';
import ProdutoFormModal from './ProdutoFormModal';
import { toggleStatusProduto, toggleStatusProdutoLoja } from './actions';
import ProdutoStats from './ProdutoStats';
import CategoriasConfigTab from './CategoriasConfigTab';
import KitsConfigTab from './KitsConfigTab';

interface ProdutoClientPageProps {
  initialProdutos: Produto[];
  initialKits: Kit[];
}

export default function ProdutoClientPage({ initialProdutos, initialKits }: ProdutoClientPageProps) {
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

  const stats = useMemo(() => {
    return produtos.reduce((acc, produto) => {
      acc.total += 1;
      if (produto.ativo) acc.ativos += 1;
      if (produto.estoque_atual <= produto.estoque_minimo) acc.estoqueBaixo += 1;
      acc.valorPotencial += produto.estoque_atual * produto.preco_venda;
      return acc;
    }, {
      total: 0,
      ativos: 0,
      estoqueBaixo: 0,
      valorPotencial: 0,
    });
  }, [produtos]);

  const handleOpenModal = (produto?: Produto) => {
    setEditingProduto(produto || null);
    setIsModalOpen(true);
  };

  const handleToggleAtivo = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    const res = await toggleStatusProduto(id, nextStatus);
    if (res.success) {
      setProdutos(prev => prev.map(p => {
        if (p.id === id) {
          return {
            ...p,
            ativo: nextStatus,
            ativo_loja: nextStatus ? p.ativo_loja : false
          };
        }
        return p;
      }));
    }
  };

  const handleToggleAtivoLoja = async (id: string, currentStatus: boolean) => {
    const targetProd = produtos.find(p => p.id === id);
    if (targetProd && !targetProd.ativo && currentStatus === false) {
      alert('⚠️ Produtos com status INATIVO não podem ser exibidos na Loja Virtual. Ative o produto primeiro.');
      return;
    }
    const res = await toggleStatusProdutoLoja(id, !currentStatus);
    if (res.success) {
      setProdutos(prev => prev.map(p => p.id === id ? { ...p, ativo_loja: !currentStatus } : p));
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<'produtos' | 'kits' | 'categorias'>('produtos');

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <div className="page-header-text">
          <h1 style={{ color: 'var(--color-on-surface)' }}>Gestão de Produtos & Categorias</h1>
          <p>Gerencie catálogo de produtos, matérias-primas, embalagens e categorias da Loja Virtual.</p>
        </div>
        <div className="page-header-actions">
          {activeSubTab === 'produtos' && (
            <button
              onClick={() => handleOpenModal()}
              className="btn-primary"
            >
              <span className="material-symbols-outlined">add</span>
              Novo Produto
            </button>
          )}
        </div>
      </header>

      {/* Subabas de Navegação */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid var(--color-outline-variant)',
        paddingBottom: '4px'
      }}>
        <button
          onClick={() => setActiveSubTab('produtos')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            borderBottom: activeSubTab === 'produtos' ? '3px solid #0b5ea8' : '3px solid transparent',
            backgroundColor: activeSubTab === 'produtos' ? 'var(--color-surface-container-low)' : 'transparent',
            color: activeSubTab === 'produtos' ? '#0b5ea8' : 'var(--color-on-surface-variant)',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>inventory_2</span>
          <span>Catálogo de Produtos</span>
        </button>

        <button
          onClick={() => setActiveSubTab('kits')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            borderBottom: activeSubTab === 'kits' ? '3px solid #0b5ea8' : '3px solid transparent',
            backgroundColor: activeSubTab === 'kits' ? 'var(--color-surface-container-low)' : 'transparent',
            color: activeSubTab === 'kits' ? '#0b5ea8' : 'var(--color-on-surface-variant)',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>redeem</span>
          <span>Kits Promocionais</span>
        </button>

        <button
          onClick={() => setActiveSubTab('categorias')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            borderBottom: activeSubTab === 'categorias' ? '3px solid #0b5ea8' : '3px solid transparent',
            backgroundColor: activeSubTab === 'categorias' ? 'var(--color-surface-container-low)' : 'transparent',
            color: activeSubTab === 'categorias' ? '#0b5ea8' : 'var(--color-on-surface-variant)',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>category</span>
          <span>Configurar Categorias</span>
        </button>
      </div>

      {activeSubTab === 'categorias' ? (
        <CategoriasConfigTab produtos={produtos} />
      ) : activeSubTab === 'kits' ? (
        <KitsConfigTab initialKits={initialKits} produtos={produtos} />
      ) : (
        <>
          <ProdutoStats stats={stats} />

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
          <option value="Lava Roupas">Lava Roupas</option>
          <option value="Amaciantes">Amaciantes</option>
          <option value="Multiuso">Multiuso</option>
          <option value="Panos & Limpeza">Panos & Limpeza</option>
          <option value="Sacos de Lixo">Sacos de Lixo</option>
          <option value="Kits Promocionais">Kits Promocionais</option>
          <option value="Materia prima">Matéria Prima</option>
          <option value="Embalagem">Embalagem</option>
          <option value="Outros">Outros</option>
        </select>
      </div>


      <ProdutoTable 
        produtos={filteredProdutos} 
        onEdit={handleOpenModal} 
        onToggleAtivo={handleToggleAtivo}
        onToggleAtivoLoja={handleToggleAtivoLoja}
      />
      </>
      )}

      {isModalOpen && (
        <ProdutoFormModal 
          produto={editingProduto} 
          onClose={() => setIsModalOpen(false)} 
          onImageDeleted={(deletedUrl) => {
            setProdutos((current) =>
              current.map((item) =>
                item.imagem_url === deletedUrl ? { ...item, imagem_url: null } : item
              )
            );
          }}
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
