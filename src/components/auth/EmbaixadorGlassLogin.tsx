'use client';

import React, { useState, useEffect } from 'react';
import { login } from '@/app/login/actions';

interface EmbaixadorGlassLoginProps {
  errorMessage?: string;
}

export const EmbaixadorGlassLogin: React.FC<EmbaixadorGlassLoginProps> = ({ errorMessage }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Mouse tracking for subtle 3D reflection effect on desktop
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
      height: '100vh',
      overflow: 'auto',
      fontFamily: "'Poppins', system-ui, sans-serif",
      backgroundImage: "url('/bg-embaixadores.jpg')",
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

      {/* Dark Overlay with Blur & Vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(10, 17, 28, 0.52)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.4) 0%, rgba(5, 10, 20, 0.75) 100%)',
        zIndex: 1
      }} />

      {/* Main Fullscreen Container */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        maxWidth: '1440px',
        minHeight: '100vh',
        padding: '32px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>

        {/* Left Side: Branding & Value Proposition */}
        <div className="branding-section" style={{
          flex: 1,
          maxWidth: '640px',
          paddingRight: '48px',
          color: '#ffffff'
        }}>
          {/* Logo & Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '44px' }}>
            <img
              src="/Logo%20Bryza.svg"
              alt="Bryza Logo"
              style={{
                height: '52px',
                width: 'auto',
                filter: 'brightness(0) invert(1) drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
              }}
            />
            <span style={{
              backgroundColor: 'rgba(166, 206, 57, 0.15)',
              border: '1px solid rgba(166, 206, 57, 0.4)',
              color: '#A6CE39',
              fontSize: '11px',
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: '20px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 0 16px rgba(166, 206, 57, 0.2)'
            }}>
              Embaixadores
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: '48px',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            marginBottom: '20px',
            textShadow: '0 4px 20px rgba(0,0,0,0.4)'
          }}>
            Transforme sua paixão em{' '}
            <span style={{
              color: '#A6CE39',
              position: 'relative',
              display: 'inline-block',
              textShadow: '0 0 24px rgba(166, 206, 57, 0.45)'
            }}>
              impacto.
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: '17px',
            fontWeight: 400,
            color: 'rgba(255, 255, 255, 0.82)',
            lineHeight: 1.6,
            marginBottom: '48px',
            maxWidth: '520px',
            textShadow: '0 2px 10px rgba(0,0,0,0.3)'
          }}>
            Acesse sua conta e acompanhe seus resultados, comissões e dados exclusivos.
          </p>

          {/* 3 Benefits in a Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            maxWidth: '580px'
          }}>
            {/* Benefit 1 */}
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
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>trending_up</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.35 }}>
                Acompanhe seus resultados
              </span>
            </div>

            {/* Benefit 2 */}
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
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>payments</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.35 }}>
                Gerencie suas comissões
              </span>
            </div>

            {/* Benefit 3 */}
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
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>card_giftcard</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.35 }}>
                Acesse benefícios exclusivos
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel: Glassmorphism Login Card */}
        <div
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="glass-card"
          style={{
            width: '100%',
            maxWidth: '460px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(35px) saturate(180%)',
            WebkitBackdropFilter: 'blur(35px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '32px',
            padding: '44px 38px',
            boxShadow: '0 20px 80px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 0 40px rgba(166, 206, 57, 0.06)',
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease'
          }}
        >
          {/* Subtle Mouse Reflection Overlay */}
          {isHovered && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `radial-gradient(circle 260px at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.12) 0%, transparent 80%)`,
              transition: 'background 0.05s ease'
            }} />
          )}

          {/* Card Top Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '18px',
              backgroundColor: 'rgba(166, 206, 57, 0.12)',
              border: '1px solid rgba(166, 206, 57, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#A6CE39',
              marginBottom: '18px',
              boxShadow: '0 0 24px rgba(166, 206, 57, 0.25)'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>eco</span>
            </div>

            <h2 style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 8px',
              letterSpacing: '-0.01em'
            }}>
              Já é cliente?
            </h2>

            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.75)',
              margin: 0,
              fontWeight: 400
            }}>
              Faça login para continuar.
            </p>
          </div>

          {/* Error Message */}
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
          <form action={login} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Email / Username Input */}
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{
                position: 'absolute',
                left: '18px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255, 255, 255, 0.55)',
                fontSize: '20px',
                pointerEvents: 'none'
              }}>
                mail
              </span>
              <input
                type="text"
                id="identifier"
                name="identifier"
                required
                placeholder="seu@email.com"
                autoComplete="username"
                autoCapitalize="none"
                style={{
                  width: '100%',
                  height: '58px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '14px',
                  padding: '0 20px 0 52px',
                  fontSize: '15px',
                  color: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#A6CE39';
                  e.target.style.boxShadow = '0 0 18px rgba(166, 206, 57, 0.3)';
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                }}
              />
            </div>

            {/* Password Input */}
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{
                position: 'absolute',
                left: '18px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255, 255, 255, 0.55)',
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
                placeholder="Sua senha"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  height: '58px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '14px',
                  padding: '0 52px 0 52px',
                  fontSize: '15px',
                  color: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#A6CE39';
                  e.target.style.boxShadow = '0 0 18px rgba(166, 206, 57, 0.3)';
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
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
                  color: 'rgba(255, 255, 255, 0.65)',
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

            {/* Remember Me & Forgot Password */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13.5px',
              color: 'rgba(255, 255, 255, 0.75)',
              marginTop: '2px'
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
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                />
                <span>Lembrar de mim</span>
              </label>

              <a
                href="#"
                onClick={(e) => { e.preventDefault(); alert('Instruções de redefinição enviadas para o e-mail cadastrado.'); }}
                style={{
                  color: '#A6CE39',
                  textDecoration: 'none',
                  fontWeight: 500,
                  transition: 'opacity 0.2s'
                }}
              >
                Esqueceu sua senha?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              style={{
                width: '100%',
                height: '60px',
                backgroundColor: '#A6CE39',
                border: 'none',
                borderRadius: '16px',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '10px',
                boxShadow: '0 8px 28px rgba(166, 206, 57, 0.38)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#b7dc42';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 36px rgba(166, 206, 57, 0.55)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#A6CE39';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 28px rgba(166, 206, 57, 0.38)';
              }}
            >
              <span>Entrar</span>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>east</span>
            </button>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              margin: '12px 0 6px'
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />
              <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 400 }}>
                ou continue com
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />
            </div>

            {/* Social Login Button */}
            <button
              type="button"
              onClick={() => alert('Autenticação social em breve.')}
              style={{
                width: '100%',
                height: '52px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '14px',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                backdropFilter: 'blur(10px)',
                transition: 'background-color 0.2s, border-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              {/* Google SVG Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Entrar com Google</span>
            </button>

            {/* Footer Security Note */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: 'rgba(255, 255, 255, 0.65)',
              fontSize: '12px',
              textAlign: 'center',
              marginTop: '12px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock</span>
              <span>Seus dados estão protegidos com segurança avançada.</span>
            </div>
          </form>
        </div>
      </div>

      {/* Global CSS for Mobile Responsiveness */}
      <style jsx global>{`
        @media (max-width: 992px) {
          .branding-section {
            display: none !important;
          }
          .glass-card {
            max-width: 100% !important;
            margin: 16px !important;
            padding: 32px 24px !important;
          }
        }
      `}</style>
    </div>
  );
};
