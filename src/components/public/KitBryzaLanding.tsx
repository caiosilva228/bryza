'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Flower2,
  FileText,
  Gift,
  HelpCircle,
  Leaf,
  LockKeyhole,
  MapPinCheck,
  MessageCircle,
  PackageCheck,
  BadgePercent,
  Play,
  Quote,
  ShieldCheck,
  Sparkles,
  Truck,
  WalletCards,
  X,
} from 'lucide-react';
import { benefits, faqs, kitItems, realDemonstrations, realTestimonials, steps } from './kit-bryza-content';
import styles from './KitBryzaSalesPage.module.css';
import type { AmbassadorPublicInfo } from './kit-bryza-types';

interface KitBryzaLandingProps {
  ambassador: AmbassadorPublicInfo;
  productAvailable: boolean;
  onOrder: () => void;
}

const benefitIcons = {
  sparkles: Sparkles,
  leaf: Leaf,
  flower: Flower2,
  shield: ShieldCheck,
};

function OrderButton({ onClick, inverse = false, children = 'Agendar meu pedido agora' }: {
  onClick: () => void;
  inverse?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" className={inverse ? styles.ctaInverse : styles.cta} onClick={onClick}>
      {children}<ArrowRight size={18} aria-hidden="true" />
    </button>
  );
}

function PlaidCloths({ large = false }: { large?: boolean }) {
  return (
    <div className={`${styles.plaidCloths} ${large ? styles.plaidClothsLarge : ''}`} role="img" aria-label="Dois Panos Premium Xadrez Bryza dobrados">
      <span /><span /><span />
    </div>
  );
}

const PRODUCT_SYSTEM_IMAGES: Record<string, { src: string; alt: string }> = {
  soap: {
    src: 'https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/product-images/prod_1784558898128_ep4ij.svg',
    alt: 'Galão de 5 litros do Sabão Líquido Concentrado Bryza',
  },
  softener: {
    src: 'https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/product-images/prod_1784558941028_r03eb.svg',
    alt: 'Galão de 5 litros do Amaciante Concentrado Microencapsulado Bryza',
  },
  cloths: {
    src: 'https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/product-images/prod_1784732736673_77ujv.svg',
    alt: 'Dois Panos Xadrez de Alta Absorção Bryza',
  },
};

function ProductVisual({ kind, customAlt }: { kind: (typeof kitItems)[number]['kind']; customAlt?: string }) {
  const prod = PRODUCT_SYSTEM_IMAGES[kind] || PRODUCT_SYSTEM_IMAGES.soap;
  return (
    <div className={styles.productCrop}>
      <Image
        src={prod.src}
        alt={customAlt || prod.alt}
        width={280}
        height={220}
        unoptimized
        style={{ objectFit: 'contain', width: 'auto', height: '100%', maxHeight: '220px' }}
      />
    </div>
  );
}

function AmbassadorAvatar({ photoPath, name, size = 56 }: { photoPath?: string | null; name: string; size?: number }) {
  const [hasError, setHasError] = useState(false);
  const initial = name && name.trim().length > 0 ? name.trim().charAt(0).toUpperCase() : 'B';

  if (photoPath && !hasError) {
    return (
      <Image
        src={photoPath}
        alt={name || 'Embaixador Bryza'}
        width={size}
        height={size}
        onError={() => setHasError(true)}
        unoptimized
        className={styles.referralAvatarImg}
        style={{ borderRadius: '50%', objectFit: 'cover' }}
      />
    );
  }

  return <span>{initial}</span>;
}

export function KitBryzaLanding({ ambassador, productAvailable, onOrder }: KitBryzaLandingProps) {
  const [openFaqs, setOpenFaqs] = useState<number[]>([0]);
  const [showSticky, setShowSticky] = useState(false);
  const [activeMedia, setActiveMedia] = useState<{ url: string; title: string; type: 'video' | 'image'; alt: string } | null>(null);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setOpenFaqs([]);
    }
  }, []);

  const toggleFaq = (index: number, faqId: string, question: string) => {
    setOpenFaqs((prev) => {
      const isCurrentlyOpen = prev.includes(index);
      if (isCurrentlyOpen) {
        return prev.filter((i) => i !== index);
      } else {
        if (typeof window !== 'undefined' && (window as unknown as { dataLayer?: Record<string, unknown>[] }).dataLayer) {
          (window as unknown as { dataLayer: Record<string, unknown>[] }).dataLayer.push({
            event: 'faq_opened',
            faq_id: faqId,
            faq_question: question,
            referral_code: ambassador?.referral_code,
          });
        }
        return [...prev, index];
      }
    });
  };

  const publishedDemos = realDemonstrations.filter((d) => d.isPublished);
  const featuredDemo = publishedDemos.find((d) => d.isFeatured) || publishedDemos[0];
  const galleryDemos = publishedDemos.filter((d) => d.id !== featuredDemo?.id);
  const publishedTestimonials = realTestimonials.filter((t) => t.authorized && t.isPublished);

  const hasAmbassadorName = Boolean(ambassador?.display_name && ambassador.display_name.trim().length > 0);
  const ambassadorName = hasAmbassadorName ? ambassador.display_name.trim() : '';
  const customMessage = ambassador?.custom_message?.trim() || null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeMedia) {
        setActiveMedia(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMedia]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting), { threshold: 0.08 });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#inicio">Ir direto para a oferta</a>
      <div className={styles.announcement}>
        <span className={styles.desktopAnnouncement}>Frete grátis nas regiões atendidas • Pagamento somente na entrega</span>
        <span className={styles.mobileAnnouncement}>Frete grátis • Pague na entrega</span>
      </div>

      <header className={styles.header}>
        <a href="#inicio" className={styles.brand} aria-label="Bryza — início">
          <Image
            src="/Logo Bryza.svg"
            alt="Bryza Logo"
            width={104}
            height={34}
            priority
          />
        </a>
        
        {ambassador && (
          <div className={styles.ambassadorBadge}>
            <div className={styles.ambassadorAvatar}>
              <AmbassadorAvatar photoPath={ambassador.photo_path} name={ambassadorName} size={26} />
            </div>
            <div className={styles.ambassadorMeta}>
              <small>Indicado por</small>
              <strong>{ambassadorName}</strong>
            </div>
          </div>
        )}
      </header>

      <main>
        <section id="inicio" ref={heroRef} className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <div className={styles.heroTags}>
                <span className={styles.tagKit}>KIT CASA PERFUMADA</span>
                <span className={styles.tagGift}>2 PANOS DE ALTA ABSORÇÃO</span>
              </div>

              <h1>10 litros para roupas <em className={styles.highlightText}>limpas, macias e perfumadas.</em></h1>

              <p className={`${styles.heroSubheadline} ${styles.desktopSubheadline}`}>
                {ambassador.display_name
                  ? `Sabão Líquido Concentrado 5L + Amaciante Microencapsulado 5L. Pela indicação de ${ambassador.display_name}, você ainda recebe 2 Panos Xadrez de Alta Absorção — 45 × 70 cm.`
                  : 'Sabão Líquido Concentrado 5L + Amaciante Microencapsulado 5L e mais 2 Panos Xadrez de Alta Absorção — 45 × 70 cm de presente.'}
              </p>

              <div className={styles.mobileSubheadlineGroup}>
                <p className={styles.mobileSubheadline}>
                  Sabão Concentrado 5L + Amaciante Microencapsulado 5L e 2 Panos Xadrez de Alta Absorção — 45 × 70 cm.
                </p>
              </div>

              <div className={styles.mobileProductBlock}>
                <div className={styles.mobileProductImageWrapper}>
                  <Image src="/hero-pv-mobile_11zon.webp" alt="Kit Bryza com Sabão Líquido, Amaciante de 5L e 2 Panos Xadrez de Alta Absorção" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'center center' }} />
                </div>
              </div>

              <div className={styles.heroOfferArea}>
                <div className={styles.heroPriceRow}>
                  <span className={styles.heroPriceLabel}>Valor do kit + brindes</span>
                  <s className={styles.heroPriceStrikethrough}>R$105,78</s>
                </div>
                
                <div className={styles.heroPriceMain}>
                  <span className={styles.heroPriceToday}>Hoje por</span>
                  <strong className={styles.heroPriceValue}>R$79,80</strong>
                  <span className={styles.heroLiterPrice}>
                    Menos de R$7,99 por litro
                  </span>
                </div>

                <div className={styles.heroGiftHighlight}>
                  <span>Você recebe <strong className={styles.heroGiftGreenText}>R$25,98 em brindes.</strong></span>
                  <small className={styles.heroGiftAuxText}>Cada Pano Xadrez de Alta Absorção custa em média R$12,99 nos supermercados.</small>
                </div>

                <div className={styles.heroCtaBlock}>
                  <button type="button" className={styles.heroCtaBtn} onClick={onOrder}>
                    <span>AGENDAR MEU PEDIDO</span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                  <div className={styles.heroSecurityNote}>
                    <LockKeyhole size={13} aria-hidden="true" />
                    <span>Você não paga nada antecipadamente.</span>
                  </div>
                </div>

                <div className={styles.heroTrustLine}>
                  <div className={styles.heroTrustItem}>
                    <Truck size={18} aria-hidden="true" />
                    <span>Frete grátis</span>
                  </div>
                  <div className={styles.heroTrustItem}>
                    <WalletCards size={18} aria-hidden="true" />
                    <span>Pagamento na entrega</span>
                  </div>
                  <div className={styles.heroTrustItem}>
                    <MessageCircle size={18} aria-hidden="true" />
                    <span>Confirmação pelo WhatsApp</span>
                  </div>
                </div>
              </div>

              <p className={styles.heroScarcity}>
                Brindes disponíveis conforme a quantidade destinada a cada campanha e rota de entrega.
              </p>
            </div>
          </div>

          <div className={styles.clothBadge}>
            <strong>2 PANOS XADREZ</strong>
            <span>ALTA ABSORÇÃO</span>
            <small>45 × 70 cm</small>
          </div>
        </section>

        {/* Secao 2: Confirmacao da indicacao */}
        <section id="indicacao" className={styles.referralSection}>
          <div className={styles.referralContainer}>
            <div className={styles.referralAvatar} aria-hidden="true">
              <AmbassadorAvatar photoPath={ambassador.photo_path} name={ambassadorName} size={56} />
            </div>

            <div className={styles.referralContent}>
              <span className={styles.referralEyebrow}>INDICAÇÃO BRYZA</span>
              <h2 className={styles.referralTitle}>
                {hasAmbassadorName
                  ? `${ambassadorName} compartilhou esta oferta com você.`
                  : 'Esta oferta foi compartilhada por um Embaixador Bryza.'}
              </h2>

              {customMessage && customMessage.length > 0 && (
                <blockquote className={styles.referralQuote}>
                  “{customMessage}”
                </blockquote>
              )}

              <p className={styles.referralText}>
                {hasAmbassadorName
                  ? 'Você está acessando o link correto da indicação. A confirmação do pedido, o atendimento e a entrega serão realizados diretamente pela equipe Bryza.'
                  : 'Você está acessando uma oferta oficial. A confirmação do pedido, o atendimento e a entrega serão realizados diretamente pela equipe Bryza.'}
              </p>

              <div className={styles.referralTrustLine}>
                <CheckCircle2 size={16} className={styles.trustCheckIcon} />
                <span>Indicação identificada • Atendimento oficial Bryza</span>
              </div>
            </div>

            <div className={styles.officialBadge}>
              <ShieldCheck size={22} className={styles.officialBadgeIcon} />
              <div>
                <strong>Atendimento Oficial</strong>
                <small>Equipe Bryza</small>
              </div>
            </div>
          </div>
        </section>

        {/* Secao 3: O que vem no Kit Bryza */}
        <section id="kit" className={styles.kitSection} aria-label="O que vem no Kit Bryza">
          <header className={styles.sectionIntro}>
            <span className={styles.sectionEyebrow}>O KIT COMPLETO</span>
            <h2>Tudo o que você recebe no Kit Bryza</h2>
            <p>
              Dois galões de 5 litros para cuidar das suas roupas e 2 Panos Xadrez de Alta Absorção para facilitar a limpeza da casa.
            </p>
          </header>

          <div role="list" className={styles.kitGrid}>
            {kitItems.map((item) => (
              <article
                key={item.title}
                role="listitem"
                className={item.kind === 'cloths' ? styles.giftCard : styles.productCard}
              >
                <ProductVisual kind={item.kind} customAlt={item.alt} />
                <div className={styles.itemCopy}>
                  <b className={`${styles.itemLabel} ${item.kind === 'cloths' ? styles.giftLabel : ''}`}>
                    {item.label}
                  </b>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <ul className={styles.itemFeatureList}>
                    {item.features.map((feature) => (
                      <li key={feature}>
                        <Check size={16} className={styles.checkIcon} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.kitClosing}>
            <h3>10 litros de produtos + 2 Panos Xadrez de Alta Absorção</h3>
            <p>Um kit completo para cuidar das roupas e facilitar a limpeza da casa.</p>
          </div>
        </section>

        {/* Secao 4: Valorizacao dos Panos de Alta Absorcao */}
        <section id="brinde" className={styles.giftValuationSection} aria-label="Valorização dos Panos de Alta Absorção">
          <div className={styles.giftValuationContainer}>
            <figure className={styles.giftValuationFigure}>
              <div className={styles.giftValuationImageCard}>
                <Image
                  src="https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/product-images/prod_1784732736673_77ujv.svg"
                  alt="Dois Panos Xadrez de Alta Absorção Bryza"
                  width={420}
                  height={320}
                  unoptimized
                  style={{ objectFit: 'contain', width: 'auto', height: '100%', maxHeight: '340px' }}
                />
              </div>
              <figcaption className={styles.giftValuationCaption}>
                <strong>2 Panos Xadrez de Alta Absorção</strong>
                <span>45 × 70 cm</span>
              </figcaption>
            </figure>

            <div className={styles.giftValuationContent}>
              <span className={styles.giftValuationEyebrow}>UM BRINDE QUE TEM VALOR REAL</span>
              <h2 className={styles.giftValuationTitle}>
                Você não recebe apenas dois panos. Você ganha R$25,98 em utilidade para a sua casa.
              </h2>
              <p className={styles.giftValuationLead}>
                Os 2 Panos Xadrez de Alta Absorção são grandes, resistentes e úteis para a rotina de limpeza. No mercado, produtos desse padrão custam em média R$12,99 cada.
              </p>

              <ul className={styles.giftAttributesList}>
                <li>
                  <Check size={18} className={styles.giftCheckIcon} />
                  <span>Tamanho grande: 45 × 70 cm</span>
                </li>
                <li>
                  <Check size={18} className={styles.giftCheckIcon} />
                  <span>Alta capacidade de absorção</span>
                </li>
                <li>
                  <Check size={18} className={styles.giftCheckIcon} />
                  <span>Tecido resistente para o uso diário</span>
                </li>
                <li>
                  <Check size={18} className={styles.giftCheckIcon} />
                  <span>Laváveis e reutilizáveis</span>
                </li>
              </ul>

              <div className={styles.giftValueCard}>
                <div className={styles.giftValueRow}>
                  <span>1 Pano Xadrez de Alta Absorção</span>
                  <strong>R$12,99</strong>
                </div>
                <div className={styles.giftValueRow}>
                  <span>2 Panos Xadrez de Alta Absorção</span>
                  <strong>R$25,98</strong>
                </div>
                <div className={`${styles.giftValueRow} ${styles.giftValueHighlight}`}>
                  <span>No Kit Bryza</span>
                  <strong className={styles.giftBadgeFree}>GRÁTIS</strong>
                </div>
              </div>

              <p className={styles.giftValuationClosing}>
                Você economiza <strong>mais de R$20</strong> e ainda recebe dois itens realmente úteis para a limpeza da casa.
              </p>
            </div>
          </div>
        </section>

        {/* Secao 5: Por que essa oferta vale a pena */}
        <section id="motivos" className={styles.reasonsSection} aria-label="Por que essa oferta vale a pena">
          <header className={styles.reasonsHeader}>
            <span className={styles.reasonsEyebrow}>UMA ESCOLHA INTELIGENTE</span>
            <h2 className={styles.reasonsTitle}>Mais produto, mais economia e muito mais comodidade.</h2>
            <p className={styles.reasonsLead}>
              O Kit Bryza foi pensado para entregar quantidade, praticidade e segurança em uma única compra.
            </p>
          </header>

          <div role="list" className={styles.reasonsGrid}>
            <article role="listitem" className={styles.reasonCard}>
              <div className={styles.reasonIconBox} aria-hidden="true">
                <PackageCheck size={26} className={styles.reasonIcon} />
              </div>
              <div className={styles.reasonContent}>
                <span className={styles.reasonCategory}>MAIS PRODUTO</span>
                <h3>10 litros no total</h3>
                <p>
                  Você recebe um galão de 5 litros de Sabão Líquido Concentrado e um galão de 5 litros de Amaciante Microencapsulado.
                </p>
              </div>
            </article>

            <article role="listitem" className={styles.reasonCard}>
              <div className={styles.reasonIconBox} aria-hidden="true">
                <BadgePercent size={26} className={styles.reasonIcon} />
              </div>
              <div className={styles.reasonContent}>
                <span className={styles.reasonCategory}>MAIS ECONOMIA</span>
                <h3>Menos de R$7,99 por litro</h3>
                <p>
                  Você garante dois produtos de 5 litros e ainda recebe dois Panos Xadrez de Alta Absorção de presente.
                </p>
              </div>
            </article>

            <article role="listitem" className={styles.reasonCard}>
              <div className={styles.reasonIconBox} aria-hidden="true">
                <Truck size={26} className={styles.reasonIcon} />
              </div>
              <div className={styles.reasonContent}>
                <span className={styles.reasonCategory}>MAIS PRATICIDADE</span>
                <h3>Entrega na sua casa</h3>
                <p>
                  Você agenda o pedido pelo celular e a equipe Bryza confirma a disponibilidade da rota pelo WhatsApp.
                </p>
              </div>
            </article>

            <article role="listitem" className={styles.reasonCard}>
              <div className={styles.reasonIconBox} aria-hidden="true">
                <ShieldCheck size={26} className={styles.reasonIcon} />
              </div>
              <div className={styles.reasonContent}>
                <span className={styles.reasonCategory}>MENOS RISCO</span>
                <h3>Pagamento somente na entrega</h3>
                <p>
                  Você não precisa realizar nenhum pagamento antecipado. O pagamento acontece quando o pedido é entregue.
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* Secao 6: Demonstracao e Prova Real */}
        {publishedDemos.length > 0 || publishedTestimonials.length > 0 ? (
          <section id="demonstracao" className={styles.proofSection} aria-label="Demonstração e Prova Real">
            <header className={styles.sectionIntro}>
              <span className={styles.sectionEyebrow}>VEJA A BRYZA NA PRÁTICA</span>
              <h2>Produtos reais, uso real e entregas de verdade.</h2>
              <p>
                Conheça o Kit Bryza em uso, veja demonstrações dos produtos e acompanhe experiências reais de quem já recebeu.
              </p>
            </header>

            {/* Bloco 1: Destaque de Video & Galeria de Provas Reais */}
            {publishedDemos.length > 0 && (
              <div className={styles.proofShowcase}>
                {featuredDemo && (
                  <article className={styles.featuredVideoCard}>
                    <div className={styles.videoPlayerWrapper}>
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        poster={featuredDemo.posterUrl}
                        className={styles.videoElement}
                        aria-label={`Vídeo: ${featuredDemo.title}`}
                      >
                        <source src={featuredDemo.mediaUrl} type="video/mp4" />
                        Seu navegador não suporta a exibição deste vídeo.
                      </video>
                    </div>
                    <div className={styles.featuredVideoMeta}>
                      <h3>{featuredDemo.title}</h3>
                      <p>{featuredDemo.description}</p>
                    </div>
                  </article>
                )}

                {galleryDemos.length > 0 && (
                  <div className={styles.proofGalleryBlock}>
                    <header className={styles.blockIntro}>
                      <h3>Da preparação até a entrega</h3>
                      <p>Registros reais da rotina da Bryza e dos pedidos entregues aos clientes.</p>
                    </header>
                    <div role="list" className={styles.proofGalleryGrid}>
                      {galleryDemos.map((demo) => (
                        <article
                          key={demo.id}
                          role="listitem"
                          className={styles.proofMediaCard}
                          onClick={() =>
                            setActiveMedia({
                              url: demo.mediaUrl,
                              title: demo.title,
                              type: demo.type,
                              alt: demo.alt,
                            })
                          }
                        >
                          <div className={styles.proofMediaThumbnail}>
                            <Image
                              src={demo.posterUrl}
                              alt={demo.alt}
                              width={320}
                              height={220}
                              unoptimized
                              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                            />
                            {demo.type === 'video' && (
                              <span className={styles.playBadge} aria-hidden="true">
                                <Play size={18} />
                              </span>
                            )}
                          </div>
                          <div className={styles.proofMediaCaption}>
                            <p>{demo.caption}</p>
                            {demo.location && <small>{demo.location}</small>}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bloco 3: Depoimentos Reais */}
            {publishedTestimonials.length > 0 && (
              <div className={styles.testimonialsBlock}>
                <header className={styles.blockIntro}>
                  <h3>O que os clientes estão dizendo</h3>
                  <p>Experiências compartilhadas por pessoas que já receberam ou testaram os produtos Bryza.</p>
                </header>
                <div role="list" className={styles.testimonialsGrid}>
                  {publishedTestimonials.map((item) => (
                    <article key={item.id} role="listitem" className={styles.testimonialCard}>
                      <Quote size={24} className={styles.quoteIcon} aria-hidden="true" />
                      <p className={styles.testimonialText}>“{item.text}”</p>
                      <footer className={styles.testimonialMeta}>
                        <div className={styles.testimonialAvatar} aria-hidden="true">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.testimonialAuthor}>
                          <strong>{item.name}</strong>
                          <span>{item.location} • Cliente Bryza</span>
                        </div>
                      </footer>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* Lightbox Acessivel */}
            {activeMedia && (
              <div
                className={styles.lightboxOverlay}
                role="dialog"
                aria-modal="true"
                aria-label={activeMedia.title}
                onClick={() => setActiveMedia(null)}
              >
                <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.lightboxCloseBtn}
                    onClick={() => setActiveMedia(null)}
                    aria-label="Fechar visualização de mídia"
                  >
                    <X size={24} />
                  </button>

                  {activeMedia.type === 'video' ? (
                    <video controls autoPlay playsInline className={styles.lightboxVideo}>
                      <source src={activeMedia.url} type="video/mp4" />
                    </video>
                  ) : (
                    <div className={styles.lightboxImageWrapper}>
                      <Image
                        src={activeMedia.url}
                        alt={activeMedia.alt}
                        width={800}
                        height={600}
                        unoptimized
                        style={{ objectFit: 'contain', width: '100%', height: 'auto', maxHeight: '80vh' }}
                      />
                    </div>
                  )}
                  <p className={styles.lightboxCaption}>{activeMedia.title}</p>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {/* Secao 7: Comparacao de valor */}
        <section id="oferta" className={styles.comparisonSection} aria-label="Comparação de valor e Oferta Especial">
          <div className={styles.comparisonContainer}>
            <div className={styles.comparisonCopyBlock}>
              <span className={styles.comparisonEyebrow}>VEJA QUANTO VOCÊ RECEBE</span>
              <h2>Um kit completo com R$105,78 em valor.</h2>
              <p className={styles.comparisonLead}>
                Veja quanto custaria levar cada item separadamente e compare com o valor especial do Kit Bryza.
              </p>
              <p className={styles.comparisonBody}>
                Ao adquirir o Kit Bryza, você garante 10 litros de produtos concentrados de altíssima qualidade pelo preço justo de fábrica e recebe de presente 2 Panos Xadrez de Alta Absorção para completar o cuidado da sua casa, sem custo de entrega.
              </p>
            </div>

            <div className={styles.comparisonOfferCard}>
              <dl className={styles.comparisonList}>
                <div className={styles.comparisonItemRow}>
                  <dt className={styles.comparisonItemMeta}>
                    <strong className={styles.comparisonItemName}>Sabão Líquido Concentrado Bryza — 5L</strong>
                    <span className={styles.comparisonItemDetail}>5 litros</span>
                  </dt>
                  <dd className={styles.comparisonItemPrice}>R$39,90</dd>
                </div>

                <div className={styles.comparisonItemRow}>
                  <dt className={styles.comparisonItemMeta}>
                    <strong className={styles.comparisonItemName}>Amaciante Concentrado Microencapsulado Bryza — 5L</strong>
                    <span className={styles.comparisonItemDetail}>5 litros</span>
                  </dt>
                  <dd className={styles.comparisonItemPrice}>R$39,90</dd>
                </div>

                <div className={styles.comparisonItemRow}>
                  <dt className={styles.comparisonItemMeta}>
                    <div className={styles.comparisonItemNameGroup}>
                      <strong className={styles.comparisonItemName}>2 Panos Xadrez de Alta Absorção — 45 × 70 cm</strong>
                      <span className={styles.giftTagBadge}>BRINDE</span>
                    </div>
                    <span className={styles.comparisonItemDetail}>45 × 70 cm</span>
                  </dt>
                  <dd className={styles.comparisonItemPrice}>R$25,98</dd>
                </div>

                <div className={styles.comparisonItemRow}>
                  <dt className={styles.comparisonItemMeta}>
                    <strong className={styles.comparisonItemName}>Entrega nas regiões atendidas</strong>
                    <span className={styles.comparisonItemDetail}>R$0 antecipado</span>
                  </dt>
                  <dd className={styles.comparisonItemPrice}>
                    <strong className={styles.freeDeliveryBadge}>GRÁTIS</strong>
                  </dd>
                </div>
              </dl>

              <div className={styles.comparisonDivider} />

              <div className={styles.comparisonSummaryBlock}>
                <div className={styles.comparisonRowTotalStruck}>
                  <span>Valor total dos produtos e brindes</span>
                  <s aria-label="Valor anterior: cento e cinco reais e setenta e oito centavos">R$105,78</s>
                </div>

                <div className={styles.comparisonRowMainPrice}>
                  <div className={styles.comparisonMainPriceMeta}>
                    <span>Valor especial do Kit Bryza</span>
                    <strong aria-label="Valor atual: setenta e nove reais e oitenta centavos">R$79,80</strong>
                    <span className={styles.costPerLiterBadge}>Menos de R$7,99 por litro</span>
                  </div>
                </div>

                <div className={styles.comparisonSavingsBox}>
                  <strong>Você recebe R$25,98 em brindes.</strong>
                  <p>Os 2 Panos Xadrez de Alta Absorção vão de presente na compra do kit completo.</p>
                </div>

                <button type="button" className={styles.comparisonCtaBtn} onClick={onOrder}>
                  <span>QUERO AGENDAR MEU KIT BRYZA</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>

                <p className={styles.noPrepayNote}>Você não paga nada antecipadamente.</p>
                <p className={styles.securityNote}>Frete grátis nas regiões atendidas • Pagamento somente na entrega</p>
                <p className={styles.scarcityNote}>
                  Os brindes estão disponíveis conforme a quantidade destinada a cada campanha e rota de entrega.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Secao 8: Como funciona o pedido */}
        <section id="como-funciona" className={styles.stepsSection} aria-label="Como funciona o pedido">
          <header className={styles.sectionIntro}>
            <span className={styles.sectionEyebrow}>PEDIR É MUITO SIMPLES</span>
            <h2>Agende agora e pague somente quando receber.</h2>
            <p>
              Você informa seus dados, a Bryza confirma a disponibilidade da rota e o pagamento é realizado somente na entrega.
            </p>
          </header>

          <ol role="list" className={styles.stepsGrid}>
            <li role="listitem" className={styles.stepItem}>
              <article className={styles.stepCard}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNumberBadge}>01</span>
                  <div className={styles.stepIconBox} aria-hidden="true">
                    <ClipboardList size={24} className={styles.stepIcon} />
                  </div>
                </div>
                <span className={styles.stepCategory}>AGENDAMENTO</span>
                <h3>Agende seu pedido</h3>
                <p className={styles.stepDescription}>
                  Informe seu nome, WhatsApp e endereço para solicitar o Kit Bryza.
                </p>
                <small className={styles.stepAuxiliary}>
                  O agendamento leva poucos minutos e não exige pagamento antecipado.
                </small>
              </article>
            </li>

            <li role="listitem" className={styles.stepItem}>
              <article className={styles.stepCard}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNumberBadge}>02</span>
                  <div className={styles.stepIconBox} aria-hidden="true">
                    <MapPinCheck size={24} className={styles.stepIcon} />
                  </div>
                </div>
                <span className={styles.stepCategory}>CONFIRMAÇÃO</span>
                <h3>A Bryza confirma sua rota</h3>
                <p className={styles.stepDescription}>
                  Nossa equipe verifica a disponibilidade de entrega na sua região e confirma os detalhes pelo WhatsApp.
                </p>
                <small className={styles.stepAuxiliary}>
                  O pedido só será considerado confirmado após o contato da equipe Bryza.
                </small>
              </article>
            </li>

            <li role="listitem" className={styles.stepItem}>
              <article className={styles.stepCard}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNumberBadge}>03</span>
                  <div className={styles.stepIconBox} aria-hidden="true">
                    <Truck size={24} className={styles.stepIcon} />
                  </div>
                </div>
                <span className={styles.stepCategory}>ENTREGA</span>
                <h3>Receba e pague</h3>
                <p className={styles.stepDescription}>
                  Seu Kit Bryza é entregue no endereço confirmado e você realiza o pagamento somente quando receber.
                </p>
                <small className={styles.stepAuxiliary}>
                  Sem pagamento antecipado e sem cobrança antes da entrega.
                </small>
              </article>
            </li>
          </ol>

          <div className={styles.stepsSecurityBox}>
            <div className={styles.stepsSecurityTextGroup}>
              <ShieldCheck size={28} className={styles.stepsSecurityIcon} aria-hidden="true" />
              <div>
                <strong>Você não precisa pagar nada para solicitar o agendamento.</strong>
                <p>A equipe Bryza confirmará sua rota e os detalhes da entrega pelo WhatsApp.</p>
              </div>
            </div>
            <ul className={styles.stepsSecurityBadges}>
              <li>
                <Check size={16} className={styles.stepCheckIcon} aria-hidden="true" />
                <span>Nenhum pagamento antecipado</span>
              </li>
              <li>
                <Check size={16} className={styles.stepCheckIcon} aria-hidden="true" />
                <span>Confirmação pelo WhatsApp</span>
              </li>
              <li>
                <Check size={16} className={styles.stepCheckIcon} aria-hidden="true" />
                <span>Pagamento somente na entrega</span>
              </li>
            </ul>
          </div>

          <div className={styles.stepsCtaBlock}>
            <button type="button" className={styles.stepsCtaBtn} onClick={onOrder}>
              <span>AGENDAR MEU KIT BRYZA</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <p className={styles.stepsCtaNote}>
              Preencha seus dados agora. A equipe confirmará a disponibilidade da sua rota pelo WhatsApp.
            </p>
          </div>
        </section>

        {/* Secao 9: Seguranca e tranquilidade */}
        <section id="seguranca" className={styles.securitySection} aria-label="Segurança e tranquilidade">
          <header className={styles.sectionIntro}>
            <span className={styles.sectionEyebrow}>PEÇA COM TRANQUILIDADE</span>
            <h2>Seu pedido é simples, seguro e sem pagamento antecipado.</h2>
            <p>
              Você solicita o agendamento, recebe a confirmação pelo WhatsApp e paga somente quando o Kit Bryza chegar.
            </p>
          </header>

          <ul role="list" className={styles.securityGrid}>
            <li role="listitem" className={styles.securityItem}>
              <div className={styles.securityIconBox} aria-hidden="true">
                <WalletCards size={22} className={styles.securityIcon} />
              </div>
              <div className={styles.securityContent}>
                <h3>Nenhum pagamento antecipado</h3>
                <p>Você não precisa pagar nada para solicitar o agendamento.</p>
              </div>
            </li>

            <li role="listitem" className={styles.securityItem}>
              <div className={styles.securityIconBox} aria-hidden="true">
                <PackageCheck size={22} className={styles.securityIcon} />
              </div>
              <div className={styles.securityContent}>
                <h3>Pagamento somente na entrega</h3>
                <p>Você realiza o pagamento apenas quando receber o Kit Bryza.</p>
              </div>
            </li>

            <li role="listitem" className={styles.securityItem}>
              <div className={styles.securityIconBox} aria-hidden="true">
                <MessageCircle size={22} className={styles.securityIcon} />
              </div>
              <div className={styles.securityContent}>
                <h3>Confirmação pelo WhatsApp</h3>
                <p>A equipe Bryza confirma a rota e os detalhes diretamente com você.</p>
              </div>
            </li>

            <li role="listitem" className={styles.securityItem}>
              <div className={styles.securityIconBox} aria-hidden="true">
                <Truck size={22} className={styles.securityIcon} />
              </div>
              <div className={styles.securityContent}>
                <h3>Frete grátis nas regiões atendidas</h3>
                <p>Não há cobrança de entrega nas rotas participantes da campanha.</p>
              </div>
            </li>

            <li role="listitem" className={styles.securityItem}>
              <div className={styles.securityIconBox} aria-hidden="true">
                <FileText size={22} className={styles.securityIcon} />
              </div>
              <div className={styles.securityContent}>
                <h3>Sem assinatura</h3>
                <p>A compra é única e não gera nenhum plano ou compromisso mensal.</p>
              </div>
            </li>

            <li role="listitem" className={styles.securityItem}>
              <div className={styles.securityIconBox} aria-hidden="true">
                <ShieldCheck size={22} className={styles.securityIcon} />
              </div>
              <div className={styles.securityContent}>
                <h3>Sem cobrança recorrente</h3>
                <p>Não existe renovação automática ou cobrança futura vinculada ao pedido.</p>
              </div>
            </li>
          </ul>

          <div className={styles.securityFooterBanner}>
            <strong>Você solicita agora e só paga quando receber.</strong>
            <p>A equipe Bryza confirmará a disponibilidade da rota e os detalhes da entrega pelo WhatsApp.</p>
            <a href="#duvidas" className={styles.faqAnchorLink}>
              <span>Ficou com alguma dúvida? Veja as respostas abaixo.</span>
            </a>
          </div>
        </section>

        {/* Secao 10: Perguntas frequentes */}
        <section id="duvidas" className={styles.faqSection} aria-label="Perguntas frequentes">
          <header className={styles.sectionIntro}>
            <span className={styles.sectionEyebrow}>AINDA FICOU COM ALGUMA DÚVIDA?</span>
            <h2>Tudo o que você precisa saber antes de pedir.</h2>
            <p>
              Confira as respostas para as dúvidas mais comuns sobre o Kit Bryza, os brindes, a entrega e o pagamento.
            </p>
          </header>

          <div className={styles.faqContainer}>
            {faqs.map((faq, index) => {
              const isOpen = openFaqs.includes(index);
              const isLast = index === faqs.length - 1;

              return (
                <article key={faq.id || index} className={`${styles.faqArticle} ${isLast ? styles.faqArticleLast : ''}`}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${index}`}
                      id={`faq-question-${index}`}
                      className={styles.faqTriggerBtn}
                      onClick={() => toggleFaq(index, faq.id, faq.question)}
                    >
                      <span className={styles.faqQuestionText}>{faq.question}</span>
                      <ChevronDown
                        size={20}
                        className={`${styles.faqChevronIcon} ${isOpen ? styles.faqChevronOpen : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                  </h3>
                  <div
                    id={`faq-answer-${index}`}
                    role="region"
                    aria-labelledby={`faq-question-${index}`}
                    hidden={!isOpen}
                    className={styles.faqAnswerWrapper}
                  >
                    <div className={styles.faqAnswerInner}>
                      {index === 3 ? (
                        <p>
                          Não. Você não precisa realizar nenhum pagamento para solicitar o agendamento. O pagamento acontece{' '}
                          <strong className={styles.faqHighlightText}>somente quando o Kit Bryza for entregue</strong>.
                        </p>
                      ) : (
                        <p>{faq.answer}</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Secao 11: CTA Final */}
        <section id="oferta-final" className={styles.finalCtaSection} aria-label="Garanta seu Kit Bryza">
          <div className={styles.finalCtaInner}>
            <div className={styles.finalCtaCopyBlock}>
              <span className={styles.finalCtaEyebrow}>SEU KIT BRYZA ESTÁ A UM PASSO</span>
              <h2 className={styles.finalCtaTitle}>
                Garanta 10 litros de produtos Bryza e leve 2 Panos de Alta Absorção de presente.
              </h2>
              <p className={styles.finalCtaSupportText}>
                Receba o Sabão Líquido Concentrado 5L, o Amaciante Microencapsulado 5L e 2 Panos Xadrez de Alta Absorção — 45 × 70 cm.
              </p>

              {/* Bloco de imagem no mobile */}
              <figure className={styles.finalCtaMobileMediaBlock}>
                <Image
                  src="/hero-products.webp"
                  alt="Kit Bryza com Sabão Líquido 5L, Amaciante 5L e dois Panos Xadrez de Alta Absorção"
                  width={340}
                  height={258}
                  className={styles.finalCtaImage}
                />
                <figcaption className={styles.finalCtaImageCaption}>
                  2 Panos Xadrez de Alta Absorção — 45 × 70 cm (BRINDE)
                </figcaption>
              </figure>

              <ul role="list" className={styles.finalCtaBenefitsGrid}>
                <li>
                  <Check size={18} className={styles.finalCheckIcon} aria-hidden="true" />
                  <span>10 litros de produtos</span>
                </li>
                <li>
                  <Check size={18} className={styles.finalCheckIcon} aria-hidden="true" />
                  <span>2 Panos Xadrez de Alta Absorção</span>
                </li>
                <li>
                  <Check size={18} className={styles.finalCheckIcon} aria-hidden="true" />
                  <span>Frete grátis nas regiões atendidas</span>
                </li>
                <li>
                  <Check size={18} className={styles.finalCheckIcon} aria-hidden="true" />
                  <span>Pagamento somente na entrega</span>
                </li>
              </ul>

              <div className={styles.finalPriceBox}>
                <div className={styles.finalPriceHeader}>
                  <span className={styles.finalPriceLabel}>Kit completo</span>
                  <strong className={styles.finalMainPrice}>R$ 79,80</strong>
                  <span className={styles.finalLiterPrice}>Menos de R$7,99 por litro</span>
                </div>
                <div className={styles.finalGiftBanner}>
                  <strong>Você recebe R$25,98 em brindes.</strong>
                  <span>Os dois panos vão de presente na compra do kit completo.</span>
                </div>
              </div>

              <div className={styles.finalCtaActionGroup}>
                <button
                  type="button"
                  className={styles.finalCtaSubmitBtn}
                  onClick={() => {
                    if (typeof window !== 'undefined' && (window as unknown as { dataLayer?: Record<string, unknown>[] }).dataLayer) {
                      (window as unknown as { dataLayer: Record<string, unknown>[] }).dataLayer.push({
                        event: 'final_cta_clicked',
                        referral_code: ambassador?.referral_code,
                        ambassador_name: ambassador?.display_name,
                        section: 'final_cta',
                        offer_price: 79.80,
                      });
                    }
                    onOrder();
                  }}
                >
                  <span>AGENDAR MEU PEDIDO AGORA</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>

                <div className={styles.finalSecurityNote}>
                  <LockKeyhole size={14} aria-hidden="true" />
                  <span>Você não paga nada antecipadamente.</span>
                </div>
                <p className={styles.finalTeamNote}>
                  A equipe Bryza verificará a disponibilidade da sua rota e confirmará os detalhes pelo WhatsApp.
                </p>
                <p className={styles.finalScarcityNote}>
                  Os brindes estão disponíveis conforme a quantidade destinada a cada campanha e rota de entrega.
                </p>
              </div>
            </div>

            {/* Imagem Desktop */}
            <div className={styles.finalCtaDesktopMediaBlock}>
              <figure className={styles.finalMediaFigure}>
                <Image
                  src="/hero-products.webp"
                  alt="Kit Bryza com Sabão Líquido 5L, Amaciante 5L e dois Panos Xadrez de Alta Absorção"
                  width={480}
                  height={365}
                  priority
                  className={styles.finalCtaDesktopImage}
                />
                <figcaption className={styles.finalCtaDesktopCaption}>
                  <strong>2 Panos Xadrez de Alta Absorção</strong>
                  <small>45 × 70 cm — Presente exclusivo</small>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>
      </main>

      {/* Secao 12: Footer */}
      <footer className={styles.footerSection} aria-label="Rodapé institucional Bryza">
        <div className={styles.footerInner}>
          <div className={styles.footerMainGrid}>
            {/* Coluna 1 — Marca */}
            <div className={styles.footerBrandCol}>
              <a href="#inicio" className={styles.footerBrandLogo} aria-label="Bryza — início">
                <Image
                  src="/Logo Bryza.svg"
                  alt="Bryza — O perfume que anuncia a presença."
                  width={145}
                  height={46}
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </a>
              <p className={styles.footerSlogan}>O perfume que anuncia a presença.</p>
              <p className={styles.footerDescription}>
                Produtos para cuidar das roupas e da casa, com qualidade, praticidade e atendimento direto da equipe Bryza.
              </p>
            </div>

            {/* Coluna 2 — Atendimento */}
            <div className={styles.footerCol}>
              <h3 className={styles.footerColTitle}>Atendimento</h3>
              <ul role="list" className={styles.footerNavList}>
                <li>
                  <a
                    href={`https://wa.me/5561999999999?text=${encodeURIComponent('Olá, estou na página do Kit Bryza e preciso de ajuda com meu pedido.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.footerWhatsappLink}
                    onClick={() => {
                      if (typeof window !== 'undefined' && (window as unknown as { dataLayer?: Record<string, unknown>[] }).dataLayer) {
                        (window as unknown as { dataLayer: Record<string, unknown>[] }).dataLayer.push({
                          event: 'footer_link_clicked',
                          link_type: 'whatsapp',
                          destination: 'https://wa.me/...',
                          referral_code: ambassador?.referral_code,
                        });
                      }
                    }}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                    <span>Falar com a equipe Bryza</span>
                  </a>
                </li>
                <li className={styles.footerMetaItem}>
                  <small>Horário de atendimento:</small>
                  <span>Segunda a Sexta, das 08h às 18h</span>
                </li>
                <li className={styles.footerMetaItem}>
                  <small>Regiões atendidas:</small>
                  <span>Consulte a disponibilidade da rota pelo WhatsApp.</span>
                </li>
              </ul>
            </div>

            {/* Coluna 3 — Informações */}
            <div className={styles.footerCol}>
              <h3 className={styles.footerColTitle}>Informações</h3>
              <nav aria-label="Links institucionais do rodapé">
                <ul role="list" className={styles.footerNavList}>
                  <li><a href="#kit">O que vem no Kit Bryza</a></li>
                  <li><a href="#como-funciona">Como funciona o pedido</a></li>
                  <li><a href="#duvidas">Perguntas frequentes</a></li>
                  <li><a href="/privacidade">Política de Privacidade</a></li>
                  <li><a href="/termos">Termos de Uso</a></li>
                  <li><a href="/politica-de-entrega">Política de Entrega</a></li>
                </ul>
              </nav>
            </div>

            {/* Coluna 4 — Dados da Empresa */}
            <div className={styles.footerCol}>
              <h3 className={styles.footerColTitle}>Bryza</h3>
              <address className={styles.footerAddressBlock}>
                <p>Atendimento direto em Cidade Ocidental e regiões atendidas pelas rotas Bryza.</p>
                <p style={{ marginTop: '8px', opacity: 0.8 }}>Pagamento somente no ato da entrega.</p>
              </address>
            </div>
          </div>

          {/* Aviso sobre o programa de indicação */}
          <div className={styles.footerReferralNotice}>
            <p>
              Esta página pode ser acessada por meio do link de um Embaixador Bryza. A indicação não altera o preço pago pelo cliente.
            </p>
            <p>
              O atendimento, a confirmação do pedido e a entrega são realizados diretamente pela equipe Bryza.
            </p>
          </div>

          {/* Área Inferior do Footer */}
          <div className={styles.footerBottomBar}>
            <div className={styles.footerCopyright}>
              <span>© {new Date().getFullYear()} Bryza. Todos os direitos reservados.</span>
              {ambassador?.referral_code && (
                <span className={styles.footerRefTag}>
                  • Indicação {ambassador.referral_code.toUpperCase()}
                </span>
              )}
            </div>

            <div className={styles.footerLegalLinks}>
              <a href="/privacidade">Política de Privacidade</a>
              <span aria-hidden="true">•</span>
              <a href="/termos">Termos de Uso</a>
              <span aria-hidden="true">•</span>
              <a href="/politica-de-entrega">Política de Entrega</a>
            </div>
          </div>

          <div className={styles.footerLegalDisclaimer}>
            <small>
              Compra sujeita à confirmação da rota de entrega. Os produtos e condições apresentados nesta página podem estar disponíveis apenas nas regiões participantes.
            </small>
          </div>
        </div>
      </footer>

      {!productAvailable && <div className={styles.unavailable}><PackageCheck /><div><strong>Oferta temporariamente indisponível</strong><span>Fale com a equipe Bryza para receber ajuda.</span></div></div>}
      {productAvailable && (
        <div className={`${styles.mobileSticky} ${showSticky ? styles.mobileStickyVisible : ''}`}>
          <div>
            <span>Kit completo</span>
            <strong>R$ 79,80</strong>
          </div>
          <button type="button" onClick={onOrder}>
            AGENDAR
          </button>
        </div>
      )}
    </div>
  );
}
