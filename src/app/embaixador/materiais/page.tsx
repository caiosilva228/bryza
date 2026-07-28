'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { toast } from 'sonner';
import { Download, FileText, Image as ImageIcon, Video, File, Filter, Search } from 'lucide-react';
import { getPublicPromotionalMaterialsAction } from '../actions';

interface PublicMaterialItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
}

export default function MateriaisPage() {
  const [materials, setMaterials] = useState<PublicMaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getPublicPromotionalMaterialsAction();
      if (res.success && res.materials) {
        setMaterials(res.materials);
      } else {
        toast.error('Não foi possível carregar os materiais de divulgação.');
      }
      setLoading(false);
    }
    load();
  }, []);

  const categories = ['Todas', ...Array.from(new Set(materials.map(m => m.category)))];

  const filteredMaterials = materials.filter(m => {
    const matchesCat = selectedCategory === 'Todas' || m.category === selectedCategory;
    const matchesSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(search.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const getFileIcon = (fileType?: string | null, url?: string) => {
    if (fileType?.startsWith('image/') || url?.match(/\.(jpeg|jpg|gif|png|svg|webp)$/i)) {
      return <ImageIcon size={22} color="#2563eb" />;
    }
    if (fileType?.startsWith('video/') || url?.match(/\.(mp4|webm|mov)$/i) || url?.includes('youtube') || url?.includes('vimeo')) {
      return <Video size={22} color="#7c3aed" />;
    }
    if (fileType?.includes('pdf') || url?.match(/\.pdf$/i)) {
      return <FileText size={22} color="#dc2626" />;
    }
    return <File size={22} color="#64748b" />;
  };

  const handleDownload = (item: PublicMaterialItem) => {
    if (!item.file_url) {
      toast.info('Material temporariamente indisponível.');
      return;
    }
    window.open(item.file_url, '_blank');
  };

  return (
    <MainLayout>
      <div style={{ maxWidth: '1000px', margin: '0 auto 40px', padding: '0 16px' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1
            style={{
              color: 'var(--color-primary)',
              fontSize: '28px',
              fontFamily: 'var(--font-headline)',
              fontWeight: 800,
              margin: 0,
            }}
          >
            Materiais de Divulgação
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '6px' }}>
            Recursos visuais, logomarcas, artes para redes sociais e manuais oficiais para alavancar suas indicações.
          </p>
        </header>

        {/* PESQUISA E FILTROS DE CATEGORIA */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar materiais de divulgação…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '38px',
                paddingRight: '12px',
                height: '42px',
                borderRadius: '8px',
                border: '1px solid var(--color-outline-variant)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-on-surface)',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '20px',
                  border: selectedCategory === cat ? 'none' : '1px solid var(--color-outline-variant)',
                  backgroundColor: selectedCategory === cat ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: selectedCategory === cat ? 'var(--color-on-primary)' : 'var(--color-on-surface)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* LISTA DE MATERIAIS */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-on-surface-variant)' }}>
            Carregando materiais de divulgação…
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div
            style={{
              backgroundColor: 'var(--color-surface-container-low)',
              border: '2px dashed var(--color-outline-variant)',
              borderRadius: '16px',
              padding: '48px',
              textAlign: 'center',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            <Filter size={44} color="#94a3b8" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 6px 0' }}>
              Nenhum material encontrado
            </h3>
            <p style={{ fontSize: '14px', margin: 0 }}>
              {search ? 'Tente pesquisar com outros termos.' : 'Não há materiais disponíveis nesta categoria no momento.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {filteredMaterials.map(item => (
              <div
                key={item.id}
                style={{
                  backgroundColor: 'var(--color-surface-container-low)',
                  padding: '24px',
                  borderRadius: '16px',
                  border: '1px solid var(--color-outline-variant)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'var(--color-secondary-container)',
                        color: 'var(--color-on-secondary-container)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.category}
                    </span>
                    <div style={{ padding: '6px', backgroundColor: 'var(--color-surface)', borderRadius: '8px' }}>
                      {getFileIcon(item.file_type, item.file_url)}
                    </div>
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)', marginTop: '4px', marginBottom: '8px', lineHeight: 1.3 }}>
                    {item.title}
                  </h3>
                  {item.description && (
                    <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', lineHeight: 1.5, margin: 0 }}>
                      {item.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDownload(item)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  }}
                >
                  <Download size={18} />
                  Baixar / Acessar Material
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
