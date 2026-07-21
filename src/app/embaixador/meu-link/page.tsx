'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getReferralUrl } from '@/utils/env';
import { getPortalDashboardData } from '../actions';
import { toast } from 'sonner';

export default function MeuLinkPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPortalDashboardData()
      .then(setData)
      .catch((e) => toast.error(e.message || 'Erro ao carregar link.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <div style={{ padding: '40px', textAlign: 'center' }}>Carregando dados...</div>
      </MainLayout>
    );
  }

  const code = data?.referral_code || 'bryza01';
  const fullUrl = getReferralUrl(code);
  const qrCodeUrl = `/api/r/${code}/qrcode`;
  const whatsappMsg = encodeURIComponent(`Olá! Compre na Bryza utilizando meu link exclusivo de indicação: ${fullUrl}`);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  };

  return (
    <MainLayout>
      <div style={{ maxWidth: '800px', margin: '0 auto 40px' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700, margin: 0 }}>
            Meu Link de Indicação
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
            Divulgue seu código ou link exclusivo e ganhe comissão por cada venda indicada.
          </p>
        </header>

        <div style={{
          backgroundColor: 'var(--color-surface-container-low)',
          padding: '32px',
          borderRadius: '20px',
          border: '1px solid var(--color-outline-variant)',
          display: 'flex',
          flexDirection: 'column',
          gap: '28px'
        }}>
          {/* Código Imutável */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Seu Código Imutável
            </label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                value={code}
                disabled
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface-container-high)',
                  color: 'var(--color-on-surface)',
                  fontFamily: 'monospace',
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: 'not-allowed'
                }}
              />
              <button
                onClick={() => handleCopy(code, 'Código')}
                style={{
                  padding: '12px 20px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>content_copy</span>
                Copiar Código
              </button>
            </div>
          </div>

          {/* Link Completo */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Seu Link Completo de Indicação
            </label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                value={fullUrl}
                disabled
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface-container-high)',
                  color: 'var(--color-on-surface)',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'not-allowed'
                }}
              />
              <a
                href={fullUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  textDecoration: 'none',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-surface-container-highest, #e2e8f0)',
                  color: 'var(--color-on-surface)',
                  border: '1px solid var(--color-outline-variant)',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>open_in_new</span>
                Acessar
              </a>
              <button
                onClick={() => handleCopy(fullUrl, 'Link')}
                style={{
                  padding: '12px 20px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>link</span>
                Copiar Link
              </button>
            </div>
          </div>

          {/* Compartilhamento WhatsApp */}
          <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '12px', marginTop: 0 }}>
              Compartilhar nas Redes
            </h3>
            <a
              href={`https://wa.me/?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 24px',
                borderRadius: '10px',
                backgroundColor: '#25D366',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '15px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>chat</span>
              Compartilhar no WhatsApp
            </a>
          </div>

          {/* QR Code Imutável e Baixável */}
          <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '16px', marginTop: 0 }}>
              Seu QR Code Exclusivo
            </h3>
            
            <div style={{
              backgroundColor: 'white',
              padding: '16px',
              borderRadius: '16px',
              border: '1px solid var(--color-outline-variant)',
              marginBottom: '16px',
              width: '180px',
              height: '180px'
            }}>
              <img src={qrCodeUrl} alt="QR Code Indicação" style={{ width: '100%', height: '100%' }} />
            </div>

            <a
              href={qrCodeUrl}
              download={`qrcode-${code}.png`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid var(--color-outline)',
                backgroundColor: 'transparent',
                color: 'var(--color-on-surface)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
              Baixar Imagem do QR Code
            </a>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
