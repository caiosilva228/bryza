'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export default function VendedorFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Estados locais para inputs de texto (debounce)
  const [nomeValue, setNomeValue] = useState(searchParams.get('nome') || '');
  const [isPending, setIsPending] = useState(false);

  // Sincronizar estados locais quando a URL mudar
  useEffect(() => {
    setNomeValue(searchParams.get('nome') || '');
  }, [searchParams]);

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

    router.push(`${pathname}?${params.toString()}`);
    
    setTimeout(() => setIsPending(false), 300);
  }, [pathname, router, searchParams]);

  // Debounce para input de nome
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentNome = searchParams.get('nome') || '';
      if (nomeValue !== currentNome) {
        updateURL({ nome: nomeValue });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [nomeValue, searchParams, updateURL]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateURL({ [e.target.name]: e.target.value });
  };

  return (
    <div style={{ 
      backgroundColor: 'var(--color-surface)', 
      padding: '24px', 
      borderRadius: '16px', 
      border: '1px solid var(--color-outline-variant)',
      marginBottom: '24px',
      position: 'relative',
      opacity: isPending ? 0.7 : 1,
      transition: 'opacity 0.2s'
    }}>
      {isPending && (
        <div style={{ 
          position: 'absolute', 
          top: '12px', 
          right: '24px', 
          fontSize: '11px', 
          color: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 600
        }}>
          <span className="material-symbols-outlined animation-spin" style={{ fontSize: '14px' }}>sync</span>
          Atualizando...
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: '240px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '12px', 
            fontWeight: 700, 
            marginBottom: '8px', 
            color: 'var(--color-on-surface-variant)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Buscar por Nome</label>
          <div style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ 
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '18px', color: 'var(--color-outline)'
            }}>search</span>
            <input 
              type="text" 
              name="nome" 
              value={nomeValue}
              placeholder="Digite o nome do vendedor..." 
              onChange={(e) => setNomeValue(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '12px 12px 12px 40px', 
                borderRadius: '8px', 
                border: '1px solid var(--color-outline-variant)', 
                backgroundColor: 'var(--color-surface-container-low)',
                color: 'var(--color-on-surface)',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }} 
              onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-outline-variant)'}
            />
          </div>
        </div>
        
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '12px', 
            fontWeight: 700, 
            marginBottom: '8px', 
            color: 'var(--color-on-surface-variant)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Status</label>
          <select 
            name="status" 
            value={searchParams.get('status') || ''}
            onChange={handleSelectChange}
            style={{ 
              width: '100%', 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid var(--color-outline-variant)', 
              backgroundColor: 'var(--color-surface-container-low)',
              color: 'var(--color-on-surface)',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">Todos os Status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '12px', 
            fontWeight: 700, 
            marginBottom: '8px', 
            color: 'var(--color-on-surface-variant)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Nível</label>
          <select 
            name="nivel" 
            value={searchParams.get('nivel') || ''}
            onChange={handleSelectChange}
            style={{ 
              width: '100%', 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid var(--color-outline-variant)', 
              backgroundColor: 'var(--color-surface-container-low)',
              color: 'var(--color-on-surface)',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">Todos os Níveis</option>
            <option value="Bronze">Bronze</option>
            <option value="Prata">Prata</option>
            <option value="Ouro">Ouro</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/vendedores" style={{ 
            padding: '12px 20px', 
            backgroundColor: 'var(--color-surface-container-high)', 
            color: 'var(--color-on-surface)', 
            textDecoration: 'none',
            borderRadius: '8px', 
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>restart_alt</span>
            Reset
          </Link>
        </div>
      </div>
    </div>
  );
}
