'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Flower2,
  Gift,
  Leaf,
  LockKeyhole,
  MapPinCheck,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Truck,
  WalletCards,
} from 'lucide-react';
import { benefits, faqs, kitItems, steps } from './kit-bryza-content';
import styles from './KitBryzaSalesPage.module.css';

interface AmbassadorInfo {
  display_name: string;
  referral_code: string;
}

interface KitBryzaLandingProps {
  ambassador: AmbassadorInfo;
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

function ProductVisual({ kind }: { kind: (typeof kitItems)[number]['kind'] }) {
  if (kind === 'cloths') return <PlaidCloths />;
  return (
    <div className={`${styles.productCrop} ${kind === 'soap' ? styles.cropLeft : styles.cropRight}`}>
      <Image src="/hero-products.webp" alt={kind === 'soap' ? 'Galão de Sabão Líquido Bryza 5L' : 'Galão de Amaciante Bryza 5L'} width={336} height={255} />
    </div>
  );
}

export function KitBryzaLanding({ ambassador, productAvailable, onOrder }: KitBryzaLandingProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showSticky, setShowSticky] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

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
        <span><Truck size={14} /> Oferta especial da rota Bryza</span><i />
        <span><Gift size={14} /> 2 brindes exclusivos</span><i />
        <span>Frete grátis*</span><i />
        <span>Pagamento somente na entrega</span>
      </div>

      <header className={styles.header}>
        <a href="#inicio" className={styles.brand} aria-label="Bryza — início"><Image src="/Logo Bryza.svg" alt="Bryza" width={142} height={48} priority /></a>
        <div className={styles.headerActions}>
          <div className={styles.ambassador}><span>{ambassador.display_name.charAt(0).toUpperCase()}</span><div><small>Indicação de</small><strong>{ambassador.display_name}</strong></div><ShieldCheck size={17} aria-label="Indicação oficial" /></div>
          <button type="button" className={styles.headerCta} onClick={onOrder}>Agendar agora<ArrowRight size={16} /></button>
        </div>
      </header>

      <main>
        <section id="inicio" ref={heroRef} className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <div className={styles.heroTags}><span>Kit Casa Perfumada</span><b>2 brindes exclusivos</b></div>
              <h1>10 litros para uma casa <em>limpa e perfumada.</em></h1>
              <p>Sabão Líquido Concentrado 5L + Amaciante Microencapsulado 5L e 2 Panos Premium Xadrez para completar sua rotina de limpeza.</p>
              <div className={styles.mobileHeroProduct}><Image src="/hero-products.webp" alt="Sabão Líquido e Amaciante Bryza de 5 litros" width={336} height={255} priority /><PlaidCloths /></div>
              <div className={styles.heroTrust}>
                <span><Truck /> <b>Frete<br />grátis*</b></span><span><WalletCards /> <b>Pagamento<br />na entrega</b></span><span><Gift /> <b>Mais de R$ 20<br />em brindes</b></span>
              </div>
              <div className={styles.offerBox}>
                <div className={styles.literPrice}><small>Menos de</small><strong><sup>R$</sup> 7,99</strong><span>por litro</span></div>
                <div className={styles.totalPrice}><small>De <s>R$ 105,78</s></small><span>por <strong>R$ 79,80</strong></span><small>no kit completo</small></div>
                <div className={styles.offerAction}><OrderButton onClick={onOrder} /><small><LockKeyhole size={13} /> Você não paga nada antecipadamente.</small></div>
                <div className={styles.giftValue}><Gift size={17} /><span>Cada pano custa em média R$ 12,99 nos mercados.<br /><strong>Você economiza mais de R$ 20 em brindes.</strong></span></div>
              </div>
            </div>
            <div className={styles.heroProduct}>
              <Image src="/hero-site-bryza-clean.jpg" alt="Kit Bryza com Sabão Líquido e Amaciante de 5 litros" fill sizes="(max-width: 1024px) 100vw, 55vw" priority />
              <PlaidCloths large />
              <div className={styles.clothSeal}><strong>2 panos</strong><span>premium xadrez</span><small>45 × 70 cm</small></div>
            </div>
          </div>
        </section>

        <section className={styles.indicators} aria-label="Indicadores da oferta">
          <div><strong>10L</strong><span>de produtos</span></div><div><strong>2</strong><span>brindes premium</span></div><div><strong>&lt; R$ 7,99</strong><span>por litro</span></div><div><strong>R$ 0</strong><span>de entrada</span></div>
        </section>

        <section className={styles.benefitsSection}>
          <div className={styles.sectionIntro}><span>Qualidade que você sente</span><h2>Mais rendimento, mais perfume e cuidado real.</h2><p>Fórmulas desenvolvidas para entregar limpeza, maciez e perfume para a rotina da sua família.</p></div>
          <div className={styles.benefitGrid}>{benefits.map((benefit) => { const Icon = benefitIcons[benefit.icon]; return <article key={benefit.title}><Icon /><h3>{benefit.title}</h3><p>{benefit.text}</p></article>; })}</div>
        </section>

        <section id="kit" className={styles.kitSection}>
          <div className={styles.sectionIntro}><span>O que vem no kit</span><h2>Tudo o que sua lavanderia precisa.</h2></div>
          <div className={styles.kitGrid}>{kitItems.map((item) => <article key={item.title} className={item.kind === 'cloths' ? styles.giftCard : ''}><ProductVisual kind={item.kind} /><div className={styles.itemCopy}><b>{item.label}</b><h3>{item.title}</h3><p>{item.description}</p><ul>{item.features.map(feature => <li key={feature}><Check />{feature}</li>)}</ul></div></article>)}</div>
        </section>

        <section className={styles.giftSection}>
          <div className={styles.giftVisual}><PlaidCloths large /><span>45 × 70 cm cada</span></div>
          <div className={styles.giftCopy}><span>Um brinde que tem valor de verdade</span><h2>Não são apenas dois panos. São R$ 25,98 em acessórios premium para sua casa.</h2><p>Nos supermercados tradicionais, panos desse padrão custam em média R$ 12,99 cada. No Kit Bryza, você recebe as duas unidades gratuitamente.</p><div className={styles.giftMath}><div><span>1 pano premium</span><strong>R$ 12,99</strong></div><div><span>2 panos premium</span><strong>R$ 25,98</strong></div><div><span>No Kit Bryza</span><strong>Grátis</strong></div></div><p className={styles.giftNote}>A estampa xadrez ajuda a disfarçar melhor as marcas do uso diário.</p></div>
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
