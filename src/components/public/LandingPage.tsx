'use client';

import React from 'react';
import Link from 'next/link';
import { getSubdomainUrl } from '@/utils/subdomain';

export const LandingPage: React.FC = () => {
  const evUrl = getSubdomainUrl('ev', '/login');
  const adminUrl = getSubdomainUrl('admin', '/login');
  const calculatorUrl = '/calculadora-de-ganhos';

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
      color: '#0f172a',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Header */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/Bryza/New%20Logo%20Bryza.svg"
            alt="Bryza Logo"
            style={{ height: '36px', width: 'auto' }}
          />
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a
            href={calculatorUrl}
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#0284c7',
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              transition: 'background-color 0.2s'
            }}
          >
            Calculadora de Ganhos
          </a>
          <a
            href={evUrl}
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#0369a1',
              backgroundColor: '#e0f2fe',
              textDecoration: 'none',
              padding: '10px 18px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>loyalty</span>
            Espaço Embaixador
          </a>
          <a
            href={adminUrl}
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#ffffff',
              backgroundColor: '#0284c7',
              textDecoration: 'none',
              padding: '10px 18px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>admin_panel_settings</span>
            Painel Admin
          </a>
        </nav>
      </header>

      {/* Hero Section */}
      <section style={{
        padding: '80px 24px 60px',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%)',
        borderBottom: '1px solid #e0f2fe'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <span style={{
            display: 'inline-block',
            backgroundColor: '#e0f2fe',
            color: '#0369a1',
            fontSize: '13px',
            fontWeight: 800,
            padding: '6px 16px',
            borderRadius: '20px',
            marginBottom: '20px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Sistema Operacional & Programa de Embaixadores BRYZA
          </span>

          <h1 style={{
            fontSize: '48px',
            lineHeight: 1.15,
            fontWeight: 800,
            color: '#0c4a6e',
            letterSpacing: '-0.02em',
            marginBottom: '24px'
          }}>
            A precisão e excelência que seu <br />negócio de higienização merece.
          </h1>

          <p style={{
            fontSize: '18px',
            color: '#334155',
            lineHeight: 1.6,
            maxWidth: '680px',
            margin: '0 auto 36px'
          }}>
            Acesse o portal da **Bryza** para gerenciar vendas, estoque, rotas e logística ou acompanhe seus ganhos no **Espaço do Embaixador**.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <a
              href={evUrl}
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: '#0284c7',
                padding: '16px 32px',
                borderRadius: '12px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(2, 132, 199, 0.3)'
              }}
            >
              <span className="material-symbols-outlined">loyalty</span>
              Entrar no Espaço Embaixador
            </a>
            <a
              href={adminUrl}
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#0c4a6e',
                backgroundColor: '#ffffff',
                border: '1.5px solid #cbd5e1',
                padding: '16px 32px',
                borderRadius: '12px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span className="material-symbols-outlined">dashboard</span>
              Painel de Gestão Operacional
            </a>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section style={{ padding: '60px 24px', maxWidth: '1100px', margin: '0 auto', flex: 1 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>groups</span>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
              Espaço do Embaixador (`ev.bryza.com.br`)
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, marginBottom: '20px' }}>
              Acompanhe sua rede de indicados, vendas realizadas, comissões acumuladas e solicite saques Pix em tempo real.
            </p>
            <a href={evUrl} style={{ fontSize: '14px', fontWeight: 700, color: '#0284c7', textDecoration: 'none' }}>
              Acessar portal ev.bryza.com.br &rarr;
            </a>
          </div>

          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>inventory_2</span>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
              Gestão Operacional (`admin.bryza.com.br`)
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, marginBottom: '20px' }}>
              Controle de estoque, fluxo de pedidos, expedição de rotas, monitoramento de entregadores e métricas financeiras.
            </p>
            <a href={adminUrl} style={{ fontSize: '14px', fontWeight: 700, color: '#16a34a', textDecoration: 'none' }}>
              Acessar portal admin.bryza.com.br &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        backgroundColor: '#0f172a',
        color: '#94a3b8',
        padding: '32px 24px',
        textAlign: 'center',
        fontSize: '13px'
      }}>
        <p style={{ margin: 0 }}>
          &copy; {new Date().getFullYear()} BRYZA Tecnologia S.A. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};
