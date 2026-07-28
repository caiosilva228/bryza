'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, X, LockKeyhole, ArrowRight, ArrowLeft, Search, MapPin, CheckCircle2, XCircle, MessageCircle } from 'lucide-react';
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
  email: string;
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
  paymentTiming: 'agora' | 'na_entrega';
}

const ESTADOS_BRASIL = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
];

const periodTimes: Record<OrderForm['periodo'], string> = {
  manha: '09:00',
  tarde: '14:00',
  noite: '18:30',
  qualquer: '12:00',
};

// Algoritmo Oficial da Receita Federal para Validação Matemática de CPF
function isValidCPF(cpfStr: string): boolean {
  const clean = cpfStr.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

function getNext5Days() {
  const days: Array<{ value: string; label: string }> = [];
  const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  for (let i = 1; i <= 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateVal = `${yyyy}-${mm}-${dd}`;
    const labelStr = i === 1
      ? `${dd}/${mm}/${yyyy} — Amanhã (${weekDays[d.getDay()]})`
      : `${dd}/${mm}/${yyyy} (${weekDays[d.getDay()]})`;
    days.push({ value: dateVal, label: labelStr });
  }
  return days;
}

function tomorrowStr() {
  const available = getNext5Days();
  return available[0]?.value || '';
}

const initialForm = (city?: string | null): OrderForm => ({
  nome: '',
  cpf: '',
  telefone: '',
  email: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: city || '',
  estado: '',
  cep: '',
  data: tomorrowStr(),
  periodo: 'qualquer',
  formaPagamento: 'pix',
  paymentTiming: 'na_entrega',
});

export function KitBryzaOrderModal({ ambassador, product, onClose }: OrderModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState<OrderForm>(() => initialForm(ambassador.city));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicSchedulingResult | null>(null);
  const [error, setError] = useState('');

  // Status de Validação CPF & CEP (Verdadeiro / Falso)
  const [cpfStatus, setCpfStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [showAddressFields, setShowAddressFields] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const [cepStatus, setCepStatus] = useState<'idle' | 'searching' | 'valid' | 'invalid'>('idle');

  // Sub-modal de Busca de CEP por Endereço
  const [isCepModalOpen, setIsCepModalOpen] = useState(false);
  const [searchUf, setSearchUf] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [searchStreet, setSearchStreet] = useState('');
  const [cepSearchResults, setCepSearchResults] = useState<Array<{
    cep: string;
    logradouro: string;
    bairro: string;
    localidade: string;
    uf: string;
  }>>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [cepSearchError, setCepSearchError] = useState('');

  const modalRef = useRef<HTMLElement>(null);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        if (isCepModalOpen) {
          setIsCepModalOpen(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [loading, isCepModalOpen, onClose]);

  const setField = <Key extends keyof OrderForm>(key: Key, value: OrderForm[Key]) =>
    setForm(current => ({ ...current, [key]: value }));

  // Máscara Telefone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    setField('telefone', value);
  };

  // Máscara CPF + Validação Real-Time (Receita Federal)
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let value = rawDigits;
    if (value.length > 9) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
    } else if (value.length > 6) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    } else if (value.length > 3) {
      value = `${value.slice(0, 3)}.${value.slice(3)}`;
    }
    setField('cpf', value);

    if (rawDigits.length === 11) {
      if (isValidCPF(rawDigits)) {
        setCpfStatus('valid');
      } else {
        setCpfStatus('invalid');
      }
    } else {
      setCpfStatus('idle');
    }
  };

  // Máscara CEP + ViaCEP + Validação Real-Time
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 8);
    const cleanCep = value;
    if (value.length > 5) {
      value = `${value.slice(0, 5)}-${value.slice(5)}`;
    }
    setField('cep', value);
    setCepStatus('idle');

    if (cleanCep.length < 8) {
      return;
    }

    if (cleanCep.length === 8) {
      setSearchingCep(true);
      setCepStatus('searching');
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setField('endereco', data.logradouro || '');
          setField('bairro', data.bairro || '');
          setField('cidade', data.localidade || '');
          setField('estado', data.uf || '');
          setCepStatus('valid');
          setShowAddressFields(true);
        } else {
          setCepStatus('invalid');
          setShowAddressFields(false);
        }
      } catch {
        setCepStatus('invalid');
        setShowAddressFields(false);
      } finally {
        setSearchingCep(false);
      }
    }
  };

  // Sub-modal de Busca de CEP
  const handleOpenCepModal = () => {
    setSearchUf(form.estado || '');
    setSearchCity(form.cidade || '');
    setSearchStreet('');
    setCepSearchResults([]);
    setCepSearchError('');
    setIsCepModalOpen(true);
  };

  const handleSearchCepByAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setCepSearchError('');
    setCepSearchResults([]);

    if (!searchUf) {
      setCepSearchError('Selecione o estado (UF).');
      return;
    }
    if (!searchCity.trim() || searchCity.trim().length < 3) {
      setCepSearchError('Digite pelo menos 3 caracteres da cidade.');
      return;
    }
    if (!searchStreet.trim() || searchStreet.trim().length < 3) {
      setCepSearchError('Digite pelo menos 3 letras do nome da rua ou avenida.');
      return;
    }

    setIsSearchingAddress(true);
    try {
      const ufEsc = encodeURIComponent(searchUf.trim());
      const cityEsc = encodeURIComponent(searchCity.trim());
      const streetEsc = encodeURIComponent(searchStreet.trim());
      const res = await fetch(`https://viacep.com.br/ws/${ufEsc}/${cityEsc}/${streetEsc}/json/`);
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        setCepSearchResults(data);
      } else {
        setCepSearchError('Nenhum CEP encontrado. Tente simplificar o nome da rua.');
      }
    } catch {
      setCepSearchError('Ocorreu um erro ao pesquisar. Tente novamente.');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleSelectCepResult = (res: { cep: string; logradouro: string; bairro: string; localidade: string; uf: string }) => {
    const formattedCep = res.cep.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2');
    setField('cep', formattedCep);
    setField('endereco', res.logradouro || '');
    setField('bairro', res.bairro || '');
    setField('cidade', res.localidade || '');
    setField('estado', res.uf || '');
    setCepStatus('valid');
    setShowAddressFields(true);
    setIsCepModalOpen(false);
  };

  // Navegação de Etapas
  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.nome.trim() || form.nome.trim().length < 3) {
      setError('Por favor, informe seu nome completo.');
      return;
    }
    const cleanPhone = form.telefone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Por favor, informe um WhatsApp válido com DDD.');
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCpf = form.cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError('Por favor, digite o CPF com 11 dígitos.');
      return;
    }
    if (!isValidCPF(cleanCpf)) {
      setError('O CPF digitado não é válido segundo a Receita Federal. Por favor, verifique os números.');
      return;
    }
    setStep(3);
  };

  const handleNextStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (cepStatus === 'invalid') {
      setError('O CEP informado é inválido. Por favor, corrija o CEP ou busque por endereço.');
      return;
    }
    if (!showAddressFields) {
      setError('Por favor, digite um CEP válido de 8 dígitos ou clique em "Não sei meu CEP".');
      return;
    }
    if (!form.endereco.trim() || !form.numero.trim() || !form.bairro.trim() || !form.cidade.trim() || !form.estado.trim()) {
      setError('Por favor, preencha todos os campos do endereço (Endereço, Número, Bairro, Cidade e UF).');
      return;
    }
    setStep(4);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      const schedulingPayload = {
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
        hora: periodTimes[form.periodo],
        forma_pagamento: form.formaPagamento,
        payment_timing: form.paymentTiming,
        idempotency_key: idempotencyKeyRef.current,
        itens: [
          { produto_id: '957cdbc9-fea6-466e-b6e8-050dfb2359f5', quantidade: 1, desconto_aplicado: 0 },
          { produto_id: '7cfdcdb0-ac5a-4421-812d-2de8e99fd28e', quantidade: 1, desconto_aplicado: 0 },
          { produto_id: '664d141e-e52c-43c9-bd1a-e5848c6490a6', quantidade: 2, desconto_aplicado: 25.98 },
        ],
      };
      const response = await createPublicSchedulingAction(schedulingPayload);

      if (response.success) {
        const paymentData = response.data as PublicSchedulingResult & {
          checkout_token?: string | null;
          payment_timing?: 'agora' | 'na_entrega';
          payment_status?: string;
        };
        if (form.paymentTiming === 'agora' && paymentData.checkout_token) {
          const checkoutResponse = await fetch('/api/payments/mercado-pago/preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutToken: paymentData.checkout_token }),
          });
          const checkout = await checkoutResponse.json() as { checkoutUrl?: string; error?: string };
          if (!checkoutResponse.ok || !checkout.checkoutUrl) {
            throw new Error(checkout.error || 'Não foi possível abrir o pagamento. Tente novamente.');
          }
          window.location.assign(checkout.checkoutUrl);
          return;
        }
        setResult(response.data);
      } else {
        setError(response.error);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Ocorreu um erro ao enviar seu agendamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={e => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <section ref={modalRef} className={styles.orderModal} role="dialog" aria-modal="true">
        {/* Cabeçalho do Modal com Passos */}
        <header className={styles.modalHeader}>
          <div>
            <span>Kit Bryza Casa Perfumada</span>
            <h2>
              {result
                ? 'Pedido recebido!'
                : step === 1
                ? 'Seus dados de contato'
                : step === 2
                ? 'Validação de documento (CPF)'
                : step === 3
                ? 'Endereço de entrega'
                : 'Agendamento e pagamento'}
            </h2>
            <p>
              {result
                ? 'Sua solicitação de agendamento foi registrada com sucesso.'
                : 'Escolha pagar agora com Mercado Pago ou somente quando receber.'}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={loading} aria-label="Fechar formulário">
            <X />
          </button>
        </header>

        {/* Barra de Progresso / Indicadores de Etapa */}
        {!result && (
          <div style={{ padding: '0 24px 16px 24px', background: '#051329', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', overflow: 'hidden', marginBottom: '12px' }}>
              <div
                style={{
                  height: '100%',
                  background: '#5a8216',
                  width: step === 1 ? '25%' : step === 2 ? '50%' : step === 3 ? '75%' : '100%',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
              <span style={{ color: step >= 1 ? '#ffffff' : '#64748b' }}>1. Contato</span>
              <span style={{ color: step >= 2 ? '#ffffff' : '#64748b' }}>2. Documento</span>
              <span style={{ color: step >= 3 ? '#ffffff' : '#64748b' }}>3. Endereço</span>
              <span style={{ color: step >= 4 ? '#ffffff' : '#64748b' }}>4. Agendamento</span>
            </div>
          </div>
        )}

        {/* Estado de Sucesso */}
        {result ? (
          <div className={styles.successState} aria-live="polite" style={{ padding: '24px 20px', textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', background: '#f0fdf4', color: '#16a34a', borderRadius: '50%', marginBottom: '12px' }}>
              <Check size={32} />
            </span>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
              Recebemos o seu pedido com sucesso!
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.4 }}>
              A equipe Bryza verificará a disponibilidade da rota e confirmará os detalhes pelo WhatsApp.
            </p>

            {/* CARD RESUMO DO PEDIDO */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '500px', margin: '0 auto 20px auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Resumo do Agendamento
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#051329', background: '#e2e8f0', padding: '2px 8px', borderRadius: '6px' }}>
                  #{result.numero_agendamento}
                </span>
              </div>

              {/* Itens do Kit */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Itens do Kit Bryza:</span>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>1x Lava Roupas Concentrado Bryza - 5L</li>
                  <li>1x Amaciante Brisa Intense - Concentrado</li>
                  <li>2x Pano Premium Xadrez 45x70 <strong style={{ color: '#16a34a' }}>(Brinde Grátis)</strong></li>
                </ul>
              </div>

              {/* Dados do Cliente e Endereço */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', fontSize: '13px', color: '#334155' }}>
                <div>
                  <strong style={{ color: '#64748b', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Nome do Cliente</strong>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{form.nome}</span>
                </div>

                <div>
                  <strong style={{ color: '#64748b', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Endereço de Entrega</strong>
                  <span>{form.endereco}, nº {form.numero}{form.complemento ? ` (${form.complemento})` : ''} - {form.bairro}, {form.cidade}/{form.estado} (CEP: {form.cep})</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <strong style={{ color: '#64748b', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Data do Agendamento</strong>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      {form.data ? form.data.split('-').reverse().join('/') : ''} (
                      {form.periodo === 'manha' ? 'Manhã' : form.periodo === 'tarde' ? 'Tarde' : form.periodo === 'noite' ? 'Noite' : 'Qualquer horário'})
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: '#64748b', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Valor Total</strong>
                    <span style={{ fontWeight: 800, color: '#5a8216', fontSize: '15px' }}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(result.valor_total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTÃO CONFIRMAR VIA WHATSAPP */}
            {(() => {
              const formattedDate = form.data ? form.data.split('-').reverse().join('/') : '';
              const periodoMap: Record<string, string> = {
                manha: 'Manhã (09:00 - 12:00)',
                tarde: 'Tarde (14:00 - 18:00)',
                noite: 'Noite (18:30 - 21:00)',
                qualquer: 'Qualquer Horário',
              };
              const periodoStr = periodoMap[form.periodo] || form.periodo;
              const fullAddressStr = `${form.endereco}, nº ${form.numero}${form.complemento ? ` (${form.complemento})` : ''} - ${form.bairro}, ${form.cidade}/${form.estado} (CEP: ${form.cep})`;
              const valorFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(result.valor_total);

              const waMsg = `Olá, equipe Bryza! Gostaria de confirmar o meu pedido de agendamento:

• *Número do Pedido:* #${result.numero_agendamento}
• *Nome:* ${form.nome}
• *Endereço:* ${fullAddressStr}
• *Data do Agendamento:* ${formattedDate} (${periodoStr})
• *Valor Total:* ${valorFormatted}
• *Pagamento:* ${(result as PublicSchedulingResult & { payment_timing?: string }).payment_timing === 'agora' ? 'Pago online / aguardando confirmação' : 'Na entrega'}

Aguardo a confirmação da entrega!`;

              const waLink = `https://wa.me/556132462117?text=${encodeURIComponent(waMsg)}`;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '500px', margin: '0 auto' }}>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      background: '#25d366',
                      color: '#ffffff',
                      textDecoration: 'none',
                      fontSize: '15px',
                      fontWeight: 800,
                      padding: '14px 20px',
                      borderRadius: '10px',
                      boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
                      transition: 'all 0.2s ease',
                      width: '100%',
                    }}
                  >
                    <MessageCircle size={22} />
                    Clique aqui para confirmar seu pedido
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      background: 'transparent',
                      border: '1px solid #cbd5e1',
                      color: '#64748b',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    Fechar janela
                  </button>
                </div>
              );
            })()}
          </div>
        ) : (
          <form className={styles.orderForm} aria-busy={loading}>
            {error && <div className={styles.formError}>{error}</div>}

            {/* ETAPA 1: Dados Pessoais / Contato */}
            {step === 1 && (
              <fieldset>
                <legend>Seus dados de contato</legend>
                <div className={styles.formGrid}>
                  <label className={styles.fullField}>
                    Nome completo *
                    <input
                      type="text"
                      autoComplete="name"
                      required
                      minLength={3}
                      maxLength={160}
                      value={form.nome}
                      onChange={e => setField('nome', e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </label>
                  <label>
                    WhatsApp *
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      placeholder="(00) 00000-0000"
                      value={form.telefone}
                      onChange={handlePhoneChange}
                    />
                  </label>
                  <label>
                    E-mail
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com (opcional)"
                      value={form.email}
                      onChange={e => setField('email', e.target.value)}
                    />
                  </label>
                </div>
                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleNextStep1}
                    className={styles.submitOrder}
                    style={{ width: 'auto', minWidth: '180px' }}
                  >
                    Próximo Passo <ArrowRight size={18} />
                  </button>
                </div>
              </fieldset>
            )}

            {/* ETAPA 2: CPF com Validação Real-Time */}
            {step === 2 && (
              <fieldset>
                <legend>Documento de Identificação (CPF)</legend>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: 1.4 }}>
                  O CPF é utilizado para a emissão da nota fiscal e validação da entrega com segurança.
                </p>
                <div className={styles.formGrid}>
                  <label className={styles.fullField}>
                    CPF (Somente números) *
                    <div style={{ position: 'relative' }}>
                      <input
                        type="tel"
                        inputMode="numeric"
                        required
                        placeholder="000.000.000-00"
                        value={form.cpf}
                        onChange={handleCpfChange}
                        maxLength={14}
                      />
                    </div>
                  </label>
                </div>

                {/* Badge de Status de Validação CPF */}
                {cpfStatus === 'valid' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '12px',
                      padding: '10px 14px',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      color: '#166534',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle2 size={18} color="#22c55e" />
                    <span>CPF VÁLIDO</span>
                  </div>
                )}
                {cpfStatus === 'invalid' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '12px',
                      padding: '10px 14px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      color: '#991b1b',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    <XCircle size={18} color="#ef4444" />
                    <span>CPF INVÁLIDO — VERIFIQUE OS NÚMEROS DIGITADOS</span>
                  </div>
                )}

                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      borderRadius: '8px',
                      padding: '0 18px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <ArrowLeft size={16} /> Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep2}
                    disabled={cpfStatus !== 'valid'}
                    className={styles.submitOrder}
                    style={{ width: 'auto', minWidth: '180px' }}
                  >
                    Próximo Passo <ArrowRight size={18} />
                  </button>
                </div>
              </fieldset>
            )}

            {/* ETAPA 3: Endereço de Entrega com ViaCEP + Sub-modal CEP */}
            {step === 3 && (
              <fieldset>
                <legend>Endereço de entrega</legend>
                <div className={styles.formGrid}>
                  <label className={styles.fullField}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span>CEP *</span>
                      <button
                        type="button"
                        onClick={handleOpenCepModal}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                        }}
                      >
                        Não sei meu CEP
                      </button>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      placeholder="00000-000"
                      value={form.cep}
                      onChange={handleCepChange}
                      maxLength={9}
                    />
                  </label>
                </div>

                {/* Status de Busca do CEP */}
                {searchingCep && (
                  <div style={{ fontSize: '13px', color: '#2563eb', marginTop: '8px', fontWeight: 600 }}>
                    Buscando CEP no ViaCEP…
                  </div>
                )}
                {cepStatus === 'valid' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '8px',
                      padding: '8px 12px',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      color: '#166534',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle2 size={16} color="#22c55e" />
                    <span>CEP ENCONTRADO</span>
                  </div>
                )}
                {cepStatus === 'invalid' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '8px',
                      padding: '8px 12px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      color: '#991b1b',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    <XCircle size={16} color="#ef4444" />
                    <span>CEP NÃO ENCONTRADO — DIGITE NOVAMENTE OU BUSQUE PELO BOTÃO ACIMA</span>
                  </div>
                )}

                {/* Campos de Endereço Revelados */}
                {showAddressFields && (
                  <div className={styles.formGrid} style={{ marginTop: '16px' }}>
                    <label className={styles.fullField}>
                      Endereço (Rua, Avenida, Alameda) *
                      <input
                        type="text"
                        required
                        maxLength={200}
                        value={form.endereco}
                        onChange={e => setField('endereco', e.target.value)}
                      />
                    </label>
                    <label>
                      Número *
                      <input
                        type="text"
                        required
                        maxLength={20}
                        value={form.numero}
                        onChange={e => setField('numero', e.target.value)}
                      />
                    </label>
                    <label>
                      Complemento
                      <input
                        type="text"
                        maxLength={100}
                        placeholder="Apto, Bloco (opcional)"
                        value={form.complemento}
                        onChange={e => setField('complemento', e.target.value)}
                      />
                    </label>
                    <label>
                      Bairro *
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={form.bairro}
                        onChange={e => setField('bairro', e.target.value)}
                      />
                    </label>
                    <label>
                      Cidade *
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={form.cidade}
                        onChange={e => setField('cidade', e.target.value)}
                      />
                    </label>
                    <label>
                      Estado (UF) *
                      <select
                        required
                        value={form.estado}
                        onChange={e => setField('estado', e.target.value)}
                        style={{ height: '44px', borderRadius: '8px', padding: '0 12px' }}
                      >
                        <option value="">Selecione...</option>
                        {ESTADOS_BRASIL.map(est => (
                          <option key={est.sigla} value={est.sigla}>
                            {est.nome} ({est.sigla})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      borderRadius: '8px',
                      padding: '0 18px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <ArrowLeft size={16} /> Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep3}
                    disabled={!showAddressFields}
                    className={styles.submitOrder}
                    style={{ width: 'auto', minWidth: '180px' }}
                  >
                    Próximo Passo <ArrowRight size={18} />
                  </button>
                </div>
              </fieldset>
            )}

            {/* ETAPA 4: Agendamento & Forma de Pagamento */}
            {step === 4 && (
              <fieldset>
                <legend>Preferência de entrega e pagamento</legend>
                <div className={styles.formGrid}>
                  <label>
                    Data desejada (Próximos 5 dias) *
                    <select
                      required
                      value={form.data}
                      onChange={e => setField('data', e.target.value)}
                    >
                      {getNext5Days().map(d => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Melhor período *
                    <select value={form.periodo} onChange={e => setField('periodo', e.target.value as OrderForm['periodo'])}>
                      <option value="manha">Manhã (09:00 - 12:00)</option>
                      <option value="tarde">Tarde (14:00 - 18:00)</option>
                      <option value="noite">Noite (18:30 - 21:00)</option>
                      <option value="qualquer">Qualquer horário</option>
                    </select>
                  </label>
                  <div className={styles.fullField}>
                    <span style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>Quando deseja pagar? *</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                      {([
                        { value: 'agora', title: 'Pagar agora', detail: 'Checkout seguro do Mercado Pago' },
                        { value: 'na_entrega', title: 'Pagar na entrega', detail: 'Escolha o meio ao receber' },
                      ] as const).map(option => {
                        const selected = form.paymentTiming === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setField('paymentTiming', option.value)}
                            aria-pressed={selected}
                            style={{
                              padding: '14px',
                              textAlign: 'left',
                              borderRadius: '10px',
                              border: selected ? '2px solid var(--color-primary)' : '1px solid #cbd5e1',
                              background: selected ? '#f0fdf4' : '#fff',
                              color: selected ? '#047857' : '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            <strong style={{ display: 'block' }}>{option.title}</strong>
                            <small>{option.detail}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {form.paymentTiming === 'na_entrega' && <label className={styles.fullField}>
                    Forma de pagamento na entrega *
                    <select
                      value={form.formaPagamento}
                      onChange={e => setField('formaPagamento', e.target.value as OrderForm['formaPagamento'])}
                    >
                      <option value="pix">PIX (Chave ou QR Code)</option>
                      <option value="dinheiro">Dinheiro (Espécie)</option>
                      <option value="cartao">Cartão de Crédito / Débito</option>
                    </select>
                  </label>}
                </div>

                <div className={styles.confirmation} style={{ marginTop: '16px' }}>
                  <LockKeyhole size={18} />
                  <span>{form.paymentTiming === 'agora'
                    ? 'Você será direcionado ao ambiente seguro do Mercado Pago.'
                    : 'O pagamento será realizado somente no momento da entrega.'}</span>
                </div>

                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={loading}
                    style={{
                      background: 'transparent',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      borderRadius: '8px',
                      padding: '0 18px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <ArrowLeft size={16} /> Voltar
                  </button>
                  <button
                    className={styles.submitOrder}
                    type="button"
                    onClick={handleSubmitOrder}
                    disabled={loading}
                  >
                    {loading ? 'Processando…' : form.paymentTiming === 'agora' ? 'Continuar para pagamento' : 'Confirmar agendamento'} <LockKeyhole size={18} />
                  </button>
                </div>

                <small className={styles.privacyNote} style={{ marginTop: '12px', display: 'block' }}>
                  Seus dados serão usados apenas para a entrega do seu pedido e agendamento da rota.
                </small>
              </fieldset>
            )}
          </form>
        )}
      </section>

      {/* Sub-Modal Interno de Consulta de CEP por Endereço */}
      {isCepModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(5, 19, 41, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            padding: '16px',
          }}
          onMouseDown={e => {
            if (e.target === e.currentTarget) setIsCepModalOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90dvh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              color: '#0f172a',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '18px 22px',
                background: '#051329',
                color: '#ffffff',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#a9bde9', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  CONSULTA EM TEMPO REAL
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                  Buscar CEP por Endereço
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCepModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSearchCepByAddress} style={{ padding: '22px' }}>
              <div style={{ display: 'grid', gap: '14px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
                  Estado (UF) *
                  <select
                    value={searchUf}
                    onChange={e => setSearchUf(e.target.value)}
                    required
                    style={{ height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px' }}
                  >
                    <option value="">Selecione...</option>
                    {ESTADOS_BRASIL.map(est => (
                      <option key={est.sigla} value={est.sigla}>
                        {est.nome} ({est.sigla})
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
                  Cidade *
                  <input
                    type="text"
                    placeholder="Ex: Cidade Ocidental"
                    value={searchCity}
                    onChange={e => setSearchCity(e.target.value)}
                    required
                    style={{ height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
                  Nome da Rua / Avenida / Quadra *
                  <input
                    type="text"
                    placeholder="Ex: SQ 16 Quadra 2"
                    value={searchStreet}
                    onChange={e => setSearchStreet(e.target.value)}
                    required
                    style={{ height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px' }}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isSearchingAddress}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  height: '46px',
                  background: '#051329',
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: isSearchingAddress ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Search size={16} />
                {isSearchingAddress ? 'Pesquisando na API ViaCEP…' : 'Buscar Endereço'}
              </button>

              {cepSearchError && (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '10px 14px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#991b1b',
                    fontSize: '13px',
                  }}
                >
                  {cepSearchError}
                </div>
              )}

              {cepSearchResults.length > 0 && (
                <div style={{ marginTop: '18px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Selecione o seu endereço na lista:
                  </p>
                  <div style={{ display: 'grid', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                    {cepSearchResults.map((res, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectCepResult(res)}
                        style={{
                          padding: '12px 14px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <MapPin size={20} color="#2563eb" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>CEP {res.cep}</strong>
                          <span style={{ fontSize: '12px', color: '#334155' }}>
                            {res.logradouro} - {res.bairro}
                          </span>
                          <small style={{ fontSize: '11px', color: '#64748b' }}>
                            {res.localidade}/{res.uf}
                          </small>
                        </div>
                        <ArrowRight size={16} color="#94a3b8" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
