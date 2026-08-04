'use client';

import { useState } from 'react';
import { Kit, Produto } from '@/models/types';
import KitFormModal from './KitFormModal';
import { deleteKitAction, toggleStatusKitAction, toggleStatusKitLojaAction } from './actions';

interface KitsConfigTabProps {
  initialKits: Kit[];
  produtos: Produto[];
}

export default function KitsConfigTab({ initialKits, produtos }: KitsConfigTabProps) {
  const [kits, setKits] = useState(initialKits);
  const [editing, setEditing] = useState<Kit | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = kits.filter(kit => kit.nome.toLowerCase().includes(search.toLowerCase()));

  const updateKit = (kit: Kit) => {
    const previousId = editing?.id;
    setKits(current => [
      kit,
      ...current
        .map(item => item.id === previousId ? { ...item, ativo: false, ativo_loja: false } : item)
        .filter(item => item.id !== kit.id),
    ]);
    setFormOpen(false);
    setEditing(null);
  };

  const toggle = async (kit: Kit, field: 'ativo' | 'ativo_loja') => {
    const result = field === 'ativo'
      ? await toggleStatusKitAction(kit.id, !kit.ativo)
      : await toggleStatusKitLojaAction(kit.id, !kit.ativo_loja);
    if (result.success) setKits(current => current.map(item => item.id === kit.id ? { ...item, [field]: field === 'ativo' ? !kit.ativo : !kit.ativo_loja, ...(field === 'ativo' && kit.ativo ? { ativo_loja: false } : {}) } : item));
    else alert(result.error || 'Nao foi possivel alterar o kit.');
  };

  const remove = async (kit: Kit) => {
    if (!window.confirm(`Excluir o kit "${kit.nome}"? O historico de pedidos sera preservado.`)) return;
    const result = await deleteKitAction(kit.id);
    if (result.success) setKits(current => current.filter(item => item.id !== kit.id));
    else alert(result.error || 'Nao foi possivel excluir o kit.');
  };

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Kits promocionais</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--color-on-surface-variant)', fontSize: '13px' }}>Cada kit deriva sua disponibilidade dos produtos componentes.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar kit..." style={{ padding: '10px 12px', border: '1px solid var(--color-outline-variant)', borderRadius: '9px' }} />
          <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><span className="material-symbols-outlined">add</span>Novo Kit</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '16px' }}>
        {filtered.map(kit => (
          <article key={kit.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <div><h3 style={{ margin: 0, fontSize: '17px' }}>{kit.nome}</h3><p style={{ margin: '5px 0', fontWeight: 800, color: '#0b5ea8' }}>R$ {Number(kit.preco_venda).toFixed(2).replace('.', ',')}</p></div>
              <span style={{ color: kit.ativo && kit.ativo_loja ? '#4d7c0f' : '#64748b', fontSize: '11px', fontWeight: 800 }}>{kit.ativo && kit.ativo_loja ? 'PUBLICADO' : kit.ativo ? 'RASCUNHO' : 'INATIVO'}</span>
            </div>
            <ul style={{ minHeight: '52px', margin: '10px 0', paddingLeft: '18px', color: 'var(--color-on-surface-variant)', fontSize: '12px' }}>
              {(kit.itens || []).map(item => <li key={item.id}>{item.quantidade}x {item.produto?.nome_produto || item.produto_id}</li>)}
            </ul>
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
              <button className="btn-secondary" onClick={() => { setEditing(kit); setFormOpen(true); }}>Editar</button>
              <button className="btn-secondary" onClick={() => toggle(kit, 'ativo')}>{kit.ativo ? 'Inativar' : 'Ativar'}</button>
              <button className="btn-secondary" disabled={!kit.ativo} onClick={() => toggle(kit, 'ativo_loja')}>{kit.ativo_loja ? 'Tirar da loja' : 'Publicar'}</button>
              <button onClick={() => remove(kit)} style={{ border: 0, background: '#fee2e2', color: '#b91c1c', borderRadius: '7px', padding: '7px 9px', cursor: 'pointer' }}>Excluir</button>
            </div>
          </article>
        ))}
      </div>
      {filtered.length === 0 && <p style={{ padding: '36px 0', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>Nenhum kit cadastrado.</p>}
      {formOpen && <KitFormModal kit={editing} produtos={produtos} onClose={() => { setFormOpen(false); setEditing(null); }} onSuccess={updateKit} />}
    </section>
  );
}
