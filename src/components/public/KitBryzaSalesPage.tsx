'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, ChevronRight, Clock3, Gift, LockKeyhole, MapPin, PackageCheck, ShieldCheck, Sparkles, Star, Truck } from 'lucide-react';
import {
  createPublicSchedulingAction,
  type PublicSchedulingResult,
} from '@/app/actions/create-public-order';
import styles from './KitBryzaSalesPage.module.css';

interface AmbassadorPublicInfo {
  display_name: string;
  referral_code: string;
  photo_path?: string | null;
  city?: string | null;
  instagram?: string | null;
}

interface ProductOffer {
  id: string;
  nome_produto: string;
  preco_venda: number;
}

interface KitBryzaSalesPageProps {
  ambassador: AmbassadorPublicInfo;
  products: ProductOffer[];
}

interface SchedulingForm {
  nome: string;
  cpf: string;
  telefone: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  data: string;
  hora: string;
  formaPagamento: 'dinheiro' | 'pix' | 'cartao';
}

const initialForm = (city?: string | null): SchedulingForm => ({
  nome: '',
  cpf: '',
  telefone: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: city || '',
  estado: '',
  cep: '',
  data: '',
  hora: '',
  formaPagamento: 'pix',
});

const fieldStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '46px',
  padding: '11px 12px',
  borderRadius: '9px',
  border: '1px solid #475569',
  backgroundColor: '#0f172a',
  color: '#fff',
  fontSize: '16px',
  outlineColor: '#38bdf8',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 650,
  color: '#cbd5e1',
  marginBottom: '6px',
};

function digits(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function maskCpf(value: string): string {
  return digits(value, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(value: string): string {
  const normalized = digits(value, 11);
  if (normalized.length <= 10) {
    return normalized
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return normalized
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function maskCep(value: string): string {
  return digits(value, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSchedulingDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function ProductCard({ tone, icon, badge, title, description, items, featured = false }: {
  tone: 'blue' | 'purple' | 'gold';
  icon: React.ReactNode;
  badge: string;
  title: string;
  description: string;
  items: string[];
  featured?: boolean;
}) {
  return (
    <article className={`${styles.productCard} ${featured ? styles.featuredCard : ''}`}>
      <div className={`${styles.productIcon} ${styles[tone]}`}>{icon}</div>
      <div className={styles.cardBadge}>{badge}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <ul>{items.map((item) => <li key={item}><Check size={16} /> {item}</li>)}</ul>
    </article>
  );
}

export function KitBryzaSalesPage({ ambassador, products }: KitBryzaSalesPageProps) {
  const product = products[0];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<SchedulingForm>(() => initialForm(ambassador.city));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicSchedulingResult | null>(null);
  const [error, setError] = useState('');
  const idempotencyKeyRef = useRef('');
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstInputRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading && !result) setIsModalOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isModalOpen, loading, result]);

  const setField = <Key extends keyof SchedulingForm>(key: Key, value: SchedulingForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openSchedulingModal = () => {
    if (!product) return;
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
    setError('');
    setIsModalOpen(true);
  };

  const closeSchedulingModal = () => {
    if (loading) return;
    setIsModalOpen(false);
  };

  const submitScheduling = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!product || loading) return;

    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
    setLoading(true);
    setError('');

    const response = await createPublicSchedulingAction({
      nome: form.nome,
      cpf: form.cpf,
      telefone: form.telefone,
      endereco: form.endereco,
      numero: form.numero,
      complemento: form.complemento,
      bairro: form.bairro,
      cidade: form.cidade,
      estado: form.estado,
      cep: form.cep,
      data: form.data,
      hora: form.hora,
      forma_pagamento: form.formaPagamento,
      idempotency_key: idempotencyKeyRef.current,
      itens: [{ produto_id: product.id, quantidade: 1 }],
    });

    setLoading(false);
    if (response.success) {
      setResult(response.data);
    } else {
      setError(response.error);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Olá! Vim pela indicação de ${ambassador.display_name} (código ${ambassador.referral_code}) e gostaria de saber mais sobre o Kit Bryza Casa Perfumada.`
  );

  return (
    <div className={styles.page}>
      <div className={styles.topBar}><Sparkles size={15} /> Oferta especial da rota Bryza • brindes sujeitos à disponibilidade</div>
      <header className={styles.header}>
        <Image src="/Logo Bryza.svg" alt="Bryza" width={132} height={48} priority />
        <div className={styles.referral}>
          <span className={styles.avatar}>{ambassador.display_name.charAt(0).toUpperCase()}</span>
          <div><small>Indicação oficial de</small><strong>{ambassador.display_name}</strong></div>
          <ShieldCheck size={20} aria-label="Indicação verificada" />
        </div>
      </header>

      <main>
        {product ? <>
          <section className={styles.hero} aria-labelledby="offer-title">
            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}><Gift size={16} /> Kit Casa Perfumada + 2 brindes</div>
              <h1 id="offer-title">10 litros para uma casa <em>limpa e perfumada</em></h1>
              <p className={styles.heroLead}>Sabão líquido 5L + amaciante microencapsulado 5L e você ainda leva <strong>2 Panos Premium Bryza grátis.</strong></p>
              <div className={styles.mobileProduct}>
                <Image src="/hero-products.webp" alt="Sabão líquido e amaciante concentrado Bryza de 5 litros" width={336} height={255} priority />
                <span><Gift size={15} /> 2 panos grátis</span>
              </div>
              <div className={styles.priceBlock}>
                <div className={styles.priceIntro}>Kit completo: de <s>R$ 105,78</s> por <b>R$ 79,80</b></div>
                <div className={styles.priceRow}>
                  <strong><small>R$</small> 7,99</strong>
                  <span>por litro<b>10 litros no kit</b></span>
                </div>
              </div>
              <button type="button" onClick={openSchedulingModal} className={styles.primaryCta}>Agendar meu pedido agora <ChevronRight size={21} /></button>
              <div className={styles.noRisk}><LockKeyhole size={15} /> Nenhum pagamento antecipado. Você só paga na entrega.</div>
              <div className={styles.heroTrust}>
                <span><Truck size={18} /> Frete grátis*</span><span><ShieldCheck size={18} /> Compra segura</span><span><PackageCheck size={18} /> Pague ao receber</span>
              </div>
            </div>
            <div className={styles.heroVisual}>
              <Image src="/hero-site-bryza-clean.jpg" alt="Kit Bryza em uma lavanderia clara" fill sizes="(max-width: 900px) 100vw, 50vw" priority />
              <div className={styles.giftCard}><div className={styles.plaid} /><div><span>Você ganha</span><strong>2 Panos Premium</strong><small>45 × 70 cm • alta absorção</small></div></div>
              <div className={styles.savingsSeal}><small>economize</small><strong>R$ 25,98</strong><span>nos brindes</span></div>
            </div>
          </section>

          <section className={styles.proofBar} aria-label="Vantagens da oferta">
            <div><strong>10L</strong><span>de produtos Bryza</span></div><div><strong>2 grátis</strong><span>Panos Premium</span></div><div><strong>R$ 7,99</strong><span>por litro</span></div><div><strong>R$ 0</strong><span>de entrada</span></div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}><span>O kit completo</span><h2>Tudo o que sua lavanderia precisa</h2><p>Mais produto, mais rendimento e aquele perfume de roupa bem cuidada por muito mais tempo.</p></div>
            <div className={styles.productGrid}>
              <ProductCard tone="blue" icon={<Sparkles />} badge="5 litros" title="Sabão Líquido Concentrado" description="Limpeza eficiente para roupas brancas e coloridas, com fórmula concentrada e alto rendimento." items={["Aproximadamente 30 a 50 lavagens", "Perfume suave e limpeza eficiente", "Embalagem econômica"]} />
              <ProductCard tone="purple" icon={<Sparkles />} badge="5 litros" title="Amaciante Microencapsulado" description="Mais maciez e perfume prolongado, liberado aos poucos conforme o tecido se movimenta." items={["Essência microencapsulada", "Maciez prolongada", "Ideal para cama, banho e dia a dia"]} />
              <ProductCard tone="gold" icon={<Gift />} badge="Grátis" title="2 Panos Premium Xadrez" description="Grandes, resistentes e feitos para absorver mais nas limpezas da cozinha, banheiro e áreas externas." items={["Tamanho grande: 45 × 70 cm", "Laváveis e reutilizáveis", "R$ 25,98 em brindes"]} featured />
            </div>
          </section>

          <section className={styles.valueSection}>
            <div className={styles.valueCopy}>
              <span>Conta que fecha</span><h2>Você leva mais e paga menos</h2>
              <p>Comprar embalagens pequenas várias vezes no mês pesa no bolso. Com o Kit Bryza, você garante 10 litros de uma vez e recebe os acessórios para completar a limpeza.</p>
              <div className={styles.rating}><span>{[1,2,3,4,5].map(item => <Star key={item} size={18} fill="currentColor" />)}</span> Uma oferta pensada para a economia da família</div>
            </div>
            <div className={styles.receipt}>
              <h3>Resumo da sua oferta</h3>
              <div><span>Sabão Líquido Bryza 5L</span><strong>R$ 39,90</strong></div><div><span>Amaciante Bryza 5L</span><strong>R$ 39,90</strong></div><div><span>2 Panos Premium</span><s>R$ 25,98</s></div><div><span>Entrega nas regiões atendidas</span><b>Grátis</b></div>
              <div className={styles.receiptTotal}><span>Você paga hoje</span><strong>R$ 79,80</strong></div>
              <button type="button" onClick={openSchedulingModal} className={styles.primaryCta}>Quero garantir meu kit <ChevronRight size={21} /></button>
              <small><LockKeyhole size={14} /> Pagamento somente quando receber</small>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}><span>É simples e seguro</span><h2>Agende em menos de 2 minutos</h2></div>
            <div className={styles.steps}>
              <article><b>1</b><Clock3 /><h3>Agende o pedido</h3><p>Preencha seus dados e escolha o melhor período para receber.</p></article>
              <article><b>2</b><MapPin /><h3>Confirme a região</h3><p>A equipe Bryza confirma a disponibilidade da rota no seu endereço.</p></article>
              <article><b>3</b><Truck /><h3>Receba em casa</h3><p>Seu kit chega completo e você paga somente na entrega.</p></article>
            </div>
          </section>

          <section className={styles.faqSection}>
            <div className={styles.sectionHeading}><span>Dúvidas frequentes</span><h2>Antes de garantir o seu</h2></div>
            <div className={styles.faqList}>
              <details><summary>Quantos litros vêm no kit?</summary><p>São 10 litros: 5L de Sabão Líquido Concentrado e 5L de Amaciante Microencapsulado Bryza.</p></details>
              <details><summary>Os dois panos são realmente grátis?</summary><p>Sim. Você recebe dois Panos Premium Xadrez sem custo adicional, enquanto houver unidades reservadas para a campanha.</p></details>
              <details><summary>Preciso pagar antecipadamente?</summary><p>Não. Você paga o pedido somente quando receber em casa.</p></details>
              <details><summary>A entrega é grátis?</summary><p>Sim, nas regiões participantes atendidas pelas rotas Bryza. A equipe confirma a cobertura após o agendamento.</p></details>
            </div>
          </section>

          <section className={styles.finalCta}>
            <div><span><Gift size={17} /> Últimas unidades de brindes por rota</span><h2>Garanta 10 litros + 2 Panos Premium por R$ 79,80</h2><p>Frete grátis nas regiões atendidas e pagamento somente na entrega.</p></div>
            <button type="button" onClick={openSchedulingModal} className={styles.lightCta}>Agendar meu pedido <ChevronRight size={21} /></button>
          </section>
        </> : <section className={styles.unavailable} role="status"><PackageCheck size={42} /><h1 id="offer-title">Oferta temporariamente indisponível</h1><p>Não encontramos o kit ativo para esta página. Fale com a equipe Bryza para receber ajuda.</p><a href={`https://wa.me/?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer">Falar com a Bryza</a></section>}
      </main>

      <footer className={styles.footer}><Image src="/Logo Bryza.svg" alt="Bryza" width={108} height={40} /><p>O perfume que anuncia a presença.</p><small>© 2026 Bryza • Compra vinculada à indicação {ambassador.referral_code.toUpperCase()}</small></footer>
      {product && <div className={styles.mobileSticky}><div><span>Kit completo</span><strong>R$ 79,80</strong></div><button type="button" onClick={openSchedulingModal}>Agendar agora <ChevronRight size={18} /></button></div>}

      {isModalOpen && product && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSchedulingModal();
          }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(0px, 3vw, 24px)', backgroundColor: 'rgba(2, 6, 23, .82)', backdropFilter: 'blur(5px)' }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="scheduling-title"
            aria-describedby="scheduling-description"
            style={{ width: 'min(760px, 100%)', maxHeight: 'min(92dvh, 900px)', overflowY: 'auto', backgroundColor: '#111827', border: '1px solid #334155', borderRadius: 'clamp(0px, 3vw, 18px)', boxShadow: '0 30px 80px rgba(0,0,0,.5)' }}
          >
            <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '20px clamp(16px, 4vw, 28px)', backgroundColor: '#111827', borderBottom: '1px solid #334155' }}>
              <div>
                <h2 id="scheduling-title" style={{ margin: 0, color: '#fff', fontSize: '1.35rem' }}>
                  {result ? 'Entrega agendada' : 'Agendar entrega'}
                </h2>
                <p id="scheduling-description" style={{ margin: '5px 0 0', color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.4 }}>
                  {result ? 'Guarde os dados abaixo para acompanhar seu atendimento.' : 'Preencha seus dados para cadastro no CRM e escolha quando deseja receber.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSchedulingModal}
                disabled={loading}
                aria-label="Fechar modal de agendamento"
                style={{ flex: '0 0 auto', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #475569', backgroundColor: '#1e293b', color: '#fff', fontSize: '1.35rem', cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                ×
              </button>
            </div>

            {result ? (
              <div aria-live="polite" style={{ padding: 'clamp(22px, 5vw, 38px)' }}>
                <div style={{ padding: '24px', border: '1px solid #059669', borderRadius: '14px', backgroundColor: '#052e2b' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }} aria-hidden="true">✓</div>
                  <h3 style={{ color: '#6ee7b7', margin: '0 0 18px', fontSize: '1.25rem' }}>Agendamento confirmado!</h3>
                  <dl style={{ display: 'grid', gap: '13px', margin: 0 }}>
                    <div><dt style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Número</dt><dd style={{ margin: '3px 0 0', fontWeight: 850 }}>{result.numero_agendamento}</dd></div>
                    <div><dt style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Data e horário</dt><dd style={{ margin: '3px 0 0', fontWeight: 700 }}>{formatSchedulingDate(result.data_agendamento)}</dd></div>
                    <div><dt style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Valor</dt><dd style={{ margin: '3px 0 0', fontWeight: 700 }}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(result.valor_total)}</dd></div>
                  </dl>
                </div>

                <div style={{ marginTop: '16px', padding: '20px', borderRadius: '14px', backgroundColor: '#172554', border: '1px solid #1d4ed8' }}>
                  <div style={{ color: '#bfdbfe', fontSize: '0.83rem', marginBottom: '7px' }}>Seu código de embaixador Bryza</div>
                  <div style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 900, fontSize: 'clamp(1.45rem, 7vw, 2rem)', letterSpacing: '.04em' }}>
                    {result.novo_referral_code.toUpperCase()}
                  </div>
                  <p style={{ color: '#bfdbfe', fontSize: '0.82rem', lineHeight: 1.5, margin: '9px 0 0' }}>
                    Este código identifica você no programa de embaixadores. A equipe Bryza poderá orientar seus próximos passos.
                  </p>
                </div>

                <button type="button" onClick={closeSchedulingModal} style={{ width: '100%', minHeight: '50px', marginTop: '20px', border: 0, borderRadius: '11px', backgroundColor: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                  Concluir
                </button>
              </div>
            ) : (
              <form onSubmit={submitScheduling} style={{ padding: 'clamp(18px, 4vw, 28px)' }}>
                <div aria-live="assertive">
                  {error && <div role="alert" style={{ marginBottom: '18px', padding: '12px 14px', borderRadius: '9px', backgroundColor: '#7f1d1d', border: '1px solid #ef4444', color: '#fecaca', fontSize: '0.87rem' }}>{error}</div>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '15px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="public-name" style={labelStyle}>Nome completo *</label>
                    <input ref={firstInputRef} id="public-name" autoComplete="name" required minLength={3} maxLength={160} value={form.nome} onChange={(event) => setField('nome', event.target.value)} style={fieldStyle} />
                  </div>
                  <div>
                    <label htmlFor="public-cpf" style={labelStyle}>CPF *</label>
                    <input id="public-cpf" inputMode="numeric" autoComplete="off" required placeholder="000.000.000-00" value={form.cpf} onChange={(event) => setField('cpf', maskCpf(event.target.value))} style={fieldStyle} />
                  </div>
                  <div>
                    <label htmlFor="public-phone" style={labelStyle}>Telefone / WhatsApp *</label>
                    <input id="public-phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="(00) 00000-0000" value={form.telefone} onChange={(event) => setField('telefone', maskPhone(event.target.value))} style={fieldStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="public-address" style={labelStyle}>Endereço *</label>
                    <input id="public-address" autoComplete="street-address" required maxLength={200} value={form.endereco} onChange={(event) => setField('endereco', event.target.value)} style={fieldStyle} />
                  </div>
                  <div>
                    <label htmlFor="public-number" style={labelStyle}>Número *</label>
                    <input id="public-number" autoComplete="address-line2" required maxLength={20} value={form.numero} onChange={(event) => setField('numero', event.target.value)} style={fieldStyle} />
                  </div>
                  <div>
                    <label htmlFor="public-complement" style={labelStyle}>Complemento</label>
                    <input id="public-complement" autoComplete="address-line3" maxLength={100} placeholder="Apto, bloco, referência" value={form.complemento} onChange={(event) => setField('complemento', event.target.value)} style={fieldStyle} />
                  </div>
                  <div>
                    <label htmlFor="public-district" style={labelStyle}>Bairro *</label>
                    <input id="public-district" required maxLength={100} value={form.bairro} onChange={(event) => setField('bairro', event.target.value)} style={fieldStyle} />
                  </div>
                  <div>
                    <label htmlFor="public-city" style={labelStyle}>Cidade *</label>
                    <input id="public-city" autoComplete="address-level2" required maxLength={100} value={form.cidade} onChange={(event) => setField('cidade', event.target.value)} style={fieldStyle} />
                  </div>
                  <div>
                    <label htmlFor="public-state" style={labelStyle}>UF *</label>
                    <input id="public-state" autoComplete="address-level1" required minLength={2} maxLength={2} placeholder="SP" value={form.estado} onChange={(event) => setField('estado', event.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 2))} style={{ ...fieldStyle, textTransform: 'uppercase' }} />
                  </div>
                  <div>
                    <label htmlFor="public-cep" style={labelStyle}>CEP *</label>
                    <input id="public-cep" inputMode="numeric" autoComplete="postal-code" required placeholder="00000-000" value={form.cep} onChange={(event) => setField('cep', maskCep(event.target.value))} style={fieldStyle} />
                  </div>
                  <div>
                    <label htmlFor="public-date" style={labelStyle}>Data da entrega *</label>
                    <input id="public-date" type="date" min={localToday()} required value={form.data} onChange={(event) => setField('data', event.target.value)} style={fieldStyle} />
                  </div>
                  <div>
                    <label htmlFor="public-time" style={labelStyle}>Horário *</label>
                    <input id="public-time" type="time" required value={form.hora} onChange={(event) => setField('hora', event.target.value)} style={fieldStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="public-payment" style={labelStyle}>Forma de pagamento *</label>
                    <select id="public-payment" required value={form.formaPagamento} onChange={(event) => setField('formaPagamento', event.target.value as SchedulingForm['formaPagamento'])} style={fieldStyle}>
                      <option value="pix">PIX</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao">Cartão</option>
                    </select>
                  </div>
                </div>

                <p style={{ margin: '18px 0', color: '#94a3b8', fontSize: '0.76rem', lineHeight: 1.5 }}>
                  Ao confirmar, seus dados serão usados para cadastro, agendamento e atendimento da entrega pela Bryza.
                </p>
                <button type="submit" disabled={loading} style={{ width: '100%', minHeight: '52px', border: 0, borderRadius: '12px', backgroundColor: '#2563eb', color: '#fff', fontSize: '1rem', fontWeight: 850, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Confirmando agendamento…' : 'Confirmar agendamento'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
