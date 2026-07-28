'use client';

import React, { useState, useEffect } from 'react';
import { Produto } from '@/models/types';
import { fetchCategoriasAction, saveCategoriaAction, toggleStatusCategoriaLojaAction, deleteCategoriaAction } from './actions';
import { toast } from 'sonner';

interface CategoriaItem {
  id: string;
  nome: string;
  descricao?: string;
  icone: string;
  cor: string;
  ordem: number;
  ativo_loja: boolean;
}

interface CategoriasConfigTabProps {
  produtos: Produto[];
}

export default function CategoriasConfigTab({ produtos }: CategoriasConfigTabProps) {
  const [loading, setLoading] = useState(true);
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [search, setSearch] = useState('');
  
  // Modal de Adicionar / Editar Categoria
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoriaItem | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    icone: 'category',
    cor: '#0b5ea8',
    ativo_loja: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCategorias();
  }, []);

  const loadCategorias = async () => {
    setLoading(true);
    const res = await fetchCategoriasAction();
    if (res.success && res.data) {
      setCategorias(res.data);
    } else {
      toast.error(res.error || 'Erro ao carregar categorias.');
    }
    setLoading(false);
  };

  // Contagem de produtos por categoria
  const getProductCountForCat = (catNome: string) => {
    return produtos.filter(p => p.categoria === catNome || (p.categorias_adicionais && p.categorias_adicionais.includes(catNome))).length;
  };

  const filteredCategorias = categorias.filter(c => 
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenModal = (cat?: CategoriaItem) => {
    if (cat) {
      setEditingCat(cat);
      setFormData({
        nome: cat.nome,
        icone: cat.icone || 'category',
        cor: cat.cor || '#0b5ea8',
        ativo_loja: cat.ativo_loja !== undefined ? cat.ativo_loja : true,
      });
    } else {
      setEditingCat(null);
      setFormData({
        nome: '',
        icone: 'category',
        cor: '#0b5ea8',
        ativo_loja: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleToggleStatusLoja = async (id: string, currentStatus: boolean) => {
    const res = await toggleStatusCategoriaLojaAction(id, !currentStatus);
    if (res.success) {
      setCategorias(prev => prev.map(c => c.id === id ? { ...c, ativo_loja: !currentStatus } : c));
      toast.success(`Visibilidade na Loja Virtual alterada!`);
    } else {
      toast.error(res.error || 'Não foi possível alterar o status.');
    }
  };

  const handleDelete = async (cat: CategoriaItem) => {
    const count = getProductCountForCat(cat.nome);
    if (count > 0) {
      if (!confirm(`Existem ${count} produtos vinculados a esta categoria. Tem certeza que deseja excluí-la?`)) {
        return;
      }
    } else if (!confirm(`Excluir a categoria "${cat.nome}"?`)) {
      return;
    }

    const res = await deleteCategoriaAction(cat.id);
    if (res.success) {
      setCategorias(prev => prev.filter(c => c.id !== cat.id));
      toast.success('Categoria excluída com sucesso!');
    } else {
      toast.error(res.error || 'Erro ao excluir categoria.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast.error('Informe o nome da categoria.');
      return;
    }

    setSaving(true);
    const payload = {
      ...(editingCat && { id: editingCat.id }),
      nome: formData.nome.trim(),
      icone: formData.icone,
      cor: formData.cor,
      ativo_loja: formData.ativo_loja,
      ordem: editingCat ? editingCat.ordem : categorias.length + 1,
    };

    const res = await saveCategoriaAction(payload);
    if (res.success && res.data) {
      toast.success(editingCat ? 'Categoria atualizada!' : 'Categoria criada com sucesso!');
      setIsModalOpen(false);
      loadCategorias();
    } else {
      toast.error(res.error || 'Erro ao salvar categoria.');
    }
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Header da Sub-aba & Botão Nova Categoria */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Campo de Busca */}
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-on-surface-variant)', fontSize: '18px' }}>
            search
          </span>
          <input
            type="text"
            placeholder="Buscar por categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 38px',
              borderRadius: '10px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-on-surface)',
              fontSize: '13px',
            }}
          />
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="btn-primary"
          style={{ height: '42px', padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <span className="material-symbols-outlined">add</span>
          Nova Categoria
        </button>
      </div>

      {/* Tabela no Mesmo Design da Aba Catálogo de Produtos */}
      {loading ? (
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid var(--color-outline-variant)',
          padding: '48px 20px',
          textAlign: 'center',
          color: 'var(--color-outline)',
          fontSize: '13px',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1s infinite linear', color: 'var(--color-primary)' }}>
            sync
          </span>
          <p style={{ marginTop: '8px', fontWeight: 600 }}>Carregando categorias...</p>
        </div>
      ) : filteredCategorias.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid var(--color-outline-variant)',
          padding: '48px 20px',
          textAlign: 'center',
          color: 'var(--color-outline)',
          fontSize: '13px',
        }}>
          Nenhuma categoria encontrada.
        </div>
      ) : (
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid var(--color-outline-variant)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--color-surface-container-highest)', borderBottom: '1px solid var(--color-outline-variant)' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', width: '60px' }}>Ícone</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Nome da Categoria</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Produtos Vinculados</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase' }}>Visibilidade Loja (/loja)</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategorias.map((cat) => {
                const count = getProductCountForCat(cat.nome);

                return (
                  <tr
                    key={cat.id}
                    style={{ borderBottom: '1px solid var(--color-outline-variant)', transition: 'background-color 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {/* Ícone com Cor customizada */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: cat.cor ? `${cat.cor}18` : 'var(--color-surface-container-high)',
                        color: cat.cor || 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--color-outline-variant)'
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                          {cat.icone || 'category'}
                        </span>
                      </div>
                    </td>

                    {/* Nome da Categoria */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-on-surface)', fontSize: '14px' }}>
                        {cat.nome}
                      </div>
                    </td>

                    {/* Produtos Vinculados */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'var(--color-surface-container-high)',
                        color: 'var(--color-on-surface-variant)',
                        border: '1px solid var(--color-outline-variant)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>inventory_2</span>
                        {count} {count === 1 ? 'produto' : 'produtos'}
                      </span>
                    </td>

                    {/* Visibilidade Loja Virtual */}
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => handleToggleStatusLoja(cat.id, cat.ativo_loja)}
                        style={{
                          border: '1px solid var(--color-outline-variant)',
                          background: 'var(--color-surface)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          color: cat.ativo_loja ? '#16a34a' : '#94a3b8',
                          transition: 'all 0.2s'
                        }}
                        title="Clique para alternar se esta categoria aparece na Loja Virtual"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          {cat.ativo_loja ? 'storefront' : 'visibility_off'}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>
                          {cat.ativo_loja ? 'Loja ON' : 'Loja OFF'}
                        </span>
                      </button>
                    </td>

                    {/* Ações */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenModal(cat)}
                          title="Editar Categoria"
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-outline-variant)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-on-surface)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(cat)}
                          title="Excluir Categoria"
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            backgroundColor: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Formulário de Categoria */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--color-surface)',
            width: '100%',
            maxWidth: '480px',
            borderRadius: '20px',
            border: '1px solid var(--color-outline-variant)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px 24px',
              backgroundColor: 'var(--color-surface-container-lowest)',
              borderBottom: '1px solid var(--color-outline-variant)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--color-on-surface)' }}>
                {editingCat ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-on-surface)', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Nome da Categoria *
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Detergentes & Desinfetantes"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--color-outline-variant)',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    color: 'var(--color-on-surface)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Ícone Material
                  </label>
                  <select
                    value={formData.icone}
                    onChange={(e) => setFormData({ ...formData, icone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--color-outline-variant)',
                      fontSize: '13.5px',
                      backgroundColor: 'white',
                      color: 'var(--color-on-surface)'
                    }}
                  >
                    <option value="category">Category (Padrão)</option>
                    <option value="inventory_2">Box / Galão</option>
                    <option value="local_laundry_service">Sabão / Lavagem</option>
                    <option value="dry_cleaning">Amaciante / Roupas</option>
                    <option value="cleaning_services">Limpeza Geral</option>
                    <option value="redeem">Kit / Oferta</option>
                    <option value="sparkles">Perfume / Brilho</option>
                    <option value="science">Químico / Fórmula</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Cor do Badge
                  </label>
                  <input 
                    type="color"
                    value={formData.cor}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    style={{
                      width: '100%',
                      height: '46px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--color-outline-variant)',
                      cursor: 'pointer',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
              </div>

              <div style={{ padding: '14px', backgroundColor: 'var(--color-surface-container-low)', borderRadius: '12px', border: '1px solid var(--color-outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ fontSize: '13.5px', color: 'var(--color-on-surface)', display: 'block' }}>Exibir na Loja Virtual (/loja)</strong>
                  <span style={{ fontSize: '11.5px', color: 'var(--color-outline)' }}>Mostra esta categoria na barra de filtros da loja.</span>
                </div>
                <input 
                  type="checkbox"
                  checked={formData.ativo_loja}
                  onChange={(e) => setFormData({ ...formData, ativo_loja: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid var(--color-outline-variant)', background: 'white', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ flex: 1.5, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#0b5ea8', color: 'white', fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}
                >
                  {saving ? 'Salvando...' : 'Salvar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
