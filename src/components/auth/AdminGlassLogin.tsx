'use client';

import React, { useState } from 'react';
import { login } from '@/app/login/actions';
import { LoginSubmitButton } from './LoginSubmitButton';

interface AdminGlassLoginProps {
  errorMessage?: string;
}

export const AdminGlassLogin: React.FC<AdminGlassLoginProps> = ({ errorMessage }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100dvh',
      overflow: 'hidden',
      fontFamily: "'Poppins', system-ui, sans-serif",
      backgroundImage: "url('/bg-admin.webp')",
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Google Fonts Poppins */}
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {/* Material Symbols Outlined */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        rel="stylesheet"
      />

      {/* Dark overlay — leve, para não competir com o painel */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 30% 50%, rgba(5, 15, 35, 0.38) 0%, rgba(3, 8, 20, 0.72) 100%)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        zIndex: 1
      }} />

      {/* Main Fullscreen Container */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: '1440px',
          height: '100%',
          padding: '32px 48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '0 auto',
          boxSizing: 'border-box'
        }}
        className="admin-main-container"
      >

        {/* Left Side: Institucional */}
        <div className="admin-branding-section" style={{
          flex: 1,
          maxWidth: '640px',
          paddingRight: '48px',
          color: '#ffffff'
        }}>
          {/* Logo + Badge Institucional */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '44px' }}>
            <img
              src="/Logo%20Bryza.svg"
              alt="Bryza Logo"
              style={{
                height: '85px',
                width: 'auto',
                filter: 'brightness(0) invert(1) drop-shadow(0 4px 16px rgba(0,0,0,0.6))'
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{
                backgroundColor: 'rgba(166, 206, 57, 0.15)',
                border: '1.5px solid rgba(166, 206, 57, 0.45)',
                color: '#A6CE39',
                fontSize: '11px',
                fontWeight: 700,
                padding: '5px 14px',
                borderRadius: '24px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 0 18px rgba(166, 206, 57, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>shield</span>
                Plataforma Segura
              </span>
              <span style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '11px',
                fontWeight: 500,
                padding: '4px 12px',
                borderRadius: '20px',
                letterSpacing: '0.06em',
                backdropFilter: 'blur(10px)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#A6CE39' }}>bolt</span>
                Gestão Operacional Integrada
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: '48px',
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: '-0.025em',
            marginBottom: '20px',
            textShadow: '0 4px 24px rgba(0,0,0,0.5)'
          }}>
            A central de{' '}
            <span style={{
              color: '#A6CE39',
              display: 'inline-block',
              textShadow: '0 0 28px rgba(166, 206, 57, 0.5)'
            }}>
              comando
            </span>
            {' '}da Bryza.
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: '17px',
            fontWeight: 400,
            color: 'rgba(255, 255, 255, 0.8)',
            lineHeight: 1.65,
            marginBottom: '48px',
            maxWidth: '520px',
            textShadow: '0 2px 12px rgba(0,0,0,0.35)'
          }}>
            Gerencie vendas, pedidos, estoque, logística, clientes e embaixadores em uma única plataforma.
          </p>

          {/* 3 Benefit Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            maxWidth: '580px'
          }}>
            {/* Controle Total */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '18px',
              padding: '20px 16px',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'transform 0.2s, border-color 0.2s'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(166, 206, 57, 0.12)',
                border: '1px solid rgba(166, 206, 57, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#A6CE39'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>bar_chart</span>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>Controle Total</div>
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255, 255, 255, 0.72)', lineHeight: 1.4 }}>
                  Indicadores, vendas e desempenho em tempo real
                </span>
              </div>
            </div>

            {/* Operação Integrada */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '18px',
              padding: '20px 16px',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'transform 0.2s, border-color 0.2s'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(166, 206, 57, 0.12)',
                border: '1px solid rgba(166, 206, 57, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#A6CE39'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>inventory_2</span>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>Operação Integrada</div>
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255, 255, 255, 0.72)', lineHeight: 1.4 }}>
                  Pedidos, estoque e logística em um ambiente
                </span>
              </div>
            </div>

            {/* Gestão de Embaixadores */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '18px',
              padding: '20px 16px',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'transform 0.2s, border-color 0.2s'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(166, 206, 57, 0.12)',
                border: '1px solid rgba(166, 206, 57, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#A6CE39'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>group</span>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>Rede de Embaixadores</div>
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255, 255, 255, 0.72)', lineHeight: 1.4 }}>
                  Comissões, crescimento e resultados da rede
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel Wrapper */}
        <div className="admin-right-panel-wrapper" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: '460px'
        }}>
          {/* Mobile Header — logo fora do card */}
          <div className="admin-mobile-header">
            <img
              src="/Logo%20Bryza.svg"
              alt="Bryza Logo"
              style={{
                height: '75px',
                width: 'auto',
                filter: 'brightness(0) invert(1) drop-shadow(0 4px 12px rgba(0,0,0,0.6))'
              }}
            />
            <span style={{
              backgroundColor: 'rgba(166, 206, 57, 0.2)',
              border: '1.5px solid rgba(166, 206, 57, 0.5)',
              color: '#A6CE39',
              fontSize: '11px',
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: '20px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 0 16px rgba(166, 206, 57, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>shield</span>
              Central Administrativa
            </span>
          </div>

          {/* Glass Card */}
          <div
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="admin-glass-card"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(35px) saturate(180%)',
              WebkitBackdropFilter: 'blur(35px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '32px',
              padding: '44px 38px',
              boxShadow: '0 20px 80px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 0 40px rgba(166, 206, 57, 0.05)',
              position: 'relative',
              overflow: 'hidden',
              boxSizing: 'border-box',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease'
            }}
          >
            {/* Mouse Reflection */}
            {isHovered && (
              <div style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: `radial-gradient(circle 260px at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.10) 0%, transparent 80%)`,
                transition: 'background 0.05s ease'
              }} />
            )}

            {/* Card Header */}
            <div className="admin-login-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
              {/* Mini logo no card (desktop) */}
              <div className="admin-card-logo">
                <img
                  src="/Logo%20Bryza.svg"
                  alt="Bryza"
                  style={{
                    height: '44px',
                    width: 'auto',
                    filter: 'brightness(0) invert(1) drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
                    marginBottom: '16px'
                  }}
                />
              </div>
              <h2 style={{
                fontSize: '26px',
                fontWeight: 700,
                color: '#ffffff',
                margin: '0 0 8px',
                letterSpacing: '-0.01em'
              }}>
                Bem-vindo de volta
              </h2>
              <p style={{
                fontSize: '13.5px',
                color: 'rgba(255, 255, 255, 0.7)',
                margin: 0,
                fontWeight: 400,
                lineHeight: 1.5
              }}>
                Entre com suas credenciais para acessar o painel administrativo.
              </p>
            </div>

            {/* Error */}
            {errorMessage && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.18)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                padding: '12px 16px',
                borderRadius: '14px',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backdropFilter: 'blur(10px)'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                {errorMessage}
              </div>
            )}

            {/* Login Form */}
            <form action={login} className="admin-login-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Identifier */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '8px' }}>
                  E-mail, usuário ou telefone
                </label>
                <div style={{ position: 'relative' }}>
                  <span className="material-symbols-outlined" style={{
                    position: 'absolute',
                    left: '18px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontSize: '20px',
                    pointerEvents: 'none'
                  }}>
                    person
                  </span>
                  <input
                    type="text"
                    id="identifier"
                    name="identifier"
                    required
                    placeholder="seu@email.com ou usuário"
                    autoComplete="username"
                    autoCapitalize="none"
                    style={{
                      width: '100%',
                      height: '58px',
                      backgroundColor: 'rgba(255, 255, 255, 0.10)',
                      border: '1px solid rgba(255, 255, 255, 0.28)',
                      borderRadius: '14px',
                      padding: '0 20px 0 52px',
                      fontSize: '14.5px',
                      color: '#ffffff',
                      fontWeight: 500,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#A6CE39';
                      e.target.style.boxShadow = '0 0 18px rgba(166, 206, 57, 0.35)';
                      e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.16)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                      e.target.style.boxShadow = 'none';
                      e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.10)';
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '8px' }}>
                  Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <span className="material-symbols-outlined" style={{
                    position: 'absolute',
                    left: '18px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontSize: '20px',
                    pointerEvents: 'none'
                  }}>
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    required
                    placeholder="Sua senha de acesso"
                    autoComplete="current-password"
                    style={{
                      width: '100%',
                      height: '58px',
                      backgroundColor: 'rgba(255, 255, 255, 0.10)',
                      border: '1px solid rgba(255, 255, 255, 0.28)',
                      borderRadius: '14px',
                      padding: '0 52px 0 52px',
                      fontSize: '14.5px',
                      color: '#ffffff',
                      fontWeight: 500,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#A6CE39';
                      e.target.style.boxShadow = '0 0 18px rgba(166, 206, 57, 0.35)';
                      e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.16)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                      e.target.style.boxShadow = 'none';
                      e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.10)';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.75)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="admin-remember-row" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13.5px',
                color: 'rgba(255, 255, 255, 0.85)',
                marginTop: '4px'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{
                      accentColor: '#A6CE39',
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer'
                    }}
                  />
                  <span>Lembrar de mim</span>
                </label>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); alert('Instruções enviadas para o e-mail cadastrado.'); }}
                  style={{
                    color: '#A6CE39',
                    textDecoration: 'none',
                    fontWeight: 600,
                    transition: 'opacity 0.2s'
                  }}
                >
                  Esqueceu sua senha?
                </a>
              </div>

              <LoginSubmitButton label="Entrar no sistema" variant="admin" />

              {/* Security Note */}
              <div className="admin-security-note" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                color: 'rgba(255, 255, 255, 0.65)',
                fontSize: '12px',
                textAlign: 'center',
                marginTop: '8px'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>lock</span>
                <span>Seus dados estão protegidos por criptografia e autenticação segura.</span>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Global CSS */}
      <style jsx global>{`
        .admin-mobile-header {
          display: none;
        }
        .admin-card-logo {
          display: block;
        }
        input::placeholder,
        input::-webkit-input-placeholder,
        input::-moz-placeholder,
        input:-ms-input-placeholder {
          color: rgba(255, 255, 255, 0.72) !important;
          opacity: 1 !important;
          font-weight: 400 !important;
        }
        @media (max-width: 992px) {
          .admin-main-container {
            padding: 16px 0 !important;
            justify-content: center !important;
          }
          .admin-branding-section {
            display: none !important;
          }
          .admin-card-logo {
            display: none !important;
          }
          .admin-mobile-header {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            margin-bottom: 12px !important;
            flex-shrink: 0 !important;
          }
          .admin-mobile-header img {
            height: 68px !important;
          }
          .admin-mobile-header span {
            font-size: 10px !important;
            padding: 4px 10px !important;
          }
          .admin-right-panel-wrapper {
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 14px !important;
            justify-content: center !important;
            overflow-y: auto !important;
          }
          .admin-glass-card {
            max-width: 100% !important;
            width: 100% !important;
            padding: 20px 18px !important;
            border-radius: 24px !important;
          }
          .admin-login-header {
            margin-bottom: 18px !important;
          }
          .admin-login-header h2 {
            font-size: 22px !important;
          }
          .admin-login-header p {
            font-size: 13px !important;
          }
          .admin-glass-card label {
            font-size: 11.5px !important;
            margin-bottom: 5px !important;
          }
          .admin-glass-card input[type=text],
          .admin-glass-card input[type=password] {
            height: 46px !important;
            font-size: 13.5px !important;
          }
          .admin-login-form {
            gap: 12px !important;
          }
          .admin-submit-btn {
            height: 50px !important;
            font-size: 15px !important;
            margin-top: 2px !important;
          }
          .admin-security-note {
            margin-top: 6px !important;
            font-size: 11px !important;
          }
          .admin-remember-row {
            font-size: 12px !important;
          }
        }
      `}</style>
    </div>
  );
};
