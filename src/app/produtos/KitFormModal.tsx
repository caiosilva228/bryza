'use client';

import { useMemo, useState } from 'react';
import { Kit, Produto } from '@/models/types';
import { KitInput, saveKitAction } from './actions';

interface KitFormModalProps {
  kit: Kit | null;
  produtos: Produto[];
  onClose: () => void;
  onSuccess: (kit: Kit) => void;
}
export default function KitFormModal({ kit, produtos, onClose, onSuccess }: KitFormModalProps) {
  const [nome, setNome] = useState(kit?.nome || '');
  const [descricao, setDescricao] = useState(kit?.descricao || '');
  const [precoVenda, setPrecoVenda] = useState(String(kit?.preco_venda ?? ''));
  const [precoReferencia, setPrecoReferencia] = useState(String(kit?.preco_referencia ?? ''));
  const [imagemUrl, setImagemUrl] = useState(kit?.imagem_url || '');
  const [inicio, setInicio] = useState(kit?.vigencia_inicio || '');
  const [fim, setFim] = useState(kit?.vigencia_fim || '');
  const [ativo, setAtivo] = useState(kit?.ativo ?? true);
  const [ativoLoja, setAtivoLoja] = useState(kit?.ativo_loja ?? false);
  const [itens, setItens] = useState<Array<{ produto_id: string; quantidade: number }>>(
    (kit?.itens || []).map(item => ({ produto_id: item.produto_id, quantidade: item.quantidade })),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const availableProducts = useMemo(
    () => produtos.filter(produto => produto.ativo || itens.some(item => item.produto_id === produto.id)),
    [produtos, itens],
  );

  const updateItem = (index: number, patch: Partial<{ produto_id: string; quantidade: number }>) => {
    setItens(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    const input: KitInput = {
      id: kit?.id,
      nome,
      descricao,
      preco_venda: Number(precoVenda),
      preco_referencia: precoReferencia ? Number(precoReferencia) : null,
      imagem_url: imagemUrl,
      ativo,
      ativo_loja: ativoLoja,
      vigencia_inicio: inicio || null,
      vigencia_fim: fim || null,
      itens,
    };
    const result = await saveKitAction(input);
    setSaving(false);
    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel salvar o kit.');
      return;
    }
    onSuccess(result.data);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(5,19,41,0.64)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <form onSubmit={handleSubmit} style={{ width: 'min(720px, 100%)', maxHeight: '92vh', overflowY: 'auto', background: 'var(--color-surface)', borderRadius: '18px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.24)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0 }}> {kit ? 'Editar kit promocional' : 'Novo kit promocional'} </h2>
            <p style={{ margin: '6px 0 0', color: 'var(--color-on-surface-variant)', fontSize: '13px' }}>O estoque sera calculado pelos componentes.</p>
          </div>
          <button type="button" onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <label style={{ gridColumn: '1 / -1' }}>Nome do kit<input required value={nome} onChange={event => setNome(event.target.value)} /></label>
          <label>Preco promocional<input required min="0" step="0.01" type="number" value={precoVenda} onChange={event => setPrecoVenda(event.target.value)} /></label>
          <label>Preco de referencia<input min="0" step="0.01" type="number" value={precoReferencia} onChange={event => setPrecoReferencia(event.target.value)} /></label>
          <label>Inicio da vigencia<input type="date" value={inicio} onChange={event => setInicio(event.target.value)} /></label>
          <label>Fim da vigencia<input type="date" value={fim} onChange={event => setFim(event.target.value)} /></label>
          <label style={{ gridColumn: '1 / -1' }}>Imagem (URL)<input value={imagemUrl} onChange={event => setImagemUrl(event.target.value)} placeholder="https://..." /></label>
          <label style={{ gridColumn: '1 / -1' }}>Descricao<textarea value={descricao || ''} onChange={event => setDescricao(event.target.value)} rows={3} /></label>
        </div>

        <div style={{ marginTop: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <strong>Componentes fixos</strong>
            <button type="button" onClick={() => setItens(current => [...current, { produto_id: '', quantidade: 1 }])} style={{ border: 0, background: '#e8f4d2', color: '#365314', borderRadius: '8px', padding: '8px 12px', fontWeight: 800, cursor: 'pointer' }}>+ Adicionar produto</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {itens.map((item, index) => (
              <div key={`${index}-${item.produto_id}`} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 36px', gap: '8px', alignItems: 'center' }}>
                <select required value={item.produto_id} onChange={event => updateItem(index, { produto_id: event.target.value })}>
                  <option value="">Selecione o produto</option>
                  {availableProducts.map(produto => <option key={produto.id} value={produto.id}>{produto.nome_produto}</option>)}
                </select>
                <input required min="1" step="1" type="number" value={item.quantidade} onChange={event => updateItem(index, { quantidade: Number(event.target.value) })} aria-label="Quantidade do componente" />
                <button type="button" onClick={() => setItens(current => current.filter((_, itemIndex) => itemIndex !== index))} style={{ border: 0, background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', height: '38px', cursor: 'pointer' }} aria-label="Remover componente">×</button>
              </div>
            ))}
            {itens.length === 0 && <p style={{ color: '#b91c1c', fontSize: '13px' }}>Adicione pelo menos um produto.</p>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '18px', marginTop: '20px', flexWrap: 'wrap' }}>
          <label><input type="checkbox" checked={ativo} onChange={event => { setAtivo(event.target.checked); if (!event.target.checked) setAtivoLoja(false); }} /> Ativo</label>
          <label><input type="checkbox" checked={ativoLoja} disabled={!ativo} onChange={event => setAtivoLoja(event.target.checked)} /> Publicado na loja</label>
        </div>
        {error && <p style={{ color: '#b91c1c', background: '#fef2f2', borderRadius: '8px', padding: '10px 12px', fontSize: '13px' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar kit'}</button>
        </div>
      </form>
      <style>{`form label { display:flex; flex-direction:column; gap:6px; color:var(--color-on-surface); font-size:13px; font-weight:700 } form input:not([type=checkbox]), form select, form textarea { width:100%; box-sizing:border-box; border:1px solid var(--color-outline-variant); border-radius:8px; padding:10px; background:var(--color-surface); color:var(--color-on-surface); font:inherit; font-weight:400 }`}</style>
    </div>
  );
}
