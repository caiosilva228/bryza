'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Pedido } from '@/models/types';
import { formatCurrency } from '@/utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  availableOrders: Pedido[];
  onSubmit: (orderIds: string[]) => Promise<void>;
  loading?: boolean;
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--color-outline-variant)',
  backgroundColor: 'var(--color-surface)',
  fontSize: '13px',
  fontFamily: 'var(--font-body)',
  color: 'var(--color-on-surface)',
  outline: 'none',
};

export default function AddOrdersToRouteModal({ open, onClose, availableOrders, onSubmit, loading }: Props) {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  
  // Orders Filter
  const [orderSearch, setOrderSearch] = useState('');
  const [orderCity, setOrderCity] = useState('');
  const [orderBairro, setOrderBairro] = useState('');

  // Cidades e bairros dinâmicos disponíveis
  const availableCities = useMemo(() => Array.from(new Set(availableOrders.map(o => o.cliente?.cidade || o.cidade || '').filter(Boolean))).sort(), [availableOrders]);
  const availableBairros = useMemo(() => Array.from(new Set(availableOrders.map(o => o.cliente?.bairro || o.bairro || '').filter(Boolean))).sort(), [availableOrders]);

  const filteredOrders = useMemo(() => {
    let list = availableOrders;
    if (orderSearch) {
      const q = orderSearch.toLowerCase();
      list = list.filter(o => 
        o.numero_pedido.toLowerCase().includes(q) ||
        (o.cliente?.nome || o.nome_cliente || '').toLowerCase().includes(q)
      );
    }
    if (orderCity) list = list.filter(o => (o.cliente?.cidade || o.cidade) === orderCity);
    if (orderBairro) list = list.filter(o => (o.cliente?.bairro || o.bairro) === orderBairro);
    return list;
  }, [availableOrders, orderSearch, orderCity, orderBairro]);

  useEffect(() => {
    if (open) {
      setSelectedOrders(new Set());
      setOrderSearch('');
      setOrderCity('');
      setOrderBairro('');
    }
  }, [open]);

  if (!open) return null;

  const toggleOrder = (id: string) => {
    const next = new Set(selectedOrders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrders(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedOrders);
    filteredOrders.forEach(o => next.add(o.id));
    setSelectedOrders(next);
  };

  const handleClearSelection = () => {
    setSelectedOrders(new Set());
  };

  const handleConfirm = async () => {
    if (selectedOrders.size === 0) return;
    await onSubmit(Array.from(selectedOrders));
  };

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--color-on-surface)' }}>Adicionar Pedidos à Rota</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>Selecione pedidos adicionais para acoplar a esta rota de entrega.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-outline)' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 32px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="Buscar pedido..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} style={{ ...inputStyle, flex: '2 1 200px' }} />
            <select value={orderCity} onChange={e => setOrderCity(e.target.value)} style={{ ...inputStyle, flex: '1 1 120px' }}>
              <option value="">Todas as Cidades</option>
              {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={orderBairro} onChange={e => setOrderBairro(e.target.value)} style={{ ...inputStyle, flex: '1 1 120px' }}>
              <option value="">Todos os Bairros</option>
              {availableBairros.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>
              {filteredOrders.length} pedido(s) filtrado(s) | {selectedOrders.size} selecionado(s)
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSelectAllFiltered} style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--color-primary)', backgroundColor: 'transparent', color: 'var(--color-primary)', cursor: 'pointer' }}>Selecionar Filtrados</button>
              <button onClick={handleClearSelection} style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--color-error)', backgroundColor: 'transparent', color: 'var(--color-error)', cursor: 'pointer' }}>Limpar Seleção</button>
            </div>
          </div>

          {availableOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '8px' }}>assignment_turned_in</span>
              <p style={{ margin: 0, fontSize: '14px' }}>Não há pedidos prontos para entrega disponíveis.</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '8px' }}>search_off</span>
              <p style={{ margin: 0, fontSize: '14px' }}>Nenhum pedido atende aos filtros definidos.</p>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--color-outline-variant)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                  <thead style={{ backgroundColor: 'var(--color-surface-container-highest)', borderBottom: '1px solid var(--color-outline-variant)' }}>
                    <tr>
                      <th style={{ padding: '10px 12px', width: '40px' }}></th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase' }}>Pedido</th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase' }}>Cliente</th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase' }}>Região</th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(o => {
                      const isSel = selectedOrders.has(o.id);
                      return (
                        <tr 
                          key={o.id} 
                          onClick={() => toggleOrder(o.id)}
                          style={{ 
                            borderBottom: '1px solid var(--color-outline-variant)', 
                            cursor: 'pointer',
                            backgroundColor: isSel ? 'rgba(0, 86, 117, 0.04)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={isSel} 
                              onChange={() => {}} 
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
                            />
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>{o.numero_pedido}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                              {new Date(o.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700 }}>{o.cliente?.nome || o.nome_cliente}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                              {o.cliente?.endereco || o.endereco_entrega}, {o.cliente?.numero || 'S/N'}
                            </div>
                          </td>
                          <td style={{ padding: '12px', fontSize: '12px' }}>
                            <div>{o.cliente?.cidade || o.cidade}</div>
                            <div style={{ color: 'var(--color-outline)', fontSize: '11px' }}>{o.cliente?.bairro || o.bairro}</div>
                          </td>
                          <td style={{ padding: '12px', fontSize: '13px', fontWeight: 800, textAlign: 'right' }}>
                            {formatCurrency(o.valor_total || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 32px', borderTop: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            onClick={onClose} 
            disabled={loading}
            style={{
              padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--color-outline-variant)',
              backgroundColor: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-headline)'
            }}
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm} 
            disabled={loading || selectedOrders.size === 0}
            style={{
              padding: '12px 24px', borderRadius: '12px', border: 'none',
              backgroundColor: selectedOrders.size === 0 ? 'var(--color-outline-variant)' : 'var(--color-primary)',
              color: '#fff', fontSize: '14px', fontWeight: 700, cursor: selectedOrders.size === 0 ? 'default' : 'pointer',
              fontFamily: 'var(--font-headline)'
            }}
          >
            {loading ? 'Adicionando...' : `Adicionar ${selectedOrders.size} Pedido(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
