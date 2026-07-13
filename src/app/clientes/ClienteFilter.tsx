'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Profile } from '@/models/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';

interface ClienteFilterProps {
  vendedores: Profile[];
}

export default function ClienteFilter({ vendedores }: ClienteFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  // Estados locais para inputs de texto (debounce)
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');
  const [cidadeValue, setCidadeValue] = useState(searchParams.get('cidade') || '');
  const [isPending, setIsPending] = useState(false);

  // Estados de foco para evitar sobrescrever o valor do input enquanto o usuário digita
  const [searchFocused, setSearchFocused] = useState(false);
  const [cidadeFocused, setCidadeFocused] = useState(false);

  // Filtros colapsáveis no mobile — começa fechado
  const [isOpen, setIsOpen] = useState(!isMobile);

  // Quando mudar de mobile para desktop, garantir que filtros ficam visíveis
  useEffect(() => {
    if (!isMobile) setIsOpen(true);
  }, [isMobile]);

  // Sincronizar estados locais quando a URL mudar (apenas se o input respectivo não estiver focado)
  useEffect(() => {
    if (!searchFocused) {
      setSearchValue(searchParams.get('search') || '');
    }
  }, [searchParams, searchFocused]);

  useEffect(() => {
    if (!cidadeFocused) {
      setCidadeValue(searchParams.get('cidade') || '');
    }
  }, [searchParams, cidadeFocused]);

  // Função centralizada para atualizar a URL
  const updateURL = useCallback((updates: Record<string, string>) => {
    setIsPending(true);
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([name, value]) => {
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
    });

    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
    setTimeout(() => setIsPending(false), 300);
  }, [pathname, router, searchParams]);

  // Debounce para inputs de texto
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentSearch = searchParams.get('search') || '';
      const currentCidade = searchParams.get('cidade') || '';
      
      const updates: Record<string, string> = {};
      
      if (searchValue !== currentSearch) updates.search = searchValue;
      if (cidadeValue !== currentCidade) updates.cidade = cidadeValue;
      
      if (Object.keys(updates).length > 0) {
        updateURL(updates);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchValue, cidadeValue, searchParams, updateURL]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateURL({ [e.target.name]: e.target.value });
  };

  // Contar filtros ativos para exibir badge no mobile
  const activeFiltersCount = [
    searchParams.get('search'),
    searchParams.get('cidade'),
    searchParams.get('vendedor'),
    searchParams.get('status'),
  ].filter(Boolean).length;

  return (
    <div style={{ 
      backgroundColor: 'var(--color-surface-container-lowest)', 
      borderRadius: '16px', 
      border: '1px solid var(--color-outline-variant)',
      marginBottom: '12px',
      position: 'relative',
      opacity: isPending ? 0.7 : 1,
      transition: 'opacity 0.2s',
      overflow: 'hidden',
    }}>
      {/* Cabeçalho do filtro — clicável apenas no mobile */}
      <div
        onClick={() => isMobile && setIsOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          cursor: isMobile ? 'pointer' : 'default',
          borderBottom: isOpen ? '1px solid var(--color-outline-variant)' : 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-on-surface-variant)' }}>
            filter_list
          </span>
          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
            Filtros
          </span>
          {activeFiltersCount > 0 && (
            <span style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              fontSize: '11px',
              fontWeight: 800,
              borderRadius: '10px',
              padding: '1px 7px',
            }}>
              {activeFiltersCount}
            </span>
          )}
        </div>

        {isMobile && (
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: '20px',
              color: 'var(--color-on-surface-variant)',
              transition: 'transform 0.2s ease',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            expand_more
          </span>
        )}

        {isPending && (
          <div style={{ 
            fontSize: '11px', 
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 600
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>sync</span>
            Atualizando...
          </div>
        )}
      </div>

      {/* Painel de filtros — colapsável no mobile */}
      {isOpen && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-on-surface-variant)' }}>Buscar por Nome ou ID</label>
              <input 
                type="text" 
                name="search" 
                value={searchValue}
                placeholder="Ex: João ou C00001" 
                onChange={(e) => setSearchValue(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', fontSize: '13px' }} 
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-on-surface-variant)' }}>Vendedor</label>
              <select 
                name="vendedor" 
                value={searchParams.get('vendedor') || ''}
                onChange={handleSelectChange}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', fontSize: '13px' }}
              >
                <option value="">Todos os Vendedores</option>
                {vendedores.map(v => (
                  <option key={v.id} value={v.id}>
                    V{String(v.codigo_vendedor || 0).padStart(5, '0')} - {v.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-on-surface-variant)' }}>Status</label>
              <select 
                name="status" 
                value={searchParams.get('status') || ''}
                onChange={handleSelectChange}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', fontSize: '13px' }}
              >
                <option value="">Todos os Status</option>
                <option value="lead">Lead</option>
                <option value="cliente">Cliente</option>
                <option value="recorrente">Recorrente</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-on-surface-variant)' }}>Cidade</label>
              <input 
                type="text" 
                name="cidade" 
                value={cidadeValue}
                placeholder="Filtrar por cidade" 
                onChange={(e) => setCidadeValue(e.target.value)}
                onFocus={() => setCidadeFocused(true)}
                onBlur={() => setCidadeFocused(false)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', fontSize: '13px' }} 
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Link href="/clientes" style={{ 
                flex: 1,
                padding: '8px 12px', 
                backgroundColor: 'var(--color-surface-container-high)', 
                color: 'var(--color-on-surface)', 
                textDecoration: 'none',
                borderRadius: '8px', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '36px',
                fontSize: '13px',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                Limpar Filtros
              </Link>
            </div>
          </div>
          <p style={{ marginTop: '8px', fontSize: '10px', color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>
            * Filtro inteligente: resultados atualizados automaticamente enquanto você digita ou seleciona.
          </p>
        </div>
      )}
    </div>
  );
}
