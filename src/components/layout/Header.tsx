'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import styles from './layout.module.css';
import { Agendamento } from '@/models/types';
import { formatCurrency } from '@/utils/format';

export const Header = () => {
  const [notifications, setNotifications] = useState<Agendamento[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Obter data de hoje no formato local YYYY-MM-DD
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const response = await fetch(`/api/agendamentos/notificacoes?date=${dateStr}`);
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.agendamentos || []);
        }
      } catch (error) {
        console.error('Erro ao buscar notificações:', error);
      }
    };

    fetchNotifications();
    // Atualizar a cada 5 minutos
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fechar o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTimeString = (isoString: string) => {
    if (!isoString) return '';
    const parts = isoString.split('T');
    if (parts.length < 2) return '';
    return parts[1].substring(0, 5);
  };

  return (
    <header className={styles.header}>
      <div style={{ flex: 1 }}>
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: 'var(--color-surface-container-high)',
          padding: '8px 16px', borderRadius: '24px', width: '320px'
        }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)' }}>search</span>
          <input 
            type="text" 
            placeholder="Buscar clientes, pedidos ou rotas..." 
            style={{ 
              border: 'none', background: 'transparent', width: '100%', 
              outline: 'none', color: 'var(--color-on-surface)',
              fontFamily: 'var(--font-body)', fontSize: '14px'
            }} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }} ref={dropdownRef}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          style={{ 
            background: 'none', border: 'none', cursor: 'pointer',
            width: 40, height: 40, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-on-surface-variant)',
            position: 'relative',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span className="material-symbols-outlined">notifications</span>
          {notifications.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              backgroundColor: 'var(--color-error)',
              color: 'white',
              fontSize: '10px',
              fontWeight: 800,
              borderRadius: '50%',
              minWidth: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid var(--color-surface)'
            }}>
              {notifications.length}
            </span>
          )}
        </button>

        {isOpen && (
          <div style={{
            position: 'absolute',
            top: '48px',
            right: 0,
            width: '360px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            border: '1px solid var(--color-outline-variant)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'slideDown 0.2s ease-out'
          }}>
            {/* Dropdown Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface-container-low)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--color-on-surface)' }}>
                Notificações de Agendamentos
              </span>
              <span style={{
                backgroundColor: 'var(--color-primary-container)',
                color: 'white',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                Hoje
              </span>
            </div>

            {/* Dropdown Content */}
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  color: 'var(--color-on-surface-variant)',
                  fontSize: '13px'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '8px', display: 'block', opacity: 0.5 }}>
                    calendar_today
                  </span>
                  Nenhum agendamento para hoje.
                </div>
              ) : (
                notifications.map((n) => (
                  <Link 
                    key={n.id}
                    href="/vendas/agendamentos"
                    onClick={() => setIsOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 20px',
                      borderBottom: '1px solid var(--color-outline-variant)',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--color-primary-container)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <span className="material-symbols-outlined">event</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: 'var(--color-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {n.nome_cliente || n.cliente?.nome || 'Cliente não definido'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                        Horário: <strong style={{ color: 'var(--color-primary)' }}>{getTimeString(n.data_agendamento)}</strong>
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-on-surface)' }}>
                        {formatCurrency(n.valor_total)}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Dropdown Footer */}
            <div style={{
              padding: '12px',
              textAlign: 'center',
              borderTop: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface-container-low)'
            }}>
              <Link 
                href="/vendas/agendamentos"
                onClick={() => setIsOpen(false)}
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--color-primary)',
                  textDecoration: 'none',
                  display: 'inline-block'
                }}
              >
                Visualizar todos os agendamentos
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
