'use client';

import React, { useState } from 'react';
import { getSubdomainUrl } from '@/utils/subdomain';

export const LandingPage: React.FC = () => {
  const evUrl = getSubdomainUrl('ev', '/login');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqList = [
    {
      question: 'Onde a Bryza realiza entregas?',
      answer: 'Estamos expandindo! Entregamos em todo o Entorno Sul de Brasília: Cidade Ocidental, Valparaíso, Luziânia, Novo Gama e regiões atendidas. Consulte a disponibilidade para seu endereço no momento do pedido.'
    },
    {
      question: 'O frete é grátis?',
      answer: 'Sim! O frete é 100% grátis para regiões participantes e pedidos dentro das condições promocionais.'
    },
    {
      question: 'Como funciona o pagamento na entrega?',
      answer: 'Você faz seu pedido no site e paga somente quando o entregador chegar com seus produtos, aceitando Pix, cartão ou dinheiro.'
    },
    {
      question: 'Como funciona o Programa de Embaixadores?',
      answer: 'Você se cadastra gratuitamente no Espaço do Embaixador, recebe seu link único de indicação e ganha comissões a cada compra realizada com seu link.'
    },
    {
      question: 'Quanto posso ganhar como Embaixador?',
      answer: 'Não há limite de ganhos! Você recebe até 7% de comissão sobre o valor de cada pedido realizado pela sua rede de clientes indicados.'
    },
    {
      question: 'Preciso comprar produtos ou manter estoque?',
      answer: 'Não! Não é necessário comprar kits ou ter estoque. A Bryza cuida de todo o armazenamento, separação, entrega e cobrança.'
    },
    {
      question: 'Onde acompanho minhas comissões?',
      answer: 'No seu painel do Espaço do Embaixador (ev.bryza.com.br), você acompanha em tempo real seus indicados, vendas e saldo disponível para saque Pix.'
    },
    {
      question: 'Posso vender pelo WhatsApp ou redes sociais?',
      answer: 'Sim! Você pode compartilhar seu link de indicação no WhatsApp, Instagram, Facebook, TikTok e grupos da sua região.'
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      fontFamily: "'Poppins', system-ui, sans-serif",
      color: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden'
    }}>
      {/* Google Fonts Poppins */}
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      {/* Material Symbols */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        rel="stylesheet"
      />

      {/* Header / Top Navbar */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #f1f5f9',
        padding: '16px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
      }} className="navbar-container">
        {/* Logo Bryza (Left) */}
        <a href="#hero" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <img
            src="/Logo%20Bryza.svg"
            alt="Bryza Logo"
            style={{ height: '48px', width: 'auto' }}
          />
        </a>

        {/* Menu Navigation Links (Desktop) */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '32px' }} className="nav-links">
          <a href="#hero" style={{ textDecoration: 'none', color: '#0f172a', fontWeight: 600, fontSize: '14.5px', transition: 'color 0.2s' }}>
            Início
          </a>
          <a href="#beneficios" style={{ textDecoration: 'none', color: '#0f172a', fontWeight: 600, fontSize: '14.5px', transition: 'color 0.2s' }}>
            Benefícios
          </a>
          <a href="#embaixador" style={{ textDecoration: 'none', color: '#0f172a', fontWeight: 600, fontSize: '14.5px', transition: 'color 0.2s' }}>
            Seja Embaixador
          </a>
          <a href="#faq" style={{ textDecoration: 'none', color: '#0f172a', fontWeight: 600, fontSize: '14.5px', transition: 'color 0.2s' }}>
            FAQ
          </a>
          <a href="#quem-somos" style={{ textDecoration: 'none', color: '#0f172a', fontWeight: 600, fontSize: '14.5px', transition: 'color 0.2s' }}>
            Quem Somos
          </a>
        </nav>

        {/* Action Buttons (Desktop) & Right Mobile Hamburger Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#002b5c',
              borderRadius: '8px'
            }}
            className="mobile-hamburger-btn"
            aria-label="Abrir Menu"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="nav-actions">
            <a
              href={evUrl}
              style={{
                textDecoration: 'none',
                color: '#002b5c',
                border: '1.5px solid #002b5c',
                borderRadius: '8px',
                padding: '8px 14px',
                fontWeight: 600,
                fontSize: '13px',
                transition: 'all 0.2s ease',
                backgroundColor: 'transparent'
              }}
              className="btn-embaixador-nav"
            >
              Espaço do Embaixador
            </a>
            <a
              href="#hero"
              style={{
                textDecoration: 'none',
                color: '#ffffff',
                backgroundColor: '#A6CE39',
                borderRadius: '8px',
                padding: '8px 16px',
                fontWeight: 700,
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(166, 206, 57, 0.35)',
                transition: 'transform 0.2s, background-color 0.2s'
              }}
              className="btn-loja-nav"
            >
              <span>Conheça a Loja</span>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>shopping_cart</span>
            </a>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu (Overlay) */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: '60px',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 30, 65, 0.96)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 99,
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            overflowY: 'auto'
          }}
          className="mobile-drawer-overlay"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '24px' }}>
            <a
              href="#hero"
              onClick={() => setMobileMenuOpen(false)}
              style={{ color: '#ffffff', textDecoration: 'none', fontSize: '17px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span className="material-symbols-outlined" style={{ color: '#A6CE39', fontSize: '20px' }}>home</span>
              Início
            </a>
            <a
              href="#beneficios"
              onClick={() => setMobileMenuOpen(false)}
              style={{ color: '#ffffff', textDecoration: 'none', fontSize: '17px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span className="material-symbols-outlined" style={{ color: '#A6CE39', fontSize: '20px' }}>verified</span>
              Benefícios
            </a>
            <a
              href="#embaixador"
              onClick={() => setMobileMenuOpen(false)}
              style={{ color: '#ffffff', textDecoration: 'none', fontSize: '17px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span className="material-symbols-outlined" style={{ color: '#A6CE39', fontSize: '20px' }}>groups</span>
              Seja Embaixador
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              style={{ color: '#ffffff', textDecoration: 'none', fontSize: '17px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span className="material-symbols-outlined" style={{ color: '#A6CE39', fontSize: '20px' }}>help</span>
              FAQ
            </a>
            <a
              href="#quem-somos"
              onClick={() => setMobileMenuOpen(false)}
              style={{ color: '#ffffff', textDecoration: 'none', fontSize: '17px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span className="material-symbols-outlined" style={{ color: '#A6CE39', fontSize: '20px' }}>info</span>
              Quem Somos
            </a>
          </div>

          {/* Action Buttons in Mobile Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '8px' }}>
            <a
              href={evUrl}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                textDecoration: 'none',
                color: '#ffffff',
                border: '1.5px solid rgba(255,255,255,0.4)',
                borderRadius: '12px',
                padding: '12px 20px',
                fontWeight: 600,
                fontSize: '15px',
                textAlign: 'center',
                backgroundColor: 'rgba(255,255,255,0.08)'
              }}
            >
              Espaço do Embaixador
            </a>
            <a
              href="#hero"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                textDecoration: 'none',
                color: '#ffffff',
                backgroundColor: '#A6CE39',
                borderRadius: '12px',
                padding: '13px 20px',
                fontWeight: 700,
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(166, 206, 57, 0.4)'
              }}
            >
              <span>Conheça a Loja</span>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>shopping_cart</span>
            </a>
          </div>
        </div>
      )}

      {/* Animated Red Alert Banner */}
      <div style={{
        backgroundColor: '#dc2626',
        color: '#ffffff',
        padding: '9px 0',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 90,
        boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
        borderBottom: '1px solid #b91c1c'
      }} className="marquee-banner">
        <div style={{
          display: 'flex',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          width: '100%'
        }}>
          <div className="marquee-track" style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '13.5px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            gap: '40px'
          }}>
            <span>⚠️ Atenção, por enquanto nossa área de atuação é apenas entorno sul de Brasília: Cidade Ocidental, Valparaíso de Goiás, Novo Gama e Luziânia.</span>
            <span>⚠️ Atenção, por enquanto nossa área de atuação é apenas entorno sul de Brasília: Cidade Ocidental, Valparaíso de Goiás, Novo Gama e Luziânia.</span>
            <span>⚠️ Atenção, por enquanto nossa área de atuação é apenas entorno sul de Brasília: Cidade Ocidental, Valparaíso de Goiás, Novo Gama e Luziânia.</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section id="hero" style={{
        backgroundColor: '#0a111c',
        backgroundImage: "linear-gradient(90deg, rgba(5, 15, 32, 0.82) 0%, rgba(5, 15, 32, 0.55) 48%, rgba(5, 15, 32, 0.12) 100%), url('/hero-site-bryza.webp')",
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        padding: '80px 40px 90px',
        position: 'relative',
        borderBottom: '1px solid #f1f5f9'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: '40px',
          alignItems: 'center'
        }} className="hero-grid">
          {/* Left Text (No Card, White Text) */}
          <div>
            <h1 style={{
              fontSize: '46px',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.16,
              letterSpacing: '-0.02em',
              marginBottom: '20px',
              textShadow: '0 3px 12px rgba(0, 0, 0, 0.6)'
            }}>
              O perfume que anuncia a presença. A qualidade que faz você permanecer.
            </h1>

            <p style={{
              fontSize: '17px',
              color: 'rgba(255, 255, 255, 0.92)',
              lineHeight: 1.6,
              marginBottom: '32px',
              maxWidth: '520px',
              fontWeight: 400,
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)'
            }}>
              Limpeza eficiente, alto rendimento e perfume marcante para tornar o cuidado com a casa mais leve.
            </p>

            {/* CTA Button */}
            <div style={{ marginBottom: '36px' }}>
              <a
                href={evUrl}
                style={{
                  textDecoration: 'none',
                  color: '#ffffff',
                  backgroundColor: '#A6CE39',
                  padding: '15px 36px',
                  borderRadius: '28px',
                  fontWeight: 700,
                  fontSize: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 8px 28px rgba(166, 206, 57, 0.45)',
                  transition: 'transform 0.2s'
                }}
              >
                <span>Conhecer a Loja</span>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
              </a>
            </div>

            {/* Trust Badges */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              flexWrap: 'wrap',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                <span className="material-symbols-outlined" style={{ color: '#A6CE39', fontSize: '20px' }}>verified_user</span>
                <span>Pague somente na entrega</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                <span className="material-symbols-outlined" style={{ color: '#A6CE39', fontSize: '20px' }}>local_shipping</span>
                <span>Frete grátis*</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                <span className="material-symbols-outlined" style={{ color: '#A6CE39', fontSize: '20px' }}>groups</span>
                <span>Ganhe indicando nossos produtos</span>
              </div>
            </div>

            <p style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.7)', margin: 0, fontWeight: 400, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              *Consulte regiões e condições no momento do pedido.
            </p>
          </div>

          {/* Right Spacer for Background Image */}
          <div style={{ minHeight: '360px' }} className="hero-spacer" />
        </div>
      </section>

      {/* Seção 3 Benefícios / Features Strip */}
      <section id="beneficios" style={{ padding: '60px 40px', backgroundColor: '#ffffff' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          
          {/* Header da Seção de Benefícios */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span style={{
              display: 'inline-block',
              padding: '6px 16px',
              borderRadius: '20px',
              backgroundColor: 'rgba(166, 206, 57, 0.15)',
              color: '#4d7c0f',
              fontSize: '12.5px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '10px'
            }}>
              Por que escolher a Bryza?
            </span>
            <h2 style={{
              fontSize: '34px',
              fontWeight: 800,
              color: '#002b5c',
              letterSpacing: '-0.02em',
              margin: 0
            }}>
              Benefícios
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '32px'
          }} className="benefits-grid">
          {/* Card 1 */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            padding: '24px',
            borderRadius: '16px',
            backgroundColor: '#f8fafc',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(166, 206, 57, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#65a30d',
              flexShrink: 0
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>local_shipping</span>
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                Frete grátis
              </h3>
              <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                Receba seus produtos Bryza em casa sem pagar pela entrega nas regiões participantes.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            padding: '24px',
            borderRadius: '16px',
            backgroundColor: '#f8fafc',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(166, 206, 57, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#65a30d',
              flexShrink: 0
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>account_balance_wallet</span>
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                Pague somente na entrega
              </h3>
              <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                Faça seu pedido com segurança e pague quando receber seus produtos.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            padding: '24px',
            borderRadius: '16px',
            backgroundColor: '#f8fafc',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(166, 206, 57, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#65a30d',
              flexShrink: 0
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>groups</span>
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                Ganhe indicando a Bryza
              </h3>
              <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                Indique nossos produtos para outras pessoas e transforme suas recomendações em renda.
              </p>
            </div>
          </div>
        </div>
      </div>
      </section>

      {/* Banner Embaixadores (Azul Marinho #002b5c) */}
      <section id="embaixador" style={{
        backgroundColor: '#002b5c',
        backgroundImage: "linear-gradient(90deg, rgba(0, 43, 92, 0.85) 0%, rgba(0, 43, 92, 0.6) 50%, rgba(0, 43, 92, 0.3) 100%), url('/bg-embaixadores-site.webp')",
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        color: '#ffffff',
        padding: '60px 40px',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: '40px',
          alignItems: 'center'
        }} className="embaixador-grid">
          {/* Left Text */}
          <div>
            <span style={{
              display: 'inline-block',
              padding: '6px 16px',
              borderRadius: '20px',
              backgroundColor: 'rgba(166, 206, 57, 0.2)',
              color: '#A6CE39',
              fontSize: '12.5px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              marginBottom: '14px',
              border: '1px solid rgba(166, 206, 57, 0.35)'
            }}>
              Construa uma renda recorrente indicando nossos produtos
            </span>

            <h2 style={{
              fontSize: '32px',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.2,
              marginBottom: '12px'
            }}>
              Seja um Embaixador Bryza e conquiste sua renda extra.
            </h2>

            <p style={{
              fontSize: '15px',
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: 1.55,
              marginBottom: '28px'
            }}>
              Ganhe até <strong style={{ color: '#A6CE39' }}>7% de comissão</strong> sempre que a pessoa que você indicar comprar nossos produtos.
            </p>

            {/* 4 Feature Badges Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px'
            }}>
              <div style={{
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor: 'rgba(255, 255, 255, 0.05)'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#A6CE39' }}>link</span>
                <span>Link exclusivo de indicação</span>
              </div>

              <div style={{
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor: 'rgba(255, 255, 255, 0.05)'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#A6CE39' }}>analytics</span>
                <span>Painel para acompanhar resultados</span>
              </div>

              <div style={{
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor: 'rgba(255, 255, 255, 0.05)'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#A6CE39' }}>payments</span>
                <span>Comissão sobre compras indicadas</span>
              </div>

              <div style={{
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor: 'rgba(255, 255, 255, 0.05)'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#A6CE39' }}>inventory_2</span>
                <span>Sem necessidade de estoque</span>
              </div>
            </div>
          </div>

          {/* Right White Card */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '28px 24px',
            color: '#0f172a',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.25)',
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: '19px', fontWeight: 700, color: '#002b5c', marginBottom: '20px', lineHeight: 1.3 }}>
              Comece hoje e transforme indicações em conquistas!
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a
                href={evUrl}
                style={{
                  textDecoration: 'none',
                  backgroundColor: '#A6CE39',
                  color: '#ffffff',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(166, 206, 57, 0.35)'
                }}
              >
                <span>Saiba mais sobre o programa</span>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
              </a>

              <a
                href={evUrl}
                style={{
                  textDecoration: 'none',
                  backgroundColor: '#ffffff',
                  color: '#002b5c',
                  border: '1.5px solid #002b5c',
                  padding: '11px 20px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person</span>
                <span>Acessar Espaço do Embaixador</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Seção Quem Somos (Posicionada acima do FAQ) */}
      <section id="quem-somos" style={{
        padding: '80px 40px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #f1f5f9',
        position: 'relative'
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          
          {/* Header da Seção */}
          <div style={{ textAlign: 'center', marginBottom: '44px' }}>
            <span style={{
              display: 'inline-block',
              padding: '6px 16px',
              borderRadius: '20px',
              backgroundColor: 'rgba(166, 206, 57, 0.15)',
              color: '#4d7c0f',
              fontSize: '12.5px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '12px'
            }}>
              Nossa História & Propósito
            </span>
            <h2 style={{
              fontSize: '36px',
              fontWeight: 800,
              color: '#002b5c',
              letterSpacing: '-0.02em',
              margin: '0 0 14px'
            }}>
              Quem Somos
            </h2>
            <p style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#002b5c',
              maxWidth: '720px',
              margin: '0 auto',
              lineHeight: 1.5
            }}>
              Cuidamos da sua casa com a mesma dedicação que cuidaríamos da nossa.
            </p>
          </div>

          {/* Grid Principal: História + Imagem da Futura Fábrica */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 0.9fr',
            gap: '48px',
            alignItems: 'center',
            marginBottom: '48px'
          }} className="quem-somos-grid">
            
            {/* Micro-seções do Texto da História */}
            <div style={{ fontSize: '15px', color: '#334155', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0 }}>
                A <strong>Bryza</strong> é uma empresa brasileira de saneantes, localizada em <strong>Cidade Ocidental – GO</strong>, fundada em <strong>abril de 2026</strong> com um propósito simples: oferecer produtos de limpeza de alta qualidade por um preço justo, aproximando a fábrica das famílias.
              </p>
              <p style={{ margin: 0 }}>
                Acreditamos que uma casa limpa vai além da higiene. Ela transmite bem-estar, conforto e a sensação de estar em um ambiente acolhedor. Por isso, desenvolvemos produtos de alto rendimento, perfume marcante e excelente custo-benefício, vendidos diretamente ao consumidor.
              </p>
              <p style={{ margin: 0, padding: '14px 18px', backgroundColor: 'rgba(166, 206, 57, 0.12)', borderLeft: '4px solid #A6CE39', borderRadius: '0 12px 12px 0' }}>
                Mais do que fabricar produtos de limpeza, queremos construir uma marca baseada na confiança e na recomendação de clientes satisfeitos. Foi dessa visão que nasceu o <strong>Programa de Embaixadores Bryza</strong>, permitindo que nossos clientes indiquem nossos produtos e sejam recompensados por cada compra realizada através de suas indicações.
              </p>
            </div>

            {/* Imagem da Futura Fábrica */}
            <div>
              <div style={{
                position: 'relative',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: '0 16px 40px rgba(0, 43, 92, 0.15)',
                border: '4px solid #ffffff'
              }}>
                <img
                  src="/faixada-bryza.webp"
                  alt="Futura fábrica Bryza"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    objectFit: 'cover'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(0, 43, 92, 0.95) 0%, rgba(0, 43, 92, 0.6) 70%, transparent 100%)',
                  padding: '24px 28px 20px',
                  color: '#ffffff'
                }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: '#A6CE39',
                    display: 'block',
                    marginBottom: '4px'
                  }}>
                    Expansão & Infraestrutura
                  </span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    Futura fábrica Bryza
                  </h3>
                </div>
              </div>
            </div>

          </div>

          {/* Micro-seção 2: Nossa Inspiração (Card Gênesis 3:8) */}
          <div style={{
            background: 'linear-gradient(135deg, #002b5c 0%, #001938 100%)',
            color: '#ffffff',
            borderRadius: '24px',
            padding: '36px 40px',
            marginBottom: '48px',
            boxShadow: '0 16px 40px rgba(0, 43, 92, 0.16)',
            position: 'relative',
            overflow: 'hidden'
          }} className="quem-somos-card">
            <div style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '220px',
              height: '220px',
              background: 'radial-gradient(circle, rgba(166, 206, 57, 0.22) 0%, transparent 70%)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />
            
            <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#A6CE39' }}>auto_awesome</span>
              <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A6CE39' }}>
                Nossa inspiração
              </span>
            </div>

            <p style={{
              fontSize: '16.5px',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.95)',
              margin: '0 0 14px',
              fontStyle: 'italic',
              fontWeight: 400
            }}>
              "O nome Bryza nasce da inspiração em Gênesis 3:8, onde a brisa da viração do dia precede a presença de Deus no jardim. Para nós, ela simboliza um perfume que chega antes, anuncia uma presença e transforma o ambiente. É essa sensação que buscamos levar para cada casa através dos nossos produtos."
            </p>
            <div style={{
              fontSize: '14.5px',
              fontWeight: 800,
              color: '#A6CE39',
              display: 'inline-block',
              padding: '4px 14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }}>
              Gn 3:8
            </div>
          </div>

          {/* Micro-seção 3: Nossos Pilares */}
          <div style={{ marginBottom: '48px' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h3 style={{
                fontSize: '26px',
                fontWeight: 800,
                color: '#002b5c',
                margin: 0
              }}>
                Nossos pilares
              </h3>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '24px'
            }} className="benefits-grid">
              
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '20px',
                padding: '28px 24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: '#002b5c',
                  color: '#A6CE39',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>verified</span>
                </div>
                <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#002b5c', marginBottom: '8px' }}>
                  Qualidade
                </h4>
                <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                  Produtos desenvolvidos para entregar limpeza eficiente, alto rendimento e excelente desempenho.
                </p>
              </div>

              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '20px',
                padding: '28px 24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: '#002b5c',
                  color: '#A6CE39',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>sell</span>
                </div>
                <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#002b5c', marginBottom: '8px' }}>
                  Preço justo
                </h4>
                <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                  Qualidade acessível para que mais famílias possam cuidar da casa com economia.
                </p>
              </div>

              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '20px',
                padding: '28px 24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: '#002b5c',
                  color: '#A6CE39',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>diversity_3</span>
                </div>
                <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#002b5c', marginBottom: '8px' }}>
                  Pessoas em primeiro lugar
                </h4>
                <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                  Valorizamos cada cliente, cada indicação e cada relacionamento construído ao longo da nossa história.
                </p>
              </div>

            </div>
          </div>

          {/* Micro-seção 4: Nossa Missão & Assinatura */}
          <div style={{
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '24px',
            padding: '36px 28px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#002b5c',
              marginBottom: '12px'
            }}>
              Nossa missão
            </h3>
            <p style={{ fontSize: '15.5px', color: '#334155', lineHeight: 1.7, maxWidth: '820px', margin: '0 auto 20px' }}>
              Mais do que fabricar produtos de limpeza, queremos construir uma marca presente nos lares brasileiros por meio da qualidade, da confiança e do cuidado com as pessoas.
            </p>
            <div style={{
              display: 'inline-block',
              fontSize: '16px',
              fontWeight: 800,
              color: '#002b5c',
              padding: '10px 24px',
              borderRadius: '30px',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 16px rgba(0, 43, 92, 0.08)',
              border: '1.5px solid #A6CE39'
            }}>
              Bryza. O perfume que anuncia a presença.
            </div>
          </div>

        </div>
      </section>

      {/* FAQ Section (Posicionada após Quem Somos) */}
      <section id="faq" style={{ padding: '70px 40px', backgroundColor: '#ffffff', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '32px',
            fontWeight: 800,
            color: '#002b5c',
            textAlign: 'center',
            marginBottom: '44px'
          }}>
            Perguntas frequentes
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px 28px',
            alignItems: 'start'
          }} className="faq-grid">
            {faqList.map((item, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  backgroundColor: openFaq === idx ? '#f8fafc' : '#ffffff',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14.5px',
                    fontWeight: 600,
                    color: '#0f172a'
                  }}
                >
                  <span>{item.question}</span>
                  <span className="material-symbols-outlined" style={{
                    fontSize: '20px',
                    color: '#002b5c',
                    transform: openFaq === idx ? 'rotate(45deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}>
                    add
                  </span>
                </button>

                {openFaq === idx && (
                  <div style={{
                    padding: '0 20px 16px 20px',
                    fontSize: '13.5px',
                    color: '#475569',
                    lineHeight: 1.6,
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '12px'
                  }}>
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer style={{
        backgroundColor: '#001e40',
        color: '#ffffff',
        padding: '50px 40px 24px'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr 1.2fr',
          gap: '40px',
          paddingBottom: '40px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.15)'
        }} className="footer-grid">
          {/* Coluna 1: Logo & Redes */}
          <div>
            <img
              src="/Logo%20Bryza.svg"
              alt="Bryza Logo"
              style={{
                height: '42px',
                width: 'auto',
                filter: 'brightness(0) invert(1)',
                marginBottom: '16px'
              }}
            />
            <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)', margin: '0 0 20px' }}>
              O perfume que anuncia a Presença.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <a
                href="https://www.instagram.com/bryza.of"
                target="_blank"
                rel="noreferrer"
                title="Instagram @bryza.of"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  textDecoration: 'none',
                  transition: 'background-color 0.2s, transform 0.2s'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
              <a
                href="https://wa.me/556132462117?text=Ol%C3%A1%2C%20vim%20do%20site!"
                target="_blank"
                rel="noreferrer"
                title="WhatsApp (61) 3246-2117"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#25D366',
                  textDecoration: 'none',
                  transition: 'background-color 0.2s, transform 0.2s'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.758.459 3.474 1.33 4.982l-1.413 5.161 5.284-1.385a9.948 9.948 0 0 0 4.787 1.226h.004c5.505 0 9.988-4.478 9.989-9.984 0-2.669-1.038-5.176-2.925-7.062a9.925 9.925 0 0 0-7.066-2.922zm0 1.666c4.587 0 8.322 3.734 8.323 8.318 0 2.227-.866 4.319-2.441 5.892a8.27 8.27 0 0 1-5.882 2.436h-.003a8.29 8.29 0 0 1-4.225-1.155l-.303-.18-3.136.822.836-3.056-.197-.314a8.292 8.292 0 0 1-1.296-4.444c.001-4.584 3.737-8.319 8.327-8.319zm-3.6 3.6c-.206 0-.539.077-.822.385s-1.077 1.052-1.077 2.565 1.103 2.975 1.257 3.181c.154.205 2.132 3.324 5.235 4.607 2.585 1.069 3.111.856 3.676.804.564-.051 1.821-.744 2.077-1.462.257-.718.257-1.334.18-1.462-.077-.128-.282-.205-.59-.359s-1.821-.898-2.103-1.001c-.282-.103-.487-.154-.693.154s-.8 1.001-.979 1.206c-.18.205-.359.231-.667.077-.308-.154-1.301-.48-2.478-1.53-1.177-1.05-1.972-2.348-2.203-2.743-.231-.395-.025-.609.129-.762.138-.138.308-.359.462-.539.154-.18.205-.308.308-.513.103-.205.051-.385-.026-.539-.077-.154-.693-1.667-.949-2.283-.249-.601-.502-.519-.693-.529z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Coluna 2: Navegação */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#A6CE39' }}>Navegação</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <a href="#hero" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>Início</a>
              <a href="#beneficios" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>Benefícios</a>
              <a href="#embaixador" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>Seja Embaixador</a>
              <a href="#faq" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>FAQ</a>
              <a href="#quem-somos" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>Quem Somos</a>
            </div>
          </div>

          {/* Coluna 3: Links Rápidos */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#A6CE39' }}>Links rápidos</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <a href={evUrl} style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>Espaço do Embaixador</a>
              <a href="#hero" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>Loja Virtual</a>
            </div>
          </div>

          {/* Coluna 4: Atendimento */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#A6CE39' }}>Atendimento</h4>
            <a
              href="https://wa.me/556132462117?text=Ol%C3%A1%2C%20vim%20do%20site!"
              target="_blank"
              rel="noreferrer"
              style={{
                textDecoration: 'none',
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '10px',
                padding: '10px 16px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'background-color 0.2s, border-color 0.2s'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
                <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.758.459 3.474 1.33 4.982l-1.413 5.161 5.284-1.385a9.948 9.948 0 0 0 4.787 1.226h.004c5.505 0 9.988-4.478 9.989-9.984 0-2.669-1.038-5.176-2.925-7.062a9.925 9.925 0 0 0-7.066-2.922zm0 1.666c4.587 0 8.322 3.734 8.323 8.318 0 2.227-.866 4.319-2.441 5.892a8.27 8.27 0 0 1-5.882 2.436h-.003a8.29 8.29 0 0 1-4.225-1.155l-.303-.18-3.136.822.836-3.056-.197-.314a8.292 8.292 0 0 1-1.296-4.444c.001-4.584 3.737-8.319 8.327-8.319zm-3.6 3.6c-.206 0-.539.077-.822.385s-1.077 1.052-1.077 2.565 1.103 2.975 1.257 3.181c.154.205 2.132 3.324 5.235 4.607 2.585 1.069 3.111.856 3.676.804.564-.051 1.821-.744 2.077-1.462.257-.718.257-1.334.18-1.462-.077-.128-.282-.205-.59-.359s-1.821-.898-2.103-1.001c-.282-.103-.487-.154-.693.154s-.8 1.001-.979 1.206c-.18.205-.359.231-.667.077-.308-.154-1.301-.48-2.478-1.53-1.177-1.05-1.972-2.348-2.203-2.743-.231-.395-.025-.609.129-.762.138-.138.308-.359.462-.539.154-.18.205-.308.308-.513.103-.205.051-.385-.026-.539-.077-.154-.693-1.667-.949-2.283-.249-.601-.502-.519-.693-.529z"/>
              </svg>
              <span>Fale conosco pelo WhatsApp</span>
            </a>
            <div style={{
              marginTop: '10px',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.85)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#A6CE39' }}>phone</span>
              <span>(61) 3246-2117</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{
          maxWidth: '1240px',
          margin: '20px auto 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.6)',
          flexWrap: 'wrap',
          gap: '12px'
        }} className="footer-bottom">
          <div>© {new Date().getFullYear()} Bryza. Todos os direitos reservados.</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Política de Privacidade</a>
            <span>|</span>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Termos de Uso</a>
          </div>
        </div>
      </footer>

      {/* Global CSS for Responsive Media Queries */}
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-33.333%); }
        }
        .marquee-track {
          animation: marquee 25s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        @media (max-width: 992px) {
          .navbar-container {
            padding: 12px 16px !important;
          }
          .marquee-banner {
            padding: 5px 0 !important;
          }
          .marquee-track {
            font-size: 11.5px !important;
            gap: 24px !important;
          }
          .mobile-hamburger-btn {
            display: flex !important;
          }
          .nav-links {
            display: none !important;
          }
          .nav-actions {
            display: none !important;
          }
          #hero {
            padding: 32px 18px 36px !important;
            backgroundImage: linear-gradient(180deg, rgba(5, 15, 32, 0.94) 0%, rgba(5, 15, 32, 0.88) 60%, rgba(5, 15, 32, 0.96) 100%), url('/hero-site-bryza.webp') !important;
            background-size: cover !important;
            background-position: center top !important;
          }
          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .hero-spacer {
            display: none !important;
            min-height: 0 !important;
            height: 0 !important;
          }
          .hero-grid h1 {
            font-size: 28px !important;
            line-height: 1.22 !important;
            margin-bottom: 12px !important;
          }
          .hero-grid p {
            font-size: 14.5px !important;
            margin-bottom: 20px !important;
          }
          .benefits-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .embaixador-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
          .faq-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .quem-somos-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
          .quem-somos-card {
            padding: 24px 20px !important;
            border-radius: 16px !important;
            margin-bottom: 32px !important;
          }
          .quem-somos-card p {
            font-size: 15px !important;
          }
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 24px !important;
          }
        }
        @media (max-width: 600px) {
          .navbar-container {
            padding: 10px 14px !important;
          }
          .navbar-container img {
            height: 38px !important;
          }
          .marquee-banner {
            padding: 3.5px 0 !important;
          }
          .marquee-track {
            font-size: 10.5px !important;
            gap: 20px !important;
          }
          #hero {
            padding: 28px 14px 32px !important;
            backgroundImage: linear-gradient(180deg, rgba(5, 15, 32, 0.95) 0%, rgba(5, 15, 32, 0.90) 70%, rgba(5, 15, 32, 0.97) 100%), url('/hero-site-bryza.webp') !important;
          }
          .hero-grid h1 {
            font-size: 24px !important;
          }
          #quem-somos {
            padding: 40px 14px !important;
          }
          #quem-somos h2 {
            font-size: 26px !important;
          }
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
          .footer-bottom {
            flex-direction: column !important;
            text-align: center !important;
          }
        }
      `}</style>
    </div>
  );
};
