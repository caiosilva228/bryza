'use client';

import React, { useState } from 'react';
import { getSubdomainUrl } from '@/utils/subdomain';

export const LandingPage: React.FC = () => {
  const evUrl = getSubdomainUrl('ev', '/login');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
        {/* Logo Bryza */}
        <a href="#hero" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <img
            src="/Logo%20Bryza.svg"
            alt="Bryza Logo"
            style={{ height: '48px', width: 'auto' }}
          />
        </a>

        {/* Menu Navigation Links */}
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
        </nav>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a
            href={evUrl}
            style={{
              textDecoration: 'none',
              color: '#002b5c',
              border: '1.5px solid #002b5c',
              borderRadius: '10px',
              padding: '9px 18px',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s ease',
              backgroundColor: 'transparent'
            }}
          >
            Espaço do Embaixador
          </a>
          <a
            href="#hero"
            style={{
              textDecoration: 'none',
              color: '#ffffff',
              backgroundColor: '#A6CE39',
              borderRadius: '10px',
              padding: '10px 22px',
              fontWeight: 700,
              fontSize: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(166, 206, 57, 0.35)',
              transition: 'transform 0.2s, background-color 0.2s'
            }}
          >
            <span>Conheça a Loja</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_cart</span>
          </a>
        </div>
      </header>

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
      }}>
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
              Produtos que cuidam da sua casa e deixam sua presença.
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
          <div style={{ minHeight: '360px' }} />
        </div>
      </section>

      {/* Seção 3 Benefícios / Features Strip */}
      <section id="beneficios" style={{ padding: '60px 40px', backgroundColor: '#ffffff' }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
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
      </section>

      {/* Banner Embaixadores (Azul Marinho #002b5c) */}
      <section id="embaixador" style={{
        backgroundColor: '#002b5c',
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0, 68, 148, 0.4) 0%, rgba(0, 30, 65, 0.95) 100%)',
        color: '#ffffff',
        padding: '60px 40px',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr 1fr',
          gap: '28px',
          alignItems: 'center'
        }} className="embaixador-grid">
          {/* Left Text */}
          <div>
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

          {/* Middle Photo */}
          <div style={{ textAlign: 'center' }}>
            <img
              src="/ambassador-photo.webp"
              alt="Embaixadora Bryza com celular"
              style={{
                maxWidth: '100%',
                maxHeight: '260px',
                borderRadius: '16px',
                objectFit: 'cover'
              }}
            />
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

      {/* FAQ Section (Accordion em 2 colunas) */}
      <section id="faq" style={{ padding: '70px 40px', backgroundColor: '#ffffff' }}>
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
            padding: 14px 20px !important;
          }
          .nav-links {
            display: none !important;
          }
          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
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
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 24px !important;
          }
        }
        @media (max-width: 600px) {
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
