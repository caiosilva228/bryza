'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Users,
  TrendingUp,
  Gift,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import styles from './CadastroPage.module.css';
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

export function CadastroPageClient({ sponsor }: CadastroPageClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sponsorInitial = sponsor.display_name
    ? sponsor.display_name.charAt(0).toUpperCase()
    : 'B';

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <header className={styles.topBar}>
        <div className={styles.logo}>
          BRYZA<span>.</span>
        </div>
        <div className={styles.headerBadge}>
          <ShieldCheck size={14} /> Convite Oficial de Embaixador
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.hero}>
        {/* Banner do Patrocinador */}
        <div className={styles.sponsorSection}>
          {sponsor.photo_path ? (
            <Image
              src={sponsor.photo_path}
              alt={sponsor.display_name}
              width={64}
              height={64}
              className={styles.sponsorAvatar}
            />
          ) : (
            <div className={styles.sponsorAvatar}>{sponsorInitial}</div>
          )}
          <div className={styles.sponsorText}>
            <span className={styles.sponsorLabel}>Você recebeu um convite de</span>
            <span className={styles.sponsorName}>{sponsor.display_name}</span>
            {sponsor.city && <span className={styles.sponsorLocation}>{sponsor.city}</span>}
          </div>
        </div>

        {/* Headline & Subheadline */}
        <h1 className={styles.title}>
          Seja um <span className={styles.titleHighlight}>Embaixador Bryza</span> e construa sua própria rede de ganhos.
        </h1>
        <p className={styles.subtitle}>
          Faça parte do programa oficial de embaixadores da Bryza. Cadastre-se em instantes pelo convite de{' '}
          <strong style={{ color: '#ffffff' }}>{sponsor.display_name}</strong> e acesse imediatamente o seu painel exclusivo.
        </p>

        {/* CTA Button */}
        <button
          type="button"
          className={styles.ctaButton}
          onClick={() => setIsModalOpen(true)}
        >
          <span>QUERO SER UM EMBAIXADOR</span>
          <ArrowRight size={20} />
        </button>

        {/* Benefits Grid */}
        <div className={styles.benefitsGrid}>
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <TrendingUp size={24} />
            </div>
            <h3 className={styles.benefitTitle}>Comissões e Ganhos Em Escala</h3>
            <p className={styles.benefitDesc}>
              Receba comissões diretas sobre pedidos e construa sua rede multinível de vendas.
            </p>
          </div>

          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Users size={24} />
            </div>
            <h3 className={styles.benefitTitle}>Link Personalizado Exclusivo</h3>
            <p className={styles.benefitDesc}>
              Receba um link próprio (ex: bryza.com.br/bryzaNN) com sua foto e nome para divulgar facilmente.
            </p>
          </div>

          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Sparkles size={24} />
            </div>
            <h3 className={styles.benefitTitle}>Espaço do Embaixador Dedicado</h3>
            <p className={styles.benefitDesc}>
              Acesso total ao portal ev.bryza.com.br para acompanhar suas métricas, clientes e extrato financeiro.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
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
