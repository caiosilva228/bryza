import type { Metadata } from 'next';
import Image from 'next/image';
import ZeloLeadForm from './ZeloLeadForm';
import styles from './zelo-lancamento.module.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://bryza.com.br'),
  title: 'Zelo | Entre na lista de lançamento',
  description:
    'Cadastre seu nome e WhatsApp para receber uma oferta especial do lançamento do Zelo, o limpador de tênis a seco da Bryza.',
  alternates: {
    canonical: 'https://bryza.com.br/zelo-lancamento',
  },
  openGraph: {
    title: 'Zelo | Oferta especial de lançamento',
    description:
      'Os 100 primeiros da lista terão acesso a uma condição especial no lançamento do Zelo.',
    url: 'https://bryza.com.br/zelo-lancamento',
    siteName: 'Bryza',
    type: 'website',
    images: [
      {
        url: '/zelo-produto.webp',
        width: 969,
        height: 1623,
        alt: 'Zelo Foam Cleaner, limpador de tênis',
      },
    ],
  },
};

export default function ZeloLancamentoPage() {
  const whatsappGroupUrl = process.env.NEXT_PUBLIC_ZELO_WHATSAPP_GROUP_URL;

  return (
    <main className={styles.page}>
      <div className={styles.ambientLight} aria-hidden="true" />

      <div className={styles.shell}>
        <header className={styles.topbar}>
          <a className={styles.brand} href="/" aria-label="Bryza — início">
            <span className={styles.brandMark} aria-hidden="true">
              B
            </span>
            <span className={styles.brandName}>BRYZA</span>
          </a>

          <p className={styles.topbarLabel}>
            <span className={styles.liveDot} aria-hidden="true" />
            Pré-lançamento Zelo
          </p>
        </header>

        <div className={styles.layout}>
          <section className={styles.stage} aria-labelledby="zelo-title">
            <div className={styles.stageGrid} aria-hidden="true" />

            <div className={styles.copy}>
              <p className={styles.eyebrow}>
                <span className={styles.eyebrowLine} aria-hidden="true" />
                Cuidado inteligente para o seu tênis
              </p>

              <h1 id="zelo-title" className={styles.title}>
                Tênis limpo.
                <br />
                <span>Sem lavar.</span>
              </h1>

              <p className={styles.lede}>
                Conheça o Zelo, o limpador de tênis a seco que remove a sujeira
                em poucos minutos — com praticidade e resultado imediato.
              </p>

              <div className={styles.scarcity}>
                <div className={styles.scarcityNumber}>100</div>
                <div className={styles.scarcityCopy}>
                  <strong>primeiros da lista</strong>
                  <span>recebem acesso à oferta especial de lançamento.</span>
                </div>
              </div>

              <a className={styles.primaryCta} href="#cadastro">
                Quero entrar na lista
                <span aria-hidden="true">↘</span>
              </a>
            </div>

            <div className={styles.productImageWrap} aria-hidden="true">
              <Image
                className={styles.productImage}
                src="/zelo-produto.webp"
                alt=""
                fill
                sizes="(max-width: 980px) 90vw, 44vw"
                quality={82}
                fetchPriority="high"
              />
            </div>

            <div className={styles.stageFooter}>
              <span>ZELO FOAM CLEANER</span>
              <span className={styles.stageFooterRule} aria-hidden="true" />
              <span>LIMPEZA RÁPIDA · RESULTADO IMEDIATO</span>
            </div>
          </section>

          <section className={styles.signup} id="cadastro" aria-labelledby="signup-title">
            <div className={styles.signupHeader}>
              <p className={styles.signupKicker}>Lista de acesso antecipado</p>
              <h2 id="signup-title">Garanta sua oferta.</h2>
              <p>
                Deixe seu nome e WhatsApp. Quando o Zelo for lançado, você
                recebe a condição especial reservada para quem está nesta lista.
              </p>
            </div>

            <ZeloLeadForm whatsappGroupUrl={whatsappGroupUrl} />
          </section>
        </div>

        <footer className={styles.footer}>
          <span>Zelo by Bryza</span>
          <span>Praticidade que valoriza.</span>
        </footer>
      </div>
    </main>
  );
}
