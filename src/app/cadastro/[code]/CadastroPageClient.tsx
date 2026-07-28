'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Link,
  LayoutDashboard,
  Users,
} from 'lucide-react';
import styles from '@/components/public/KitBryzaSalesPage.module.css';
import { CadastroModal } from '@/components/public/CadastroModal';

interface SponsorData {
  display_name: string;
  referral_code: string;
  photo_path: string | null;
  city: string | null;
}

interface CadastroPageClientProps {
  sponsor: SponsorData;
}

function AmbassadorAvatar({ photoPath, name, size = 72 }: { photoPath?: string | null; name: string; size?: number }) {
  if (photoPath) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={photoPath}
        alt={`Foto de ${name}`}
        width={size}
        height={size}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '3px solid #5a8216',
          boxShadow: '0 4px 16px rgba(90, 130, 22, 0.25)',
        }}
      />
    );
  }
  const initial = name ? name.trim().charAt(0).toUpperCase() : 'E';
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: '#0b5ea8',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: `${Math.round(size * 0.42)}px`,
        boxShadow: '0 4px 16px rgba(11, 94, 168, 0.25)',
      }}
    >
      {initial}
    </div>
  );
}

export function CadastroPageClient({ sponsor }: CadastroPageClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className={styles.page}>
      {/* 1. Faixa de Anúncio Superior (Marquee Continuo e Lento no Mobile) */}
      <div className={styles.announcement} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div className={styles.marqueeTrack}>
          <span className={styles.marqueeItem}>
            <Users size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
            Programa Oficial de Embaixadores Bryza • Convite Exclusivo de {sponsor.display_name}
          </span>
          <span className={styles.marqueeItem}>
            <Users size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
            Programa Oficial de Embaixadores Bryza • Convite Exclusivo de {sponsor.display_name}
          </span>
          <span className={styles.marqueeItem}>
            <Users size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
            Programa Oficial de Embaixadores Bryza • Convite Exclusivo de {sponsor.display_name}
          </span>
        </div>
      </div>

      <main>
        {/* 2. Primeira Dobra Alinhada perfeitamente com a Seção 2 */}
        <section
          id="indicacao"
          style={{
            borderBottom: '1px solid #e2e8f0',
            padding: '56px 0',
            background: '#ffffff',
          }}
        >
          <div
            style={{
              width: 'min(1200px, calc(100% - 64px))',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              textAlign: 'left',
              boxSizing: 'border-box',
            }}
          >
            {/* Avatar do Embaixador Patrocinador */}
            <div style={{ marginBottom: '16px', alignSelf: 'flex-start' }} aria-hidden="true">
              <AmbassadorAvatar photoPath={sponsor.photo_path} name={sponsor.display_name} size={76} />
            </div>

            {/* Eyebrow de Convite */}
            <span className={styles.referralEyebrow} style={{ textAlign: 'left' }}>
              CONVITE DE EMBAIXADOR BRYZA
            </span>

            {/* Título Principal Sem Serifas */}
            <h1
              className={styles.referralTitle}
              style={{
                fontSize: 'clamp(26px, 4.5vw, 38px)',
                fontWeight: 800,
                lineHeight: 1.25,
                color: '#051329',
                margin: '8px 0 14px',
                maxWidth: '780px',
                width: '100%',
                textAlign: 'left',
                boxSizing: 'border-box',
              }}
            >
              Faça parte do Programa de Embaixadores Bryza
            </h1>

            {/* Subtítulo Alinhado à Esquerda Sem Serifas */}
            <p
              className={styles.referralText}
              style={{
                fontSize: '16px',
                lineHeight: 1.55,
                color: '#475569',
                maxWidth: '680px',
                width: '100%',
                margin: '0 0 20px',
                textAlign: 'left',
                boxSizing: 'border-box',
              }}
            >
              Ganhe comissões indicando pessoas para comprarem nossos produtos. Cadastre-se em menos de 1 minuto pelo convite exclusivo de <strong style={{ color: '#051329' }}>{sponsor.display_name}</strong>.
            </p>

            {/* Linha de Confiança Alinhada à Esquerda */}
            <div
              className={styles.referralTrustLine}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#051329',
                margin: '0 0 28px',
              }}
            >
              <CheckCircle2 size={16} className={styles.trustCheckIcon} />
              <span>Convite Ativo • Atendimento Oficial Bryza</span>
            </div>

            {/* Botão CTA Principal da Seção 1 */}
            <button
              type="button"
              className={styles.heroCtaBtn}
              onClick={() => setIsModalOpen(true)}
              style={{
                width: '100%',
                maxWidth: '400px',
                minHeight: '56px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                margin: '0',
              }}
            >
              <span>QUERO SER UM EMBAIXADOR</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </section>

        {/* 3. Grade de Benefícios do Embaixador (com o Botão CTA Incorporado na Seção 2) */}
        <section className={styles.benefitsSection} style={{ padding: '56px 0' }}>
          <header className={styles.sectionIntro} style={{ textAlign: 'left', margin: '0 0 32px 0', maxWidth: '100%' }}>
            <span>VANTAGENS DO EMBAIXADOR</span>
            <h2 style={{ textAlign: 'left' }}>Por que se tornar um Embaixador?</h2>
            <p style={{ textAlign: 'left' }}>Tudo o que você precisa para recomendar produtos Bryza e receber suas comissões.</p>
          </header>

          <div role="list" className={styles.benefitGrid}>
            <article role="listitem">
              <TrendingUp />
              <h3>Ganhe Comissões</h3>
              <p>Sobre cada compra que seus indicados realizarem com a Bryza. Uma vez que você indicou, sempre que seu indicado comprar você recebe.</p>
            </article>

            <article role="listitem">
              <Link />
              <h3>Link Personalizado</h3>
              <p>Receba um link exclusivo com seu nome e foto para compartilhar facilmente no WhatsApp.</p>
            </article>

            <article role="listitem">
              <LayoutDashboard />
              <h3>Painel de Controle</h3>
              <p>Acompanhe suas indicações, rede e extratos no portal ev.bryza.com.br.</p>
            </article>
          </div>

          {/* Botão CTA Principal da Seção 2 */}
          <button
            type="button"
            className={styles.heroCtaBtn}
            onClick={() => setIsModalOpen(true)}
            style={{
              width: '100%',
              maxWidth: '400px',
              minHeight: '56px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              margin: '32px 0 0 0',
            }}
          >
            <span>QUERO SER UM EMBAIXADOR</span>
            <ArrowRight size={20} />
          </button>
        </section>
      </main>

      {/* Footer Padrão da Landing Page */}
      <footer style={{ background: '#051329', color: '#c9d3ed', padding: '32px 24px', textAlign: 'center', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
        © {new Date().getFullYear()} Bryza. Todos os direitos reservados.
      </footer>

      {/* Modal de Cadastro */}
      <CadastroModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sponsor={{
          name: sponsor.display_name,
          photo_path: sponsor.photo_path,
          code: sponsor.referral_code,
          city: sponsor.city,
        }}
      />
    </div>
  );
}
