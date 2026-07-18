'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

interface FilterProps {
  onFilterChange: (filters: {
    search: string;
    cpf: string;
    city: string;
    status: string;
    planId: string;
    startDate: string;
    endDate: string;
  }) => void;
}

export default function EmbaixadoresFilter({ onFilterChange }: FilterProps) {
  const [search, setSearch] = useState('');
  const [cpf, setCpf] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    // Buscar planos cadastrados
    const fetchPlans = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('commission_plans')
        .select('id, name')
        .order('name');
      if (data) setPlans(data);
    };
    fetchPlans();
  }, []);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      search,
      cpf: cpf.trim(), // Enviado somente via state
      city,
      status,
      planId,
      startDate,
      endDate
    });
  };

  const handleClear = () => {
    setSearch('');
    setCpf('');
    setCity('');
    setStatus('');
    setPlanId('');
    setStartDate('');
    setEndDate('');
    onFilterChange({
      search: '',
      cpf: '',
      city: '',
      status: '',
      planId: '',
      startDate: '',
      endDate: ''
    });
  };

  return (
    <form onSubmit={handleApplyFilters} style={{
      backgroundColor: 'var(--color-surface-container-low)',
      padding: '24px',
      borderRadius: '16px',
      border: '1px solid var(--color-outline-variant)',
      marginBottom: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        {/* Busca por Nome/Código */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>
            Nome, Usuário ou Código
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex: bryza01 ou Caio"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-on-surface)',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Busca por CPF Exato (Não salva na URL) */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>
            CPF Exato (Pesquisa Segura)
          </label>
          <input
            type="text"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="Apenas números (11 dígitos)"
            maxLength={14}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-on-surface)',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Filtro Cidade */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>
            Cidade
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ex: São Paulo"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-on-surface)',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Filtro Status */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-on-surface)',
              fontSize: '14px'
            }}
          >
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="bloqueado">Bloqueado</option>
          </select>
        </div>

        {/* Filtro Plano */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>
            Plano
          </label>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-on-surface)',
              fontSize: '14px'
            }}
          >
            <option value="">Todos</option>
            {plans.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        alignItems: 'end'
      }}>
        {/* Filtro Período Inicial */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>
            Data de Cadastro (Início)
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-on-surface)',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Filtro Período Final */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>
            Data de Cadastro (Fim)
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-on-surface)',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Ações dos Filtros */}
        <div style={{ display: 'flex', gap: '12px', justifySelf: 'end', gridColumn: 'span 2' }}>
          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid var(--color-outline)',
              background: 'transparent',
              color: 'var(--color-outline)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>restart_alt</span>
            Limpar
          </button>
          
          <button
            type="submit"
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
            Buscar
          </button>
        </div>
      </div>
    </form>
  );
}
