'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createPublicSchedulingAction,
  type PublicSchedulingResult,
} from '@/app/actions/create-public-order';

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
    `Olá! Vim pela indicação de ${ambassador.display_name} (código ${ambassador.referral_code}) e gostaria de saber mais sobre a Bryza.`
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '12px clamp(16px, 4vw, 32px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div aria-hidden="true" style={{ flex: '0 0 auto', width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
            {ambassador.display_name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Indicação oficial</div>
            <div style={{ fontWeight: 700, color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ambassador.display_name}
            </div>
          </div>
        </div>
        <span style={{ flex: '0 0 auto', fontSize: '0.72rem', backgroundColor: '#0369a1', padding: '5px 10px', borderRadius: '999px', fontWeight: 800 }}>
          {ambassador.referral_code.toUpperCase()}
        </span>
      </header>

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: 'clamp(24px, 6vw, 48px) 16px' }}>
        <section aria-labelledby="offer-title" style={{ background: 'linear-gradient(145deg, #1e293b, #111827)', borderRadius: '20px', border: '1px solid #334155', padding: 'clamp(22px, 6vw, 38px)', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,.28)' }}>
          {product ? (
            <>
              <div style={{ display: 'inline-block', marginBottom: '14px', padding: '5px 11px', borderRadius: '999px', backgroundColor: '#0c4a6e', color: '#bae6fd', fontSize: '0.75rem', fontWeight: 800 }}>
                OFERTA BRYZA
              </div>
              <h1 id="offer-title" style={{ fontSize: 'clamp(1.75rem, 7vw, 2.7rem)', lineHeight: 1.08, margin: '0 0 14px', color: '#fff' }}>
                {product.nome_produto}
              </h1>
              <p style={{ color: '#cbd5e1', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: '520px' }}>
                Escolha o melhor dia para receber. Seus dados serão cadastrados com segurança e a equipe Bryza confirmará a entrega.
              </p>
              <div style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', fontWeight: 900, color: '#34d399', marginBottom: '4px' }}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(product.preco_venda))}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.86rem', marginBottom: '26px' }}>Pagamento combinado para a entrega</div>

              <button
                type="button"
                onClick={openSchedulingModal}
                style={{ width: '100%', minHeight: '54px', border: 0, borderRadius: '13px', padding: '14px 20px', backgroundColor: '#2563eb', color: '#fff', fontSize: '1.05rem', fontWeight: 850, cursor: 'pointer', boxShadow: '0 10px 24px rgba(37,99,235,.35)' }}
              >
                Agendar entrega
              </button>
            </>
          ) : (
            <div role="status" style={{ padding: '24px 0' }}>
              <h1 id="offer-title" style={{ fontSize: '1.7rem', margin: '0 0 12px' }}>Oferta temporariamente indisponível</h1>
              <p style={{ color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                Não encontramos um produto ativo para esta página. Fale com a equipe Bryza para receber ajuda.
              </p>
            </div>
          )}
        </section>

        <a
          href={`https://wa.me/?text=${whatsappMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '50px', marginTop: '16px', borderRadius: '12px', backgroundColor: '#15803d', color: '#fff', fontWeight: 750, textDecoration: 'none' }}
        >
          Tirar dúvidas pelo WhatsApp
        </a>
      </main>

      <footer style={{ textAlign: 'center', padding: '24px 16px', fontSize: '0.78rem', color: '#64748b', borderTop: '1px solid #1e293b' }}>
        © 2026 Bryza Sistem — compra vinculada à indicação {ambassador.referral_code.toUpperCase()}
      </footer>

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
