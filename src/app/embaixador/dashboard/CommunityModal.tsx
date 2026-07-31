'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'bryza_community_modal_seen';

interface CommunityModalProps {
  // Link da comunidade Bryza (WhatsApp, Telegram, etc.)
  communityUrl?: string;
}

export function CommunityModal({ communityUrl = 'https://chat.whatsapp.com/bryza-comunidade' }: CommunityModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mostra apenas uma vez por sessão
    const seen = sessionStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setVisible(true);
    }
  }, []);

  const handleClose = () => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const handleAccess = () => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
    window.open(communityUrl, '_blank', 'noopener,noreferrer');
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '24px',
          border: '1px solid var(--color-outline-variant)',
          padding: '36px 32px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.25)',
          animation: 'slideUp 0.25s ease-out',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Botão fechar */}
        <button
          onClick={handleClose}
          aria-label="Fechar"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-on-surface-variant)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
        </button>

        {/* Ícone */}
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '20px',
            backgroundColor: 'var(--color-primary-container)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--color-on-primary-container)' }}>
            groups
          </span>
        </div>

        {/* Título */}
        <h2
          id="community-modal-title"
          style={{
            fontSize: '22px',
            fontFamily: 'var(--font-headline)',
            fontWeight: 700,
            color: 'var(--color-on-surface)',
            margin: '0 0 8px',
          }}
        >
          📢 Comunidade Bryza
        </h2>

        {/* Subtítulo */}
        <p
          style={{
            fontSize: '14px',
            color: 'var(--color-on-surface-variant)',
            lineHeight: 1.6,
            margin: '0 0 28px',
          }}
        >
          Acesse a nossa comunidade exclusiva! Lá você encontra avisos importantes, novidades, dicas de vendas e suporte direto da equipe Bryza.
        </p>

        {/* Botões */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleAccess}
            style={{
              width: '100%',
              padding: '14px 24px',
              borderRadius: '12px',
              backgroundColor: '#25D366',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chat</span>
            Acessar Comunidade
          </button>

          <button
            onClick={handleClose}
            style={{
              width: '100%',
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: 'transparent',
              color: 'var(--color-on-surface-variant)',
              border: '1px solid var(--color-outline-variant)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Agora não
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}
