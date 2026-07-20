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
      answer: 'Entregamos em diversas regiões do Brasil com entrega própria e transportadoras parceiras. Consulte a disponibilidade para seu endereço no momento do pedido.'
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

      {/* Hero Section */}
      <section id="hero" style={{
        backgroundColor: '#f8fafc',
        backgroundImage: "radial-gradient(circle at 80% 30%, rgba(166, 206, 57, 0.08) 0%, transparent 60%)",
        padding: '60px 40px 70px',
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
          {/* Left Text */}
          <div>
            <h1 style={{
              fontSize: '44px',
              fontWeight: 800,
              color: '#002b5c',
              lineHeight: 1.18,
              letterSpacing: '-0.02em',
              marginBottom: '20px'
            }}>
              Produtos que cuidam da sua casa e deixam sua presença.
            </h1>

            <p style={{
              fontSize: '16.5px',
              color: '#475569',
              lineHeight: 1.6,
              marginBottom: '32px',
              maxWidth: '520px',
              fontWeight: 400
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
                  padding: '14px 32px',
                  borderRadius: '28px',
                  fontWeight: 700,
                  fontSize: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 8px 24px rgba(166, 206, 57, 0.4)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                <span className="material-symbols-outlined" style={{ color: '#002b5c', fontSize: '20px' }}>verified_user</span>
                <span>Pague somente na entrega</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                <span className="material-symbols-outlined" style={{ color: '#002b5c', fontSize: '20px' }}>local_shipping</span>
                <span>Frete grátis*</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                <span className="material-symbols-outlined" style={{ color: '#002b5c', fontSize: '20px' }}>groups</span>
                <span>Ganhe indicando nossos produtos</span>
              </div>
            </div>

            <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: 0 }}>
              *Consulte regiões e condições no momento do pedido.
            </p>
          </div>

          {/* Right Product Image */}
          <div style={{ textAlign: 'center', position: 'relative' }}>
            <img
              src="/hero-bg.webp"
              alt="Produtos Bryza Sabão Líquido e Amaciante 5L"
              style={{
                width: '100%',
                maxHeight: '440px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 12px 24px rgba(0, 43, 92, 0.15))'
              }}
            />
          </div>
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
              <a href="https://instagram.com" target="_blank" rel="noreferrer" style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                textDecoration: 'none'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>photo_camera</span>
              </a>
              <a href="https://wa.me/5561982115107" target="_blank" rel="noreferrer" style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                textDecoration: 'none'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chat</span>
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
              href="https://wa.me/5561982115107"
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
                gap: '8px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#25D366' }}>chat</span>
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
          <div>© 2025 Bryza. Todos os direitos reservados.</div>
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
