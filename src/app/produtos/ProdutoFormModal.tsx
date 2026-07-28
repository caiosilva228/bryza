'use client';

import { useState, useEffect } from 'react';
import { Produto } from '@/models/types';
import { saveProduto } from './actions';
import { createClient } from '@/utils/supabase/client';
import ProductImageLibrary from './ProductImageLibrary';

interface ProdutoFormModalProps {
  produto?: Produto | null;
  onClose: () => void;
  onSuccess: (produto: Produto) => void;
  onImageDeleted: (imageUrl: string) => void;
}

export default function ProdutoFormModal({
  produto,
  onClose,
  onSuccess,
  onImageDeleted,
}: ProdutoFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isImageLibraryOpen, setIsImageLibraryOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome_produto: '',
    categoria: 'Produto Final',
    categorias_adicionais: [] as string[],
    unidade: 'UN',
    custo_unitario: 0,
    preco_venda: 0,
    preco_original: 0,
    estoque_atual: 0,
    estoque_minimo: 5,
    ativo: true,
    ativo_loja: true,
    imagem_url: '',
    descricao: '',
  });

  useEffect(() => {
    if (produto) {
      setFormData({
        nome_produto: produto.nome_produto,
        categoria: produto.categoria,
        categorias_adicionais: produto.categorias_adicionais || [],
        unidade: produto.unidade,
        custo_unitario: produto.custo_unitario,
        preco_venda: produto.preco_venda,
        preco_original: produto.preco_original || 0,
        estoque_atual: produto.estoque_atual,
        estoque_minimo: produto.estoque_minimo,
        ativo: produto.ativo,
        ativo_loja: produto.ativo_loja !== undefined ? produto.ativo_loja : true,
        imagem_url: produto.imagem_url || '',
        descricao: produto.descricao || '',
      });
    }
  }, [produto]);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'svg' && file.type !== 'image/svg+xml') {
      alert('⚠️ Formato inválido! É OBRIGATÓRIO enviar a imagem do produto no formato SVG (.svg) com tamanho recomendado de 500x500px.');
      e.target.value = '';
      return;
    }

    try {
      setUploadingImage(true);
      const supabase = createClient();
      const fileName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.svg`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { 
          upsert: true,
          contentType: 'image/svg+xml'
        });

      if (uploadError) {
        console.error('Erro no upload da imagem:', uploadError);
        alert('Falha ao subir a imagem do produto.');
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      setFormData(prev => ({ ...prev, imagem_url: publicUrl }));
    } catch (err) {
      console.error('Erro no envio da imagem:', err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload: Partial<Produto> = {
      ...formData,
      ativo_loja: formData.ativo ? formData.ativo_loja : false,
      ...(produto && { id: produto.id }),
    };

    const res = await saveProduto(payload);

    if (res.success && res.data) {
      onSuccess(res.data as Produto);
    } else {
      alert('Erro ao salvar produto. Verifique os dados e tente novamente.');
    }
    setLoading(false);
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.5)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 1000,
      backdropFilter: 'blur(12px)',
      padding: '16px'
    }}>
      <div style={{ 
        backgroundColor: 'var(--color-surface)', 
        width: '100%', 
        maxWidth: '640px', 
        maxHeight: '90vh',
        borderRadius: '24px', 
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        border: '1px solid var(--color-outline-variant)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Cabeçalho Fixo */}
        <div style={{ 
          padding: '20px 28px', 
          backgroundColor: 'var(--color-surface-container-lowest)', 
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexShrink: 0
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--color-on-surface)', margin: 0 }}>
            {produto ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button 
            onClick={onClose} 
            style={{ 
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface-container-high)',
              border: 'none', 
              cursor: 'pointer', 
              color: 'var(--color-on-surface-variant)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-highest)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Formulário com Corpo Rolável e Rodapé Fixo */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}>
          {/* Corpo Rolável dos Campos */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Foto / Imagem do Produto */}
              <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                Foto / Imagem do Produto (E-Commerce & Catálogo)
              </label>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                padding: '16px',
                borderRadius: '16px',
                border: '1.5px dashed var(--color-outline-variant)',
                backgroundColor: 'var(--color-surface-container-lowest)'
              }}>
                {/* Preview Box */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface-container-high)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                  position: 'relative'
                }}>
                  {formData.imagem_url ? (
                    <img
                      src={formData.imagem_url}
                      alt="Preview do produto"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--color-outline)' }}>
                      add_a_photo
                    </span>
                  )}
                </div>

                {/* Upload Actions */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-primary)',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: uploadingImage ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload</span>
                      {uploadingImage ? 'Enviando...' : 'Carregar Imagem'}
                      <input
                        type="file"
                        accept=".svg,image/svg+xml"
                        onChange={handleImageFileChange}
                        disabled={uploadingImage}
                        style={{ display: 'none' }}
                      />
                    </label>

                    {produto && (
                      <button
                        type="button"
                        onClick={() => setIsImageLibraryOpen(true)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--color-primary)',
                          backgroundColor: 'transparent',
                          color: 'var(--color-primary)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          photo_library
                        </span>
                        Biblioteca
                      </button>
                    )}

                    {formData.imagem_url && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imagem_url: '' })}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--color-outline)',
                          backgroundColor: 'transparent',
                          color: 'var(--color-error)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Remover Foto
                      </button>
                    )}
                  </div>

                  {/* Aviso de formato obrigatório SVG 500x500 */}
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#b45309',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fde68a',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#b45309' }}>info</span>
                    Formato OBRIGATÓRIO: SVG (.svg) | Dimensão recomendada: 500x500px
                  </div>

                  {/* URL Input alternativo */}
                  <input
                    type="url"
                    placeholder="Ou cole a URL direta da imagem..."
                    value={formData.imagem_url}
                    onChange={(e) => setFormData({ ...formData, imagem_url: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-outline-variant)',
                      fontSize: '12px',
                      backgroundColor: 'white',
                      color: 'var(--color-on-surface)'
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Nome do Produto</label>
              <input 
                type="text" 
                required 
                value={formData.nome_produto}
                onChange={(e) => setFormData({ ...formData, nome_produto: e.target.value })}
                placeholder="Ex: Bryza Tradicional 500ml"
                style={{ 
                  width: '100%', 
                  padding: '14px 18px', 
                  border: '1.5px solid var(--color-outline-variant)', 
                  borderRadius: '16px', 
                  backgroundColor: 'white', 
                  color: 'var(--color-on-surface)',
                  fontSize: '15px',
                  fontWeight: 500,
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            {/* Descrição do Produto */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                Descrição do Produto (Exibida no detalhe do produto na Loja Virtual)
              </label>
              <textarea 
                value={formData.descricao || ''}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Informe detalhes do produto, modo de uso, aroma, benefícios e características..."
                style={{ 
                  width: '100%', 
                  padding: '14px 18px', 
                  border: '1.5px solid var(--color-outline-variant)', 
                  borderRadius: '16px', 
                  backgroundColor: 'white', 
                  color: 'var(--color-on-surface)',
                  fontSize: '14px',
                  fontWeight: 500,
                  minHeight: '90px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Categoria Principal</label>
              <select 
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                style={{ 
                  width: '100%', 
                  padding: '14px 18px', 
                  border: '1.5px solid var(--color-outline-variant)', 
                  borderRadius: '16px', 
                  backgroundColor: 'white', 
                  color: 'var(--color-on-surface)',
                  fontSize: '15px',
                  fontWeight: 500
                }}
              >
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

            {/* Categorias Adicionais */}
            <div style={{ gridColumn: 'span 2', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#051329', display: 'block', marginBottom: '4px' }}>
                Exibir também em outras Categorias (Opcional)
              </label>
              <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginBottom: '10px' }}>
                O produto aparecerá nessas categorias sem duplicar ao listar todas as categorias.
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[
                  'Lava Roupas',
                  'Amaciantes',
                  'Multiuso',
                  'Panos & Limpeza',
                  'Sacos de Lixo',
                  'Kits Promocionais',
                  'Materia prima',
                  'Embalagem',
                  'Outros'
                ].filter(cat => cat !== formData.categoria).map(cat => {
                  const isChecked = formData.categorias_adicionais.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setFormData(prev => {
                          const list = prev.categorias_adicionais || [];
                          const updated = list.includes(cat) 
                            ? list.filter(c => c !== cat) 
                            : [...list, cat];
                          return { ...prev, categorias_adicionais: updated };
                        });
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '999px',
                        border: isChecked ? '1px solid #0b5ea8' : '1px solid #cbd5e1',
                        backgroundColor: isChecked ? '#f0f6fc' : '#ffffff',
                        color: isChecked ? '#0b5ea8' : '#475569',
                        fontWeight: isChecked ? 700 : 500,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {isChecked ? 'check_box' : 'square'}
                      </span>
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div style={{ gridColumn: 'span 2', padding: '16px', backgroundColor: 'var(--color-surface-container-low)', borderRadius: '16px', border: '1px solid var(--color-outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--color-on-surface)', display: 'block' }}>Exibir na Loja Virtual (/loja)</strong>
                <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>Permite que os embaixadores visualizem e comprem este produto na loja virtual.</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                <input 
                  type="checkbox"
                  checked={formData.ativo_loja}
                  onChange={(e) => setFormData({ ...formData, ativo_loja: e.target.checked })}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 700, color: formData.ativo_loja ? '#16a34a' : '#64748b' }}>
                  {formData.ativo_loja ? 'Ativo na Loja' : 'Oculto na Loja'}
                </span>
              </label>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Unidade de Medida</label>
              <input 
                type="text" 
                required 
                value={formData.unidade}
                placeholder="Ex: UN, KG, L, CAIXA"
                onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                style={{ 
                  width: '100%', 
                  padding: '14px 18px', 
                  border: '1.5px solid var(--color-outline-variant)', 
                  borderRadius: '16px', 
                  backgroundColor: 'white', 
                  color: 'var(--color-on-surface)',
                  fontSize: '15px',
                  fontWeight: 500
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Custo Unitário</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--color-outline)', fontSize: '14px' }}>R$</span>
                <input 
                  type="number" 
                  step="0.01" 
                  required 
                  value={formData.custo_unitario}
                  onChange={(e) => setFormData({ ...formData, custo_unitario: Number(e.target.value) })}
                  style={{ 
                    width: '100%', 
                    padding: '14px 18px 14px 40px', 
                    border: '1.5px solid var(--color-outline-variant)', 
                    borderRadius: '16px', 
                    backgroundColor: 'white', 
                    color: 'var(--color-on-surface)',
                    fontSize: '15px',
                    fontWeight: 500
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Preço de Venda (Preço Final)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--color-outline)', fontSize: '14px' }}>R$</span>
                <input 
                  type="number" 
                  step="0.01" 
                  required 
                  value={formData.preco_venda}
                  onChange={(e) => setFormData({ ...formData, preco_venda: Number(e.target.value) })}
                  style={{ 
                    width: '100%', 
                    padding: '14px 18px 14px 40px', 
                    border: '1.5px solid var(--color-outline-variant)', 
                    borderRadius: '16px', 
                    backgroundColor: 'white', 
                    color: 'var(--color-on-surface)',
                    fontSize: '15px',
                    fontWeight: 500
                  }}
                />
              </div>
            </div>

            {/* Campo Preço Original / Sem Desconto */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                Preço Original / Sem Desconto (Opcional)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--color-outline)', fontSize: '14px' }}>R$</span>
                <input 
                  type="number" 
                  step="0.01" 
                  value={formData.preco_original || ''}
                  placeholder="Ex: 49.90 (Preço Riscado DE)"
                  onChange={(e) => setFormData({ ...formData, preco_original: Number(e.target.value) })}
                  style={{ 
                    width: '100%', 
                    padding: '14px 18px 14px 40px', 
                    border: '1.5px solid var(--color-outline-variant)', 
                    borderRadius: '16px', 
                    backgroundColor: 'white', 
                    color: 'var(--color-on-surface)',
                    fontSize: '15px',
                    fontWeight: 500
                  }}
                />
              </div>
              {formData.preco_original > formData.preco_venda && formData.preco_venda > 0 && (
                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, marginTop: '4px', display: 'block' }}>
                  🏷️ Desconto ativo: {Math.round(((formData.preco_original - formData.preco_venda) / formData.preco_original) * 100)}% de desconto (aparecerá riscado ~R$ {formData.preco_original.toFixed(2)}~ na loja)
                </span>
              )}
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Estoque Atual</label>
              <input 
                type="number" 
                required 
                disabled={!!produto}
                value={formData.estoque_atual}
                onChange={(e) => setFormData({ ...formData, estoque_atual: Number(e.target.value) })}
                style={{ 
                  width: '100%', 
                  padding: '14px 18px', 
                  border: '1.5px solid var(--color-outline-variant)', 
                  borderRadius: '16px', 
                  backgroundColor: produto ? 'var(--color-surface-container-low)' : 'white', 
                  color: 'var(--color-on-surface)',
                  fontSize: '15px',
                  fontWeight: 500,
                  opacity: produto ? 0.7 : 1 
                }}
              />
              {produto && <p style={{ fontSize: '10px', marginTop: '6px', color: 'var(--color-outline)', fontWeight: 600 }}>Use a aba Estoque para ajustes de entrada/saída.</p>}
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Estoque Mínimo</label>
              <input 
                type="number" 
                required 
                value={formData.estoque_minimo}
                onChange={(e) => setFormData({ ...formData, estoque_minimo: Number(e.target.value) })}
                style={{ 
                  width: '100%', 
                  padding: '14px 18px', 
                  border: '1.5px solid var(--color-outline-variant)', 
                  borderRadius: '16px', 
                  backgroundColor: 'white', 
                  color: 'var(--color-on-surface)',
                  fontSize: '15px',
                  fontWeight: 500
                }}
              />
            </div>
          </div>
          </div>

          {/* Rodapé Fixo de Ações */}
          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            padding: '16px 28px 20px', 
            backgroundColor: 'var(--color-surface-container-lowest)', 
            borderTop: '1px solid var(--color-outline-variant)',
            flexShrink: 0 
          }}>
            <button 
              type="button" 
              onClick={onClose}
              style={{ 
                flex: 1, 
                padding: '14px', 
                borderRadius: '14px', 
                border: '1.5px solid var(--color-outline-variant)', 
                backgroundColor: 'white', 
                color: 'var(--color-on-surface-variant)', 
                fontWeight: 800, 
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                flex: 1.5, 
                padding: '14px', 
                borderRadius: '14px', 
                border: 'none', 
                backgroundColor: 'var(--color-primary)', 
                color: '#fff', 
                fontWeight: 800, 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '10px',
                boxShadow: '0 8px 16px rgba(var(--color-primary-rgb), 0.2)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: '22px' }}>sync</span>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>save</span>
                  {produto ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </>
              )}
            </button>
          </div>
        </form>

        {isImageLibraryOpen && (
          <ProductImageLibrary
            currentImageUrl={formData.imagem_url}
            onClose={() => setIsImageLibraryOpen(false)}
            onSelect={(imageUrl) => {
              setFormData((current) => ({ ...current, imagem_url: imageUrl }));
            }}
            onDelete={(deletedUrl) => {
              if (formData.imagem_url === deletedUrl) {
                setFormData((current) => ({ ...current, imagem_url: '' }));
              }
              onImageDeleted(deletedUrl);
            }}
          />
        )}

        <style jsx>{`
          @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
