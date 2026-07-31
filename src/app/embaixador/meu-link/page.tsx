'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getReferralUrl } from '@/utils/env';
import { getPortalDashboardData } from '../actions';
import { toast } from 'sonner';
import styles from './meu-link.module.css';

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
  const cadastroUrl = `${getReferralUrl(code).replace(/\/r\/.*$/, '')}/cadastro/${code}`;
  const qrCodeUrl = `/api/r/${code}/qrcode`;
  const whatsappMsg = encodeURIComponent(`Olá! Compre na Bryza utilizando meu link exclusivo de indicação: ${fullUrl}`);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  };

  return (
    <MainLayout>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            Meu Link de Indicação
          </h1>
          <p className={styles.subtitle}>
            Divulgue seu código, link de vendas ou convite de cadastro e ganhe comissão pelas suas indicações.
          </p>
        </header>

        <div className={styles.card}>
          {/* Código Imutável */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Seu Código Imutável
            </label>
            <div className={styles.inputRow}>
              <input
                type="text"
                value={code}
                disabled
                className={styles.inputField}
                style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700 }}
              />
              <button
                onClick={() => handleCopy(code, 'Código')}
                className={styles.actionButton}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>content_copy</span>
                Copiar Código
              </button>
            </div>
          </div>

          {/* Link Completo de Vendas */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Seu Link Completo de Vendas
            </label>
            <div className={styles.inputRow}>
              <input
                type="text"
                value={fullUrl}
                disabled
                className={styles.inputField}
              />
              <a
                href={fullUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.secondaryButton}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>open_in_new</span>
                Acessar
              </a>
              <button
                onClick={() => handleCopy(fullUrl, 'Link de Vendas')}
                className={styles.actionButton}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>link</span>
                Copiar Link
              </button>
            </div>
          </div>

          {/* Link de Convite de Cadastro para Novos Embaixadores */}
          <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Link de Convite para Novos Embaixadores
            </label>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px', margin: '0 0 12px 0' }}>
              Envie este link para quem deseja cadastrar como novo Embaixador indicado da sua rede.
            </p>
            <div className={styles.inputRow}>
              <input
                type="text"
                value={cadastroUrl}
                disabled
                className={styles.inputField}
              />
              <a
                href={cadastroUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.secondaryButton}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>open_in_new</span>
                Acessar
              </a>
              <button
                onClick={() => handleCopy(cadastroUrl, 'Link de Convite')}
                className={styles.actionButton}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
                Copiar Convite
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
              className={styles.whatsappButton}
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
              className={styles.secondaryButton}
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
