'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Pedido, Driver } from '@/models/types';
import { formatCurrency } from '@/utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  availableOrders: Pedido[];
  drivers: Driver[];
  onSubmit: (params: {
    name: string;
    date: string;
    driver_id?: string;
    driver_name?: string;
    city?: string;
    departure_time?: string;
    notes?: string;
    orderIds: string[];
  }) => Promise<void>;
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

export default function CreateRouteModal({ open, onClose, availableOrders, drivers, onSubmit, loading }: Props) {
  const [step, setStep] = useState(1);

  // Form Fields
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [driverId, setDriverId] = useState('');
  const [city, setCity] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [notes, setNotes] = useState('');

  // Orders Selection
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
      setStep(1);
      setName('');
      setDate(new Date().toISOString().split('T')[0]);
      setDriverId('');
      setCity('');
      setDepartureTime('');
      setNotes('');
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

  const handleSubmit = async () => {
    if (!name || !date || selectedOrders.size === 0) return;
    const d = drivers.find(drv => drv.id === driverId);
    await onSubmit({
      name, date, driver_id: driverId || undefined, driver_name: d?.nome,
      city, departure_time: departureTime, notes, orderIds: Array.from(selectedOrders)
    });
  };

  const canProceedToStep2 = name.trim().length > 0 && date.length > 0;
  const canSubmit = selectedOrders.size > 0 && !loading;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '20px',
        width: '100%', maxWidth: step === 1 ? '500px' : '900px',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        transition: 'max-width 0.3s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>
              Nova Rota <span style={{ color: 'var(--color-primary)', fontSize: '14px', marginLeft: '8px' }}>— Passo {step} de 2</span>
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
              {step === 1 ? 'Defina os dados básicos da rota' : 'Selecione os pedidos para esta rota'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'var(--color-on-surface-variant)' }}>close</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Nome da Rota <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Rota Centro, Rota Norte..." style={inputStyle} autoFocus />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Data <span style={{ color: 'var(--color-error)' }}>*</span></label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Previsão de Saída</label>
                  <input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Motorista</label>
                  <select value={driverId} onChange={e => setDriverId(e.target.value)} style={inputStyle}>
                    <option value="">(Nenhum / Definir depois)</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Cidade Foco (opcional)</label>
                  <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Ex: Brasília" style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Observações da Rota</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anotações para o motorista..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
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

              <div style={{ flex: 1, border: '1px solid var(--color-outline-variant)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                  <thead style={{ backgroundColor: 'var(--color-surface-container-highest)', borderBottom: '1px solid var(--color-outline-variant)' }}>
                    <tr>
                      <th style={{ padding: '10px 12px', width: '40px' }}></th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase' }}>Pedido</th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase' }}>Cliente</th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase' }}>Região</th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(o => {
                      const isSelected = selectedOrders.has(o.id);
                      return (
                        <tr key={o.id} style={{ borderBottom: '1px solid var(--color-outline-variant)', backgroundColor: isSelected ? 'rgba(0,86,117,0.05)' : 'transparent', cursor: 'pointer' }} onClick={() => toggleOrder(o.id)}>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <input type="checkbox" checked={isSelected} readOnly style={{ cursor: 'pointer' }} />
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)' }}>#{o.numero_pedido}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600 }}>{o.cliente?.nome || o.nome_cliente || '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px' }}>
                            <strong>{o.cliente?.bairro || o.bairro || '—'}</strong>
                            <br/><span style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px' }}>{o.cliente?.cidade || o.cidade}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 700 }}>{formatCurrency(o.valor_total)}</td>
                        </tr>
                      );
                    })}
                    {filteredOrders.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>Nenhum pedido encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between' }}>
          {step === 1 ? (
            <>
              <button onClick={onClose} style={{ padding: '12px 20px', borderRadius: '10px', backgroundColor: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => setStep(2)} disabled={!canProceedToStep2} style={{ padding: '12px 20px', borderRadius: '10px', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', fontWeight: 700, cursor: !canProceedToStep2 ? 'not-allowed' : 'pointer', opacity: !canProceedToStep2 ? 0.5 : 1 }}>Selecionar Pedidos ➔</button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} style={{ padding: '12px 20px', borderRadius: '10px', backgroundColor: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', fontWeight: 700, cursor: 'pointer' }}>⬅ Voltar</button>
              <button onClick={handleSubmit} disabled={!canSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '10px', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', fontWeight: 700, cursor: !canSubmit ? 'not-allowed' : 'pointer', opacity: !canSubmit ? 0.5 : 1 }}>
                {loading ? <span className="material-symbols-outlined" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>}
                Criar Rota ({selectedOrders.size} pedidos)
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
