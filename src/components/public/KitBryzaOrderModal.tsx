'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, LockKeyhole, X } from 'lucide-react';
import { createPublicSchedulingAction, type PublicSchedulingResult } from '@/app/actions/create-public-order';
import type { AmbassadorPublicInfo, ProductOffer } from './kit-bryza-types';
import styles from './KitBryzaSalesPage.module.css';

interface OrderModalProps {
  ambassador: AmbassadorPublicInfo;
  product: ProductOffer;
  onClose: () => void;
}

interface OrderForm {
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
  periodo: 'manha' | 'tarde' | 'noite' | 'qualquer';
  formaPagamento: 'dinheiro' | 'pix' | 'cartao';
  pagamentoNaEntrega: boolean;
}

const periodTimes: Record<OrderForm['periodo'], string> = { manha: '09:00', tarde: '14:00', noite: '18:30', qualquer: '12:00' };

const initialForm = (city?: string | null): OrderForm => ({
  nome: '', cpf: '', telefone: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: city || '', estado: '', cep: '', data: '', periodo: 'qualquer', formaPagamento: 'pix', pagamentoNaEntrega: false,
});

function digits(value: string, maxLength: number) { return value.replace(/\D/g, '').slice(0, maxLength); }
function maskCpf(value: string) { return digits(value, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); }
function maskPhone(value: string) { const valueDigits = digits(value, 11); return valueDigits.length <= 10 ? valueDigits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2') : valueDigits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2'); }
function maskCep(value: string) { return digits(value, 8).replace(/(\d{5})(\d)/, '$1-$2'); }
function tomorrow() { const date = new Date(); date.setDate(date.getDate() + 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

export function KitBryzaOrderModal({ ambassador, product, onClose }: OrderModalProps) {
  const [form, setForm] = useState<OrderForm>(() => initialForm(ambassador.city));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicSchedulingResult | null>(null);
  const [error, setError] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKeyDown); };
  }, [loading, onClose]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const setField = <Key extends keyof OrderForm>(key: Key, value: OrderForm[Key]) => setForm(current => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || !form.pagamentoNaEntrega) return;
    setLoading(true);
    setError('');
    const response = await createPublicSchedulingAction({
      nome: form.nome, cpf: form.cpf, telefone: form.telefone, endereco: form.endereco, numero: form.numero, complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, estado: form.estado, cep: form.cep, data: form.data, hora: periodTimes[form.periodo], forma_pagamento: form.formaPagamento, idempotency_key: idempotencyKeyRef.current, itens: [{ produto_id: product.id, quantidade: 1 }],
    });
    setLoading(false);
    if (response.success) setResult(response.data); else setError(response.error);
  };

  return (
    <div className={styles.modalOverlay} onMouseDown={event => { if (event.target === event.currentTarget && !loading) onClose(); }}>
      <section ref={modalRef} className={styles.orderModal} role="dialog" aria-modal="true" aria-labelledby="order-title" aria-describedby="order-description">
        <header className={styles.modalHeader}>
          <div><span>Kit Bryza Casa Perfumada</span><h2 id="order-title">{result ? 'Pedido recebido!' : 'Agendar meu pedido'}</h2><p id="order-description">{result ? 'Agora a equipe Bryza verificará a disponibilidade da rota.' : 'Preencha os dados abaixo. Você não paga nada antecipadamente.'}</p></div>
          <button type="button" onClick={onClose} disabled={loading} aria-label="Fechar formulário"><X /></button>
        </header>

        {result ? (
          <div className={styles.successState} aria-live="polite">
            <span><Check /></span><h3>Recebemos o seu pedido.</h3><p>A equipe Bryza verificará a disponibilidade da rota e confirmará os detalhes pelo WhatsApp.</p>
            <dl><div><dt>Número do pedido</dt><dd>{result.numero_agendamento}</dd></div><div><dt>Valor</dt><dd>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(result.valor_total)}</dd></div><div><dt>Pagamento</dt><dd>Somente na entrega</dd></div></dl>
            <button type="button" onClick={onClose}>Concluir</button>
          </div>
        ) : (
          <form className={styles.orderForm} onSubmit={submit} aria-busy={loading}>
            {error && <div ref={errorRef} className={styles.formError} role="alert" tabIndex={-1}>{error}</div>}
            <fieldset><legend>Seus dados</legend><div className={styles.formGrid}>
              <label className={styles.fullField}>Nome completo *<input ref={firstInputRef} autoComplete="name" required minLength={3} maxLength={160} value={form.nome} onChange={event => setField('nome', event.target.value)} /></label>
              <label>WhatsApp *<input type="tel" inputMode="tel" autoComplete="tel" required placeholder="(00) 00000-0000" value={form.telefone} onChange={event => setField('telefone', maskPhone(event.target.value))} /></label>
              <label>CPF *<input inputMode="numeric" required placeholder="000.000.000-00" value={form.cpf} onChange={event => setField('cpf', maskCpf(event.target.value))} /></label>
            </div></fieldset>
            <fieldset><legend>Endereço de entrega</legend><div className={styles.formGrid}>
              <label>CEP *<input inputMode="numeric" autoComplete="postal-code" required placeholder="00000-000" value={form.cep} onChange={event => setField('cep', maskCep(event.target.value))} /></label>
              <label>Bairro *<input required maxLength={100} value={form.bairro} onChange={event => setField('bairro', event.target.value)} /></label>
              <label className={styles.fullField}>Endereço *<input autoComplete="street-address" required maxLength={200} value={form.endereco} onChange={event => setField('endereco', event.target.value)} /></label>
              <label>Número *<input required maxLength={20} value={form.numero} onChange={event => setField('numero', event.target.value)} /></label>
              <label>Complemento<input maxLength={100} placeholder="Opcional" value={form.complemento} onChange={event => setField('complemento', event.target.value)} /></label>
              <label>Cidade *<input autoComplete="address-level2" required maxLength={100} value={form.cidade} onChange={event => setField('cidade', event.target.value)} /></label>
              <label>UF *<input autoComplete="address-level1" required minLength={2} maxLength={2} placeholder="SP" value={form.estado} onChange={event => setField('estado', event.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 2))} /></label>
            </div></fieldset>
            <fieldset><legend>Preferência de entrega</legend><div className={styles.formGrid}>
              <label>Data desejada *<input type="date" min={tomorrow()} required value={form.data} onChange={event => setField('data', event.target.value)} /></label>
              <label>Melhor período *<select value={form.periodo} onChange={event => setField('periodo', event.target.value as OrderForm['periodo'])}><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option><option value="qualquer">Qualquer horário</option></select></label>
              <label className={styles.fullField}>Forma de pagamento na entrega *<select value={form.formaPagamento} onChange={event => setField('formaPagamento', event.target.value as OrderForm['formaPagamento'])}><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option></select></label>
            </div></fieldset>
            <label className={styles.confirmation}><input type="checkbox" required checked={form.pagamentoNaEntrega} onChange={event => setField('pagamentoNaEntrega', event.target.checked)} /><span>Confirmo que o pagamento será realizado somente na entrega.</span></label>
            <button className={styles.submitOrder} type="submit" disabled={loading}>{loading ? 'Enviando pedido…' : 'Confirmar agendamento'}<LockKeyhole /></button>
            <small className={styles.privacyNote}>Seus dados serão usados apenas para o cadastro, o agendamento e o atendimento da entrega.</small>
          </form>
        )}
      </section>
    </div>
  );
}
