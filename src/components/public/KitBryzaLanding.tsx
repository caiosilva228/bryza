'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Flower2,
  Gift,
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
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showSticky, setShowSticky] = useState(false);
  const [activeMedia, setActiveMedia] = useState<{ url: string; title: string; type: 'video' | 'image'; alt: string } | null>(null);
  const heroRef = useRef<HTMLElement>(null);

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
      <header className={styles.header}>
        <a href="#inicio" className={styles.brand} aria-label="Bryza — início">
          <Image src="/Logo Bryza.svg" alt="Bryza" width={135} height={44} priority />
        </a>
        <div className={styles.ambassadorBadge}>
          <span className={styles.ambassadorAvatar}>
            <AmbassadorAvatar photoPath={ambassador.photo_path} name={ambassador.display_name} size={24} />
          </span>
          <div className={styles.ambassadorMeta}>
            <small>Indicado por</small>
            <strong>{ambassador.display_name}</strong>
          </div>
          <ShieldCheck size={14} className={styles.ambassadorIcon} />
        </div>
      </header>

      <div className={styles.announcement}>
        <span className={styles.desktopAnnouncement}>Frete grátis nas regiões atendidas • Pagamento somente na entrega</span>
        <span className={styles.mobileAnnouncement}>Frete grátis • Pague na entrega</span>
      </div>

      <main>
        <section id="inicio" ref={heroRef} className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <div className={styles.heroTags}>
                <span className={styles.tagKit}>KIT CASA PERFUMADA</span>
                <span className={styles.tagGift}>2 BRINDES PREMIUM</span>
              </div>

              <h1>10 litros para roupas <em>limpas, macias e perfumadas.</em></h1>

              <p className={`${styles.heroSubheadline} ${styles.desktopSubheadline}`}>
                {ambassador.display_name
                  ? `Sabão Líquido Concentrado 5L + Amaciante Microencapsulado 5L. Pela indicação de ${ambassador.display_name}, você ainda recebe 2 Panos Premium Xadrez de Alta Absorção — 45 × 70 cm.`
                  : 'Sabão Líquido Concentrado 5L + Amaciante Microencapsulado 5L e mais 2 Panos Premium Xadrez de Alta Absorção — 45 × 70 cm de presente.'}
              </p>

              <div className={styles.mobileSubheadlineGroup}>
                <p className={styles.mobileSubheadline}>
                  Sabão Concentrado 5L + Amaciante Microencapsulado 5L e 2 Panos Premium Xadrez de presente.
                </p>
                <div className={styles.mobileSubheadlineFeature}>
                  Panos Premium de Alta Absorção • 45 × 70 cm
                </div>
              </div>

              <div className={styles.mobileProductBlock}>
                <div className={styles.mobileProductImageWrapper}>
                  <Image src="/hero-pv-link-embaixador.jpg" alt="Kit Bryza com Sabão Líquido, Amaciante de 5L e Panos Premium" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: '70% center' }} />
                </div>
                <div className={styles.mobileProductCaption}>
                  Você recebe 2 Panos Premium Xadrez de 45 × 70 cm.
                </div>
              </div>

              <div className={styles.offerBox}>
                <div className={styles.offerPriceMain}>
                  <div className={styles.priceHeader}>
                    <span>Valor do kit + brindes</span>
                    <s className={styles.priceStrikethrough}>R$105,78</s>
                  </div>
                  <div className={styles.priceHighlight}>
                    <small>Hoje por</small>
                    <strong>R$79,80</strong>
                    <span className={styles.literPriceNote}>(Menos de R$7,99 por litro)</span>
                  </div>
                </div>

                <div className={styles.giftValueHighlight}>
                  <span>Você recebe <strong>R$25,98 em brindes.</strong></span>
                  <small>Cada Pano Premium custa em média R$12,99 nos supermercados.</small>
                </div>

                <div className={styles.offerAction}>
                  <OrderButton onClick={onOrder}>
                    AGENDAR MEU PEDIDO <ArrowRight size={18} />
                  </OrderButton>
                  <small className={styles.payOnDeliveryNote}>
                    <LockKeyhole size={14} /> Você não paga nada antecipadamente.
                  </small>
                </div>

                <div className={styles.heroTrustLine}>
                  <div className={styles.trustItem}><Truck size={14} /> <span>Frete grátis</span></div>
                  <div className={styles.trustItem}><WalletCards size={14} /> <span>Pagamento na entrega</span></div>
                  <div className={`${styles.trustItem} ${styles.trustFull}`}><MessageCircle size={14} /> <span>Confirmação pelo WhatsApp</span></div>
                </div>
              </div>

              <p className={styles.scarcityNote}>
                Brindes disponíveis conforme a quantidade destinada a cada campanha e rota de entrega.
              </p>
            </div>
          </div>

          <div className={styles.clothBadge}>
            <strong>2 Panos Premium</strong>
            <span>45 × 70 cm</span>
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

        <section className={styles.benefitsSection}>
          <div className={styles.sectionIntro}><span>Qualidade que você sente</span><h2>Mais rendimento, mais perfume e cuidado real.</h2><p>Fórmulas desenvolvidas para entregar limpeza, maciez e perfume para a rotina da sua família.</p></div>
          <div className={styles.benefitGrid}>{benefits.map((benefit) => { const Icon = benefitIcons[benefit.icon]; return <article key={benefit.title}><Icon /><h3>{benefit.title}</h3><p>{benefit.text}</p></article>; })}</div>
        </section>

        <section id="oferta" className={styles.valueSection}>
          <div className={styles.valueCopy}><span>Conta que fecha</span><h2>Você leva mais e paga menos.</h2><p>Em vez de comprar embalagens menores diversas vezes, você garante 10 litros de produtos e ainda recebe dois acessórios premium para completar a limpeza da casa.</p></div>
          <div className={styles.receipt}><h3>Resumo da oferta</h3><div><span>Sabão Líquido Bryza 5L</span><strong>R$ 39,90</strong></div><div><span>Amaciante Bryza 5L</span><strong>R$ 39,90</strong></div><div><span>2 Panos Premium</span><strong>R$ 25,98</strong></div><div><span>Entrega nas regiões atendidas</span><b>Grátis</b></div><div className={styles.receiptOld}><span>Valor total</span><s>R$ 105,78</s></div><div className={styles.receiptTotal}><span>Preço do kit</span><strong>R$ 79,80</strong></div><div className={styles.savings}>Economia de R$ 25,98 nos brindes</div><OrderButton onClick={onOrder}>Quero garantir meu kit</OrderButton><small><LockKeyhole /> Pagamento somente quando o pedido for entregue.</small></div>
        </section>

        <section id="como-funciona" className={styles.stepsSection}>
          <div className={styles.sectionIntro}><span>Simples, rápido e seguro</span><h2>Agende em menos de 2 minutos.</h2></div>
          <div className={styles.steps}>{steps.map((step, index) => <article key={step.title}><strong>{index + 1}</strong><div><h3>{step.title}</h3><p>{step.text}</p></div></article>)}</div>
        </section>

        <section className={styles.securitySection}><div><span><ShieldCheck /></span><h2>Peça com tranquilidade.</h2></div><ul><li><Check />Nenhum pagamento antecipado</li><li><MessageCircle />Confirmação pelo WhatsApp</li><li><MapPinCheck />Entrega conforme disponibilidade da rota</li><li><PackageCheck />Atendimento da equipe Bryza</li><li><Check />Sem assinatura ou cobrança recorrente</li></ul></section>

        <section id="duvidas" className={styles.faqSection}>
          <div className={styles.sectionIntro}><span>Dúvidas frequentes</span><h2>Antes de garantir o seu kit</h2></div>
          <div className={styles.faqList}>{faqs.map((faq, index) => { const isOpen = openFaq === index; return <div key={faq.question} className={styles.faqItem}><button type="button" aria-expanded={isOpen} aria-controls={`faq-${index}`} onClick={() => setOpenFaq(isOpen ? null : index)}><span>{faq.question}</span><ChevronDown className={isOpen ? styles.chevronOpen : ''} /></button><div id={`faq-${index}`} role="region" hidden={!isOpen}><p>{faq.answer}</p></div></div>; })}</div>
        </section>

        <section className={styles.finalCta}>
          <div><span>Kit Bryza Casa Perfumada</span><h2>Garanta 10 litros + 2 Panos Premium por <em>R$ 79,80.</em></h2><div className={styles.finalBenefits}><b><Truck />Frete grátis*</b><b><WalletCards />Pagamento na entrega</b><b><Gift />Mais de R$ 20 em brindes</b><b><PackageCheck />10 litros de produtos</b></div><OrderButton onClick={onOrder} inverse /><small><LockKeyhole /> Você não paga nada antecipadamente.</small><p>Os brindes são limitados à quantidade destinada a cada campanha e rota de entrega.</p></div>
          <div className={styles.finalProducts}><Image src="/hero-products.webp" alt="Kit Bryza Casa Perfumada" width={336} height={255} /><PlaidCloths /></div>
        </section>
      </main>

      <footer className={styles.footer}><Image src="/Logo Bryza.svg" alt="Bryza" width={126} height={44} /><p>O perfume que anuncia a presença.</p><nav aria-label="Links institucionais"><a href="#">Política de privacidade</a><a href="#">Termos de uso</a><a href="#duvidas">Atendimento</a></nav><small>© 2026 Bryza. Todos os direitos reservados. • Indicação {ambassador.referral_code.toUpperCase()}</small></footer>

      {!productAvailable && <div className={styles.unavailable}><PackageCheck /><div><strong>Oferta temporariamente indisponível</strong><span>Fale com a equipe Bryza para receber ajuda.</span></div></div>}
      {productAvailable && <div className={`${styles.mobileSticky} ${showSticky ? styles.mobileStickyVisible : ''}`}><div><span>Kit completo</span><strong>R$ 79,80</strong></div><button type="button" onClick={onOrder}>Agendar <ArrowRight /></button></div>}
    </div>
  );
}
