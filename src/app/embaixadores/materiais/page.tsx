'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { toast } from 'sonner';
import {
  Upload,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Download,
  FileText,
  Image as ImageIcon,
  Video,
  File,
  Link as LinkIcon,
  CheckCircle2,
  XCircle,
  X,
  Search,
  Filter,
} from 'lucide-react';
import {
  getAdminPromotionalMaterialsAction,
  createPromotionalMaterialAction,
  updatePromotionalMaterialAction,
  deletePromotionalMaterialAction,
  uploadPromotionalFileAction,
  type PromotionalMaterialItem,
} from './actions';

const DEFAULT_CATEGORIES = [
  'Branding',
  'Redes Sociais',
  'Vídeos',
  'Capacitação',
  'Geral',
];

export default function AdminMateriaisPage() {
  const [materials, setMaterials] = useState<PromotionalMaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');

  // Form State
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Redes Sociais');
  const [description, setDescription] = useState('');

  const loadMaterials = async () => {
    setLoading(true);
    const res = await getAdminPromotionalMaterialsAction();
    if (res.success && res.materials) {
      setMaterials(res.materials);
    } else {
      toast.error(res.error || 'Erro ao carregar materiais de divulgação.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const handleToggleActive = async (item: PromotionalMaterialItem) => {
    const newStatus = !item.active;
    const res = await updatePromotionalMaterialAction(item.id, { active: newStatus });
    if (res.success) {
      setMaterials(prev =>
        prev.map(m => (m.id === item.id ? { ...m, active: newStatus } : m))
      );
      toast.success(newStatus ? 'Material ativado com sucesso!' : 'Material desativado.');
    } else {
      toast.error(res.error || 'Erro ao alterar status.');
    }
  };

  const handleDelete = async (item: PromotionalMaterialItem) => {
    if (!confirm(`Tem certeza que deseja excluir o material "${item.title}"?`)) return;

    const res = await deletePromotionalMaterialAction(item.id);
    if (res.success) {
      setMaterials(prev => prev.filter(m => m.id !== item.id));
      toast.success('Material excluído com sucesso.');
    } else {
      toast.error(res.error || 'Erro ao excluir material.');
    }
  };

  const handleOpenModal = () => {
    setFile(null);
    setExternalUrl('');
    setTitle('');
    setCategory('Redes Sociais');
    setDescription('');
    setUploadMode('file');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Informe o título do material.');
      return;
    }

    setSaving(true);
    try {
      let finalFileUrl = '';
      let fileName = '';
      let fileSize: number | undefined = undefined;
      let fileType: string | undefined = undefined;

      if (uploadMode === 'file') {
        if (!file) {
          toast.error('Selecione um arquivo para upload.');
          setSaving(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await uploadPromotionalFileAction(formData);
        if (!uploadRes.success || !uploadRes.file_url) {
          toast.error(uploadRes.error || 'Falha ao enviar arquivo ao servidor.');
          setSaving(false);
          return;
        }

        finalFileUrl = uploadRes.file_url;
        fileName = uploadRes.file_name || file.name;
        fileSize = uploadRes.file_size_bytes || file.size;
        fileType = uploadRes.file_type || file.type;
      } else {
        if (!externalUrl.trim()) {
          toast.error('Informe o link do arquivo ou vídeo.');
          setSaving(false);
          return;
        }
        finalFileUrl = externalUrl.trim();
        fileName = 'Link Externo';
      }

      const res = await createPromotionalMaterialAction({
        title,
        description,
        category,
        file_url: finalFileUrl,
        file_name: fileName,
        file_size_bytes: fileSize,
        file_type: fileType,
      });

      if (res.success && res.data) {
        setMaterials(prev => [res.data!, ...prev]);
        toast.success('Material de divulgação anexado com sucesso!');
        setIsModalOpen(false);
      } else {
        toast.error(res.error || 'Erro ao salvar material.');
      }
    } catch {
      toast.error('Erro inesperado ao salvar material.');
    } finally {
      setSaving(false);
    }
  };

  const filteredMaterials = materials.filter(m => {
    const matchesCategory = selectedCategory === 'Todas' || m.category === selectedCategory;
    const matchesSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getFileIcon = (fileType?: string | null, url?: string) => {
    if (fileType?.startsWith('image/') || url?.match(/\.(jpeg|jpg|gif|png|svg|webp)$/i)) {
      return <ImageIcon size={20} color="#2563eb" />;
    }
    if (fileType?.startsWith('video/') || url?.match(/\.(mp4|webm|mov)$/i) || url?.includes('youtube') || url?.includes('vimeo')) {
      return <Video size={20} color="#7c3aed" />;
    }
    if (fileType?.includes('pdf') || url?.match(/\.pdf$/i)) {
      return <FileText size={20} color="#dc2626" />;
    }
    return <File size={20} color="#64748b" />;
  };

  const categoriesList = ['Todas', ...Array.from(new Set([...DEFAULT_CATEGORIES, ...materials.map(m => m.category)]))];

  return (
    <MainLayout>
      <div style={{ maxWidth: '1200px', margin: '0 auto 40px', padding: '0 16px' }}>
        {/* CABEÇALHO */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '26px',
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Upload size={28} color="#051329" />
              Materiais de Divulgação (Admin)
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
              Anexe e gerencie artes, logomarcas, vídeos e manuais para o portal dos embaixadores.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#051329',
              color: '#ffffff',
              border: 0,
              borderRadius: '10px',
              padding: '12px 20px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(5, 19, 41, 0.2)',
            }}
          >
            <Plus size={18} />
            Anexar Novo Material
          </button>
        </div>

        {/* ESTATÍSTICAS E FILTROS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total de Materiais</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{materials.length}</div>
            </div>
            <FileText size={32} color="#94a3b8" />
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Materiais Ativos</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a' }}>
                {materials.filter(m => m.active).length}
              </div>
            </div>
            <CheckCircle2 size={32} color="#22c55e" />
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Categorias</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb' }}>
                {new Set(materials.map(m => m.category)).size}
              </div>
            </div>
            <Filter size={32} color="#3b82f6" />
          </div>
        </div>

        {/* BARRA DE PESQUISA E FILTROS */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Pesquisar por título ou descrição…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '38px',
                paddingRight: '12px',
                height: '42px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {categoriesList.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '20px',
                  border: selectedCategory === cat ? 'none' : '1px solid #cbd5e1',
                  background: selectedCategory === cat ? '#051329' : '#ffffff',
                  color: selectedCategory === cat ? '#ffffff' : '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
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
          <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Carregando materiais de divulgação…</div>
        ) : filteredMaterials.length === 0 ? (
          <div
            style={{
              background: '#ffffff',
              border: '2px dashed #cbd5e1',
              borderRadius: '16px',
              padding: '48px',
              textAlign: 'center',
              color: '#64748b',
            }}
          >
            <Upload size={48} color="#cbd5e1" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
              Nenhum material encontrado
            </h3>
            <p style={{ fontSize: '14px', margin: 0 }}>
              {search ? 'Nenhum resultado para a pesquisa informada.' : 'Clique no botão "Anexar Novo Material" acima para adicionar o primeiro recurso.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {filteredMaterials.map(item => (
              <div
                key={item.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  opacity: item.active ? 1 : 0.65,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.category}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: item.active ? '#16a34a' : '#94a3b8',
                      }}
                    >
                      {item.active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {item.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      {getFileIcon(item.file_type, item.file_url)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                        {item.title}
                      </h3>
                      {item.description && (
                        <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: item.active ? '#dc2626' : '#16a34a',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {item.active ? <EyeOff size={15} /> : <Eye size={15} />}
                    {item.active ? 'Desativar' : 'Ativar'}
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: '#051329',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      <Download size={14} /> Acessar
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                      }}
                      title="Excluir material"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL DE UPLOAD DE MATERIAL */}
        {isModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(15, 23, 42, 0.7)',
              backdropFilter: 'blur(4px)',
              display: 'grid',
              placeItems: 'center',
              padding: '16px',
            }}
            onMouseDown={e => {
              if (e.target === e.currentTarget && !saving) setIsModalOpen(false);
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '560px',
                background: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
                overflow: 'hidden',
              }}
            >
              <header
                style={{
                  padding: '18px 24px',
                  background: '#051329',
                  color: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#a9bde9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Painel Administrativo
                  </span>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 800 }}>
                    Anexar Material de Divulgação
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  style={{ background: 'none', border: 0, color: '#ffffff', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </header>

              <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'grid', gap: '16px' }}>
                {/* Seleção do Modo: Upload x Link */}
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: 0,
                      background: uploadMode === 'file' ? '#ffffff' : 'transparent',
                      color: uploadMode === 'file' ? '#0f172a' : '#64748b',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: uploadMode === 'file' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Upload size={16} /> Upload de Arquivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('url')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: 0,
                      background: uploadMode === 'url' ? '#ffffff' : 'transparent',
                      color: uploadMode === 'url' ? '#0f172a' : '#64748b',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: uploadMode === 'url' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <LinkIcon size={16} /> Link Externo / Vídeo
                  </button>
                </div>

                {uploadMode === 'file' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Selecione o arquivo *
                    </label>
                    <div
                      style={{
                        border: '2px dashed #cbd5e1',
                        borderRadius: '10px',
                        padding: '24px',
                        textAlign: 'center',
                        background: '#f8fafc',
                        cursor: 'pointer',
                      }}
                      onClick={() => document.getElementById('file-upload-input')?.click()}
                    >
                      <Upload size={32} color="#64748b" style={{ marginBottom: '8px' }} />
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                        {file ? file.name : 'Clique aqui para escolher a arte, PDF ou vídeo'}
                      </p>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Suporta PNG, JPG, SVG, PDF, MP4 (Até 50MB)'}
                      </span>
                      <input
                        id="file-upload-input"
                        type="file"
                        style={{ display: 'none' }}
                        onChange={e => setFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      URL / Link do Arquivo ou Vídeo *
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/... ou https://youtube.com/..."
                      value={externalUrl}
                      onChange={e => setExternalUrl(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        height: '42px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        padding: '0 12px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Título do Material *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Banner Stories Instagram 1080x1920"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      padding: '0 12px',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Categoria *
                    </label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      style={{
                        width: '100%',
                        height: '42px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        padding: '0 12px',
                        fontSize: '14px',
                      }}
                    >
                      {DEFAULT_CATEGORIES.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Descrição (Opcional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Instruções para o embaixador sobre como utilizar este material…"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      padding: '10px 12px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={saving}
                    style={{
                      background: 'transparent',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      borderRadius: '8px',
                      padding: '0 18px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      height: '44px',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      background: '#051329',
                      color: '#ffffff',
                      border: 0,
                      borderRadius: '8px',
                      padding: '0 24px',
                      fontWeight: 700,
                      cursor: saving ? 'wait' : 'pointer',
                      height: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {saving ? 'Enviando material…' : 'Salvar Material'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
