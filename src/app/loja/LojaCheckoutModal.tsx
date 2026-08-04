'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, ArrowRight, ArrowLeft, Search, MapPin, MessageCircle, X, LockKeyhole } from 'lucide-react';
import {
  StoreCartItem,
  StoreOrderPayload,
  createStoreOrderAction,
  getStoreSchedulingAvailabilityAction,
} from './actions';
import { formatCurrency } from '@/utils/format';
import {
  formatBusinessDateLabel,
  getPeriodLabel,
  getSaoPauloDateKey,
  StoreSchedulingAvailability,
} from '@/lib/store-kits/scheduling-control';
import styles from './checkout-mobile.module.css';

const getStoreItemName = (item: StoreCartItem) => item.kind === 'produto' ? item.produto.nome_produto : item.kit.nome;
const getStoreItemPrice = (item: StoreCartItem) => item.kind === 'produto' ? item.produto.preco_venda : item.kit.preco_venda;

interface LojaCheckoutModalProps {
  cartItems: StoreCartItem[];
  totalValue: number;
  isLoggedIn: boolean;
  userData?: {
    full_name?: string;
    phone?: string;
    cpf?: string;
    address?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    cep?: string;
  } | null;
  onClose: () => void;
  onSuccess: (order: { orderNumber: string; whatsappUrl: string }) => void;
}

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
  const now = new Date();
  for (let i = 1; i <= 5; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
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

function getTodayDeliveryOption() {
  const value = getSaoPauloDateKey();
  return {
    value,
    label: formatBusinessDateLabel(value, true),
  };
}

const STANDARD_DELIVERY_PERIODS = [
  { value: 'manhademanha', label: 'Manhã (09:00 - 12:00)' },
  { value: 'tarde', label: 'Tarde (14:00 - 18:00)' },
  { value: 'noite', label: 'Noite (18:30 - 21:00)' },
  { value: 'qualquer', label: 'Qualquer horário' },
] as const;

const ESTADOS_BRASIL = [
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'ES', nome: 'Espírito Santo' },
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

const DRAFT_KEY = 'bryza_checkout_draft';
const PAYMENT_RETURN_KEY = 'bryza_mp_checkout';

function loadDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Mercado Pago Logo & Accepted Cards Badges Components
const MercadoPagoLogoBadge = () => (
  <div style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#009EE3',
    color: '#ffffff',
    padding: '4px 10px',
    borderRadius: '6px',
    fontWeight: 800,
    fontSize: '12px',
    letterSpacing: '-0.01em',
    boxShadow: '0 2px 6px rgba(0, 158, 227, 0.25)'
  }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM15.5 14.5L12 18L8.5 14.5L9.9 13.1L12 15.2L14.1 13.1L15.5 14.5ZM14.1 8.9L12 11L9.9 8.9L8.5 10.3L12 13.8L15.5 10.3L14.1 8.9Z" fill="white" />
    </svg>
    <span>mercado pago</span>
  </div>
);

const AcceptedPaymentCardsBadges = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
    {/* PIX */}
    <div title="Pix" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#32BCAD', color: '#ffffff', padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 800 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L4 10L12 18L20 10L12 2ZM7 10L12 5L17 10L12 15L7 10Z"/>
      </svg>
      <span>PIX</span>
    </div>

    {/* VISA */}
    <div title="Visa" style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#1A1F71', color: '#ffffff', padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 900, fontStyle: 'italic', letterSpacing: '0.05em' }}>
      VISA
    </div>

    {/* MASTERCARD */}
    <div title="Mastercard" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#1F2937', color: '#ffffff', padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EB001B', marginRight: '-4px' }}></div>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FF5F00', opacity: 0.95 }}></div>
      </div>
      <span>mastercard</span>
    </div>

    {/* ELO */}
    <div title="Elo" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: '#000000', color: '#ffffff', padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 900 }}>
      <span>elo</span>
      <div style={{ display: 'flex', gap: '1px' }}>
        <span style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#FF0000' }}></span>
        <span style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#FFD700' }}></span>
        <span style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#0066FF' }}></span>
      </div>
    </div>

    {/* HIPERCARD */}
    <div title="Hipercard" style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#B3131B', color: '#ffffff', padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 800, fontStyle: 'italic' }}>
      Hipercard
    </div>

    {/* AMEX */}
    <div title="American Express" style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#006FCF', color: '#ffffff', padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 800 }}>
      AMEX
    </div>
  </div>
);

export default function LojaCheckoutModal({
  cartItems,
  totalValue,
  isLoggedIn,
  userData,
  onClose,
  onSuccess
}: LojaCheckoutModalProps) {
  const [submissionKey] = useState(() => globalThis.crypto.randomUUID());
  const nextDays = getNext5Days();
  const todayOption = getTodayDeliveryOption();
  const initialDeliveryDays = [todayOption, ...nextDays];
  const savedDraft = loadDraft();

  // Se estiver logado, inicia direto na Etapa 4 (Resumo), senão restaura etapa salva
  const [step, setStep] = useState<1 | 2 | 3 | 4>(() => {
    if (isLoggedIn) return 4;
    if (savedDraft?.step && [1, 2, 3, 4].includes(savedDraft.step)) {
      return savedDraft.step as 1 | 2 | 3 | 4;
    }
    return 1;
  });

  const [nome, setNome] = useState(() => savedDraft?.nome || userData?.full_name || '');
  const [telefone, setTelefone] = useState(() => savedDraft?.telefone || userData?.phone || '');
  const [email, setEmail] = useState(() => savedDraft?.email || '');
  const [cpf, setCpf] = useState(() => savedDraft?.cpf || userData?.cpf || '');
  const [cpfStatus, setCpfStatus] = useState<'idle' | 'valid' | 'invalid'>(() => {
    const initialCpf = savedDraft?.cpf || userData?.cpf;
    return initialCpf && isValidCPF(initialCpf) ? 'valid' : 'idle';
  });

  const [cep, setCep] = useState(() => savedDraft?.cep || userData?.cep || '');
  const [endereco, setEndereco] = useState(() => savedDraft?.endereco || userData?.address || '');
  const [numero, setNumero] = useState(() => savedDraft?.numero || userData?.number || '');
  const [complemento, setComplemento] = useState(() => savedDraft?.complemento || '');
  const [bairro, setBairro] = useState(() => savedDraft?.bairro || userData?.neighborhood || '');
  const [cidade, setCidade] = useState(() => savedDraft?.cidade || userData?.city || 'Brasília');
  const [estado, setEstado] = useState(() => savedDraft?.estado || userData?.state || 'DF');
  const [showAddressFields, setShowAddressFields] = useState<boolean>(() =>
    Boolean(savedDraft?.endereco || savedDraft?.cep || userData?.address || userData?.cep)
  );

  const [searchingCep, setSearchingCep] = useState(false);
  const [cepStatus, setCepStatus] = useState<'idle' | 'searching' | 'valid' | 'invalid'>('idle');

  // Sub-modal de Busca de CEP
  const [isCepModalOpen, setIsCepModalOpen] = useState(false);
  const [searchUf, setSearchUf] = useState(userData?.state || 'DF');
  const [searchCity, setSearchCity] = useState(userData?.city || 'Brasília');
  const [searchStreet, setSearchStreet] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [cepSearchResults, setCepSearchResults] = useState<any[]>([]);
  const [cepSearchError, setCepSearchError] = useState('');

  // Agendamento & Pagamento
  const [dataAgendamento, setDataAgendamento] = useState(() => {
    return initialDeliveryDays[0]?.value || '';
  });
  const [periodo, setPeriodo] = useState<'manhademanha' | 'tarde' | 'noite' | 'qualquer' | 'ate_3_horas'>(() => 'ate_3_horas');
  const [formaPagamento, setFormaPagamento] = useState(() => savedDraft?.formaPagamento || 'PIX');
  const [paymentTiming, setPaymentTiming] = useState<'agora' | 'na_entrega'>(() => savedDraft?.paymentTiming || 'agora');
  const [showDeliveryWarningModal, setShowDeliveryWarningModal] = useState(false);
  const [schedulingAvailability, setSchedulingAvailability] = useState<StoreSchedulingAvailability | null>(null);
  const [schedulingLoading, setSchedulingLoading] = useState(true);
  const [schedulingError, setSchedulingError] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    orderNumber: string;
    whatsappUrl: string;
    paymentTiming?: string;
    paymentStatus?: string;
    items?: typeof cartItems;
    totalValue?: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSchedulingAvailability = async () => {
      setSchedulingLoading(true);
      const availability = await getStoreSchedulingAvailabilityAction();
      if (cancelled) return;

      setSchedulingAvailability(availability);
      setSchedulingLoading(false);
      if (!availability.success) {
        setSchedulingError(availability.error || 'Não foi possível carregar as datas de entrega.');
        return;
      }

      setSchedulingError('');
      const selectedDay = availability.dias.find(day => day.value === dataAgendamento);
      const firstAvailableDay = availability.dias.find(day => day.disponivel);
      setDataAgendamento(current => selectedDay?.disponivel ? current : firstAvailableDay?.value || '');
      setPeriodo(current => {
        const nextSelectedDay = availability.dias.find(day => day.value === (selectedDay?.disponivel ? dataAgendamento : firstAvailableDay?.value));
        if (nextSelectedDay?.hoje) return 'ate_3_horas';
        return current === 'ate_3_horas' ? 'manhademanha' : current;
      });
    };

    loadSchedulingAvailability().catch(() => {
      if (!cancelled) {
        setSchedulingLoading(false);
        setSchedulingError('Não foi possível carregar as datas de entrega.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-salvar rascunho a cada alteração
  useEffect(() => {
    if (typeof window !== 'undefined' && !result) {
      const draftData = {
        step,
        nome,
        telefone,
        email,
        cpf,
        cep,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        dataAgendamento,
        periodo,
        formaPagamento,
        paymentTiming,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
    }
  }, [step, nome, telefone, email, cpf, cep, endereco, numero, complemento, bairro, cidade, estado, dataAgendamento, periodo, formaPagamento, paymentTiming, result]);

  const deliveryDays = schedulingAvailability?.success
    ? schedulingAvailability.dias
    : initialDeliveryDays.map((day, index) => ({
      value: day.value,
      label: day.label,
      quantidade: 0,
      restante: null,
      disponivel: true,
      hoje: index === 0,
      index,
    }));
  const selectedDeliveryDay = deliveryDays.find(day => day.value === dataAgendamento);
  const periodOptions = selectedDeliveryDay?.hoje
    ? [{
      value: 'ate_3_horas' as const,
      label: `Hoje (entrega em até ${schedulingAvailability?.antecedencia_mesmo_dia_horas || 3} horas)`,
    }]
    : STANDARD_DELIVERY_PERIODS;

  // Formatador de Telefone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (digits.length > 6) {
      digits = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length > 2) {
      digits = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    setTelefone(digits);
  };

  // Máscara CPF + Validação Real-Time
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let val = rawDigits;
    if (val.length > 9) {
      val = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6, 9)}-${val.slice(9)}`;
    } else if (val.length > 6) {
      val = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6)}`;
    } else if (val.length > 3) {
      val = `${val.slice(0, 3)}.${val.slice(3)}`;
    }
    setCpf(val);

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

  // Máscara CEP + ViaCEP
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 8);
    const cleanCep = val;
    if (val.length > 5) {
      val = `${val.slice(0, 5)}-${val.slice(5)}`;
    }
    setCep(val);
    setCepStatus('idle');

    if (cleanCep.length < 8) return;

    if (cleanCep.length === 8) {
      setSearchingCep(true);
      setCepStatus('searching');
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setEndereco(data.logradouro || '');
          setBairro(data.bairro || '');
          setCidade(data.localidade || '');
          setEstado(data.uf || '');
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

  // Busca de CEP por endereço
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
      setCepSearchError('Digite pelo menos 3 letras da rua ou avenida.');
      return;
    }

    setIsSearchingAddress(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${encodeURIComponent(searchUf)}/${encodeURIComponent(searchCity.trim())}/${encodeURIComponent(searchStreet.trim())}/json/`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setCepSearchResults(data);
      } else {
        setCepSearchError('Nenhum CEP encontrado com esse endereço.');
      }
    } catch {
      setCepSearchError('Erro ao pesquisar CEP. Tente novamente.');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleSelectCepResult = (res: any) => {
    const formatted = res.cep.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2');
    setCep(formatted);
    setEndereco(res.logradouro || '');
    setBairro(res.bairro || '');
    setCidade(res.localidade || '');
    setEstado(res.uf || '');
    setCepStatus('valid');
    setShowAddressFields(true);
    setIsCepModalOpen(false);
  };

  // Navegação
  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!nome.trim() || nome.trim().length < 3) {
      setError('Por favor, informe seu nome completo.');
      return;
    }
    const cleanPhone = telefone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Por favor, informe um WhatsApp válido com DDD.');
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError('Por favor, digite o CPF completo com 11 dígitos.');
      return;
    }
    if (!isValidCPF(cleanCpf)) {
      setError('CPF inválido segundo a Receita Federal. Verifique os números digitados.');
      return;
    }
    setStep(3);
  };

  const handleNextStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (cepStatus === 'invalid') {
      setError('O CEP informado é inválido.');
      return;
    }
    if (!endereco.trim() || !numero.trim() || !bairro.trim() || !cidade.trim() || !estado.trim()) {
      setError('Por favor, preencha todos os campos do endereço (Endereço, Número, Bairro, Cidade e UF).');
      return;
    }
    setStep(4);
  };

  // Envio Final do Pedido
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nome.trim() || !telefone.trim() || !endereco.trim() || !bairro.trim()) {
      setError('Por favor, preencha seus dados de contato e endereço.');
      return;
    }

    if (schedulingLoading) {
      setError('Aguarde enquanto atualizamos as datas de entrega disponíveis.');
      return;
    }
    if (schedulingAvailability?.success) {
      const selectedDay = schedulingAvailability.dias.find(day => day.value === dataAgendamento);
      if (!schedulingAvailability.automatico_ativo) {
        setError('Os agendamentos online estão temporariamente pausados.');
        return;
      }
      if (!selectedDay?.disponivel) {
        setError('A data escolhida não está mais disponível. Selecione outra data.');
        return;
      }
      if (selectedDay.hoje && periodo !== 'ate_3_horas') {
        setError('Para receber hoje, selecione a opção de entrega em até 3 horas.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: StoreOrderPayload = {
        clientName: nome,
        clientPhone: telefone,
        cpf,
        address: endereco,
        number: numero,
        neighborhood: bairro,
        city: cidade,
        state: estado,
        cep,
        scheduledDate: dataAgendamento,
        period: periodo,
        paymentMethod: formaPagamento,
        paymentTiming,
        items: cartItems.map(item => ({
          ...(item.kind === 'produto' ? { produto_id: item.produto.id } : { kit_id: item.kit.id }),
          quantidade: item.quantidade,
        })),
        idempotencyKey: submissionKey,
      };

      const res = await createStoreOrderAction(payload);

      setLoading(false);
      if (res.success && res.orderNumber) {
        const paymentResult = res as typeof res & {
          checkoutToken?: string;
          paymentTiming?: string;
          paymentStatus?: string;
        };
        if (paymentTiming === 'agora' && paymentResult.checkoutToken) {
          const checkoutResponse = await fetch('/api/payments/mercado-pago/preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutToken: paymentResult.checkoutToken }),
          });
          const checkout = await checkoutResponse.json() as { checkoutUrl?: string; error?: string };
          if (!checkoutResponse.ok || !checkout.checkoutUrl) {
            throw new Error(checkout.error || 'Não foi possível abrir o pagamento. Tente novamente.');
          }
          try {
            sessionStorage.setItem(PAYMENT_RETURN_KEY, JSON.stringify({
              checkoutToken: paymentResult.checkoutToken,
              orderNumber: res.orderNumber,
              createdAt: new Date().toISOString(),
            }));
          } catch {
            // O retorno ainda pode usar os identificadores enviados pelo Mercado Pago.
          }
          window.location.assign(checkout.checkoutUrl);
          return;
        }
        if (typeof window !== 'undefined') {
          localStorage.removeItem(DRAFT_KEY);
        }
        const orderData = {
          orderNumber: res.orderNumber,
          whatsappUrl: res.whatsappUrl || '',
          paymentTiming: paymentResult.paymentTiming,
          paymentStatus: paymentResult.paymentStatus,
          items: cartItems.map((item) => ({ ...item })),
          totalValue: totalValue,
        };
        setResult(orderData);
        onSuccess(orderData);
      } else {
        setError(res.error || 'Erro ao finalizar agendamento.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Falha ao conectar com o servidor. Tente novamente.');
    }
  };

  return (
    <div className={styles.overlay} style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(5, 15, 32, 0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 3000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }} onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      
      <div className={styles.modal} style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '620px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }} onClick={e => e.stopPropagation()}>

        {/* CABEÇALHO ESCURO TIPO BRYZA02 (#051329) */}
        <div className={styles.header} style={{
          backgroundColor: '#051329',
          color: '#ffffff',
          padding: '24px 28px 20px',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          position: 'relative'
        }}>
          <div className={styles.headerRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div className={styles.headerCopy}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#A6CE39', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Carrinho da Loja Bryza
              </span>
              <h2 style={{ margin: '4px 0 2px', fontSize: '22px', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                {result ? 'Pedido Registrado!' : step === 1 ? 'Seus dados de contato' : step === 2 ? 'Validação de documento (CPF)' : step === 3 ? 'Endereço de entrega' : 'Confirmar agendamento'}
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}>
                {result ? 'Seu agendamento foi registrado com sucesso.' : 'Escolha pagar agora com Mercado Pago ou somente quando receber.'}
              </p>
            </div>
            
            <button
              className={styles.closeButton}
              onClick={onClose}
              disabled={loading}
              title="Fechar"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            >
              <X size={20} />
            </button>
          </div>

          {/* BARRA DE PROGRESSO DE PASSOS (1 a 4) */}
          {!result && (
            <div className={styles.progress} style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              paddingTop: '16px'
            }}>
              {[
                { s: 1, label: '1. Contato' },
                { s: 2, label: '2. Documento' },
                { s: 3, label: '3. Endereço' },
                { s: 4, label: '4. Agendamento' },
              ].map(item => {
                const isActive = step === item.s;
                const isDone = step > item.s;
                return (
                  <div
                    key={item.s}
                    onClick={() => { if (isDone || (isLoggedIn && item.s <= 4)) setStep(item.s as any); }}
                    style={{
                      fontSize: '11px',
                      fontWeight: isActive || isDone ? 700 : 500,
                      color: isActive ? '#A6CE39' : isDone ? '#ffffff' : 'rgba(255,255,255,0.4)',
                      borderBottom: isActive ? '3px solid #A6CE39' : isDone ? '3px solid rgba(255,255,255,0.6)' : '3px solid rgba(255,255,255,0.15)',
                      paddingBottom: '8px',
                      cursor: (isDone || isLoggedIn) ? 'pointer' : 'default',
                      textAlign: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {item.label}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CONTEÚDO DO CORPO DO MODAL */}
        <div className={styles.body} style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
          
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              color: '#dc2626',
              fontSize: '13.5px',
              fontWeight: 600,
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          {/* TELA DE SUCESSO DO PEDIDO */}
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                border: '1px solid #bbf7d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                color: '#16a34a'
              }}>
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                  Pedido #{result.orderNumber} Registrado!
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
                  Clique no botão abaixo para abrir o WhatsApp e enviar os detalhes do seu pedido para nossa equipe!
                </p>
              </div>

              {/* Card Resumo do Pedido */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Resumo do Pedido
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(result?.items || cartItems).map(item => (
                    <div key={`${item.kind}:${item.kind === 'produto' ? item.produto.id : item.kit.id}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                      <span style={{ color: '#0f172a', fontWeight: 600 }}>
                        {item.quantidade}x {getStoreItemName(item)}
                      </span>
                      <strong style={{ color: '#047857' }}>
                        {formatCurrency(getStoreItemPrice(item) * item.quantidade)}
                      </strong>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Valor Total</span>
                  <strong style={{ fontSize: '18px', color: '#009845', fontWeight: 800 }}>
                    {formatCurrency(result?.totalValue ?? totalValue)}
                  </strong>
                </div>
              </div>

              {/* Botão de WhatsApp */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                <a
                  href={result.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    backgroundColor: '#25d366',
                    color: '#ffffff',
                    textDecoration: 'none',
                    fontSize: '16px',
                    fontWeight: 800,
                    padding: '16px 24px',
                    borderRadius: '14px',
                    boxShadow: '0 8px 24px rgba(37,211,102,0.35)',
                    transition: 'transform 0.2s'
                  }}
                >
                  <MessageCircle size={24} />
                  <span>Enviar Pedido pelo WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: 'transparent',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    color: '#64748b',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Fechar janela
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={e => e.preventDefault()}>

              {/* ETAPA 1: CONTATO */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      Informações de Contato
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      Informe seu nome e WhatsApp para identificação do pedido.
                    </p>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Seu nome completo"
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '14px',
                        color: '#0f172a',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                        WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="(00) 00000-0000"
                        value={telefone}
                        onChange={handlePhoneChange}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          borderRadius: '12px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '14px',
                          color: '#0f172a',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                        E-mail
                      </label>
                      <input
                        type="email"
                        placeholder="seu@email.com (opcional)"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          borderRadius: '12px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '14px',
                          color: '#0f172a',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={handleNextStep1}
                      style={{
                        padding: '14px 28px',
                        backgroundColor: '#A6CE39',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(166, 206, 57, 0.4)'
                      }}
                    >
                      <span>Próximo Passo</span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 2: CPF COM VALIDAÇÃO REAL-TIME */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      Validação de Documento (CPF)
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      O CPF é utilizado para a emissão do pedido e validação da entrega com segurança.
                    </p>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                      CPF (Somente números) *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={handleCpfChange}
                      maxLength={14}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '15px',
                        fontWeight: 600,
                        color: '#0f172a',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {cpfStatus === 'valid' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '10px',
                      color: '#166534',
                      fontSize: '13px',
                      fontWeight: 700
                    }}>
                      <CheckCircle2 size={18} color="#22c55e" />
                      <span>CPF VÁLIDO</span>
                    </div>
                  )}

                  {cpfStatus === 'invalid' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '10px',
                      color: '#991b1b',
                      fontSize: '13px',
                      fontWeight: 700
                    }}>
                      <XCircle size={18} color="#ef4444" />
                      <span>CPF INVÁLIDO — VERIFIQUE OS NÚMEROS DIGITADOS</span>
                    </div>
                  )}

                  <div className={styles.actionRow} style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      style={{
                        padding: '12px 20px',
                        backgroundColor: 'transparent',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        color: '#475569',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <ArrowLeft size={16} />
                      <span>Voltar</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNextStep2}
                      style={{
                        padding: '14px 28px',
                        backgroundColor: '#A6CE39',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(166, 206, 57, 0.4)'
                      }}
                    >
                      <span>Próximo Passo</span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 3: ENDEREÇO COM VIACEP */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      Endereço de Entrega
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      Digite seu CEP para preenchimento automático do endereço.
                    </p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        CEP *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCepModalOpen(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#047857',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Não sei meu CEP / Buscar por endereço
                      </button>
                    </div>

                    <input
                      type="tel"
                      required
                      placeholder="00000-000"
                      value={cep}
                      onChange={handleCepChange}
                      maxLength={9}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '15px',
                        fontWeight: 600,
                        color: '#0f172a',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {searchingCep && (
                    <div style={{ fontSize: '13px', color: '#047857', fontWeight: 600 }}>
                      🔍 Buscando CEP no ViaCEP...
                    </div>
                  )}

                  {showAddressFields && (
                    <>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                          Logradouro / Rua *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: QNN 18 Conjunto B"
                          value={endereco}
                          onChange={e => setEndereco(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#0f172a',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                            Número *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Casa 12"
                            value={numero}
                            onChange={e => setNumero(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              borderRadius: '12px',
                              border: '1.5px solid #cbd5e1',
                              fontSize: '14px',
                              color: '#0f172a',
                              outline: 'none'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                            Complemento
                          </label>
                          <input
                            type="text"
                            placeholder="Apto, Bloco (opcional)"
                            value={complemento}
                            onChange={e => setComplemento(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              borderRadius: '12px',
                              border: '1.5px solid #cbd5e1',
                              fontSize: '14px',
                              color: '#0f172a',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                          Bairro / Setor *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Ceilândia Sul"
                          value={bairro}
                          onChange={e => setBairro(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#0f172a',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                            Cidade *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Brasília"
                            value={cidade}
                            onChange={e => setCidade(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              borderRadius: '12px',
                              border: '1.5px solid #cbd5e1',
                              fontSize: '14px',
                              color: '#0f172a',
                              outline: 'none'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                            UF *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={2}
                            placeholder="DF"
                            value={estado}
                            onChange={e => setEstado(e.target.value.toUpperCase())}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              borderRadius: '12px',
                              border: '1.5px solid #cbd5e1',
                              fontSize: '14px',
                              fontWeight: 700,
                              color: '#0f172a',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className={styles.actionRow} style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      style={{
                        padding: '12px 20px',
                        backgroundColor: 'transparent',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        color: '#475569',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <ArrowLeft size={16} />
                      <span>Voltar</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNextStep3}
                      style={{
                        padding: '14px 28px',
                        backgroundColor: '#A6CE39',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(166, 206, 57, 0.4)'
                      }}
                    >
                      <span>Próximo Passo</span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 4: RESUMO & AGENDAMENTO (PREENCHIDO PARA EMBAIXADOR LOGADO) */}
              {step === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {isLoggedIn && (
                    <div style={{
                      padding: '10px 16px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '12px',
                      fontSize: '13px',
                      color: '#047857',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>✨ Usuário logado: Seus dados foram preenchidos automaticamente.</span>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#047857',
                          fontSize: '12px',
                          fontWeight: 800,
                          textDecoration: 'underline',
                          cursor: 'pointer'
                        }}
                      >
                        Editar dados
                      </button>
                    </div>
                  )}

                  {/* Resumo de Dados Pessoais & Endereço */}
                  <div style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    fontSize: '13.5px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                        Dados do Cliente & Entrega
                      </strong>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        style={{ background: 'none', border: 'none', color: '#047857', fontSize: '12px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Alterar
                      </button>
                    </div>

                    <div>
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>{nome}</span>
                      <span style={{ color: '#64748b', fontSize: '13px', marginLeft: '8px' }}>({telefone})</span>
                    </div>

                    <div style={{ color: '#475569', fontSize: '13px' }}>
                      📍 {endereco}{numero ? `, Nº ${numero}` : ''}{complemento ? ` (${complemento})` : ''} - {bairro}, {cidade}/{estado} {cep ? `(CEP: ${cep})` : ''}
                    </div>
                  </div>

                  {/* Resumo do Carrinho */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <strong style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                      Itens no Carrinho ({cartItems.length})
                    </strong>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {cartItems.map(item => (
                        <div key={`${item.kind}:${item.kind === 'produto' ? item.produto.id : item.kit.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px' }}>
                          <span style={{ color: '#0f172a', fontWeight: 600 }}>
                            {item.quantidade}x {getStoreItemName(item)}
                          </span>
                          <strong style={{ color: '#047857' }}>
                            {formatCurrency(getStoreItemPrice(item) * item.quantidade)}
                          </strong>
                        </div>
                      ))}
                    </div>

                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                        {paymentTiming === 'agora' ? 'Total para pagar agora' : 'Total a pagar na entrega'}
                      </span>
                      <strong style={{ fontSize: '20px', color: '#009845', fontWeight: 800 }}>
                        {formatCurrency(totalValue)}
                      </strong>
                    </div>
                  </div>

                  {/* Seleção de Agendamento */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                        Data de Entrega *
                      </label>
                      <select
                        value={dataAgendamento}
                        onChange={e => {
                          const value = e.target.value;
                          const selectedDay = deliveryDays.find(day => day.value === value);
                          setDataAgendamento(value);
                          setPeriodo(selectedDay?.hoje ? 'ate_3_horas' : periodo === 'ate_3_horas' ? 'manhademanha' : periodo);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '12px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: '#0f172a',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        {deliveryDays.length === 0 && (
                          <option value="">Nenhuma data disponível</option>
                        )}
                        {deliveryDays.map(d => (
                          <option
                            key={d.value}
                            value={d.value}
                            disabled={!d.disponivel && d.value !== dataAgendamento}
                          >
                            {d.label}{!d.disponivel ? ' — indisponível' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                        Período *
                      </label>
                      <select
                        value={periodo}
                        onChange={e => setPeriodo(e.target.value as typeof periodo)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '12px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: '#0f172a',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        {periodOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(schedulingLoading || schedulingError || schedulingAvailability?.success) && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      backgroundColor: schedulingError || schedulingAvailability?.automatico_ativo === false ? '#fff7ed' : '#f0fdf4',
                      border: `1px solid ${schedulingError || schedulingAvailability?.automatico_ativo === false ? '#fed7aa' : '#bbf7d0'}`,
                      color: schedulingError || schedulingAvailability?.automatico_ativo === false ? '#9a3412' : '#166534',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}>
                      {schedulingLoading
                        ? 'Atualizando disponibilidade de entrega...'
                        : schedulingError || (schedulingAvailability?.automatico_ativo === false
                          ? 'Agendamentos online temporariamente pausados.'
                          : selectedDeliveryDay?.hoje
                            ? `Seu pedido pode ser entregue em até ${schedulingAvailability?.antecedencia_mesmo_dia_horas || 3} horas.`
                          : selectedDeliveryDay?.disponivel === false
                            ? 'Esta data não está disponível para agendamento.'
                            : 'Data de entrega disponível.')}
                    </div>
                  )}

                  {/* Momento do Pagamento */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                      Quando deseja pagar?
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                      {/* Opção Pagar Agora */}
                      <button
                        type="button"
                        onClick={() => setPaymentTiming('agora')}
                        aria-pressed={paymentTiming === 'agora'}
                        style={{
                          padding: '13px 12px',
                          borderRadius: '12px',
                          border: paymentTiming === 'agora' ? '2px solid #009EE3' : '1px solid #cbd5e1',
                          backgroundColor: paymentTiming === 'agora' ? '#f0f9ff' : '#ffffff',
                          color: paymentTiming === 'agora' ? '#0369a1' : '#475569',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s ease',
                          boxShadow: paymentTiming === 'agora' ? '0 4px 12px rgba(0, 158, 227, 0.15)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <strong style={{ fontSize: '13px', color: paymentTiming === 'agora' ? '#0284c7' : '#0f172a' }}>Pagar agora</strong>
                          <span style={{ fontSize: '9.5px', fontWeight: 800, backgroundColor: '#009EE3', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.02em' }}>Recomendado</span>
                        </div>
                        <small style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                          Checkout seguro do Mercado Pago
                        </small>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.95 }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#009EE3' }}></div>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#009EE3' }}>Pix &amp; Cartões (Visa, Master, Elo...)</span>
                        </div>
                      </button>

                      {/* Opção Pagar na Entrega */}
                      <button
                        type="button"
                        onClick={() => {
                          if (paymentTiming !== 'na_entrega') {
                            setShowDeliveryWarningModal(true);
                          }
                        }}
                        aria-pressed={paymentTiming === 'na_entrega'}
                        style={{
                          padding: '13px 12px',
                          borderRadius: '12px',
                          border: paymentTiming === 'na_entrega' ? '2px solid #009845' : '1px solid #cbd5e1',
                          backgroundColor: paymentTiming === 'na_entrega' ? '#f0fdf4' : '#ffffff',
                          color: paymentTiming === 'na_entrega' ? '#047857' : '#475569',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: '13px', color: paymentTiming === 'na_entrega' ? '#047857' : '#0f172a', marginBottom: '3px' }}>
                          Pagar na entrega
                        </strong>
                        <small style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                          Pix, cartão ou dinheiro ao receber
                        </small>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#d97706', fontSize: '10px', fontWeight: 700 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>home_pin</span>
                          <span>Requer presença no local</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Banner Detalhado com Selo do Mercado Pago e Bandeiras Aceitas */}
                  {paymentTiming === 'agora' && (
                    <div style={{
                      backgroundColor: '#f0f9ff',
                      border: '1.5px solid #7dd3fc',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      marginTop: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <MercadoPagoLogoBadge />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0284c7', fontSize: '12px', fontWeight: 700 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock</span>
                          <span>Ambiente 100% Seguro</span>
                        </div>
                      </div>

                      <p style={{ margin: 0, fontSize: '12px', color: '#334155', fontWeight: 500, lineHeight: 1.4 }}>
                        Pague antecipadamente com PIX ou Cartão em até 12x com a garantia de segurança do Mercado Pago.
                      </p>

                      <div style={{ borderTop: '1px solid #e0f2fe', paddingTop: '8px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                          Formas de pagamento aceitas pelo Mercado Pago:
                        </span>
                        <AcceptedPaymentCardsBadges />
                      </div>
                    </div>
                  )}

                  {/* Forma de Pagamento na Entrega */}
                  {paymentTiming === 'na_entrega' && <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                      Forma de pagamento na entrega
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      {[
                        { id: 'PIX', label: 'Pix' },
                        { id: 'CARTAO', label: 'Cartão' },
                        { id: 'DINHEIRO', label: 'Dinheiro' },
                      ].map(method => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setFormaPagamento(method.id)}
                          style={{
                            padding: '10px',
                            borderRadius: '10px',
                            border: formaPagamento === method.id ? '2px solid #009845' : '1px solid #cbd5e1',
                            backgroundColor: formaPagamento === method.id ? '#f0fdf4' : '#ffffff',
                            color: formaPagamento === method.id ? '#047857' : '#475569',
                            fontWeight: formaPagamento === method.id ? 800 : 600,
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                    <span className="material-symbols-outlined" style={{ color: '#009845' }}>verified_user</span>
                    <span>{paymentTiming === 'agora'
                      ? 'Você será direcionado ao checkout seguro do Mercado Pago.'
                      : 'O pagamento será feito no momento da entrega dos produtos.'}</span>
                  </div>

                  {/* Botões de Ação */}
                  <div className={styles.actionRow} style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      style={{
                        padding: '14px 20px',
                        backgroundColor: 'transparent',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        color: '#475569',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Voltar
                    </button>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleSubmitOrder}
                      style={{
                        flex: 1,
                        padding: '16px 24px',
                        backgroundColor: '#94b853',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: 800,
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 6px 20px rgba(148, 184, 83, 0.4)',
                        opacity: loading ? 0.7 : 1
                      }}
                    >
                      <span>{loading ? 'PROCESSANDO…' : paymentTiming === 'agora' ? 'CONTINUAR PARA PAGAMENTO' : 'CONFIRMAR AGENDAMENTO'}</span>
                      <LockKeyhole size={20} />
                    </button>
                  </div>

                </div>
              )}

            </form>
          )}

        </div>

      </div>

      {/* SUB-MODAL BUSCA DE CEP POR ENDEREÇO */}
      {isCepModalOpen && (
        <div className={styles.cepOverlay} style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 4000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }} onClick={() => setIsCepModalOpen(false)}>
          <div className={styles.cepModal} style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Buscar CEP por Endereço
              </h3>
              <button className={styles.closeButton} aria-label="Fechar busca de CEP" onClick={() => setIsCepModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSearchCepByAddress} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>UF *</label>
                  <select
                    value={searchUf}
                    onChange={e => setSearchUf(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    {ESTADOS_BRASIL.map(e => <option key={e.sigla} value={e.sigla}>{e.sigla}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Cidade *</label>
                  <input
                    type="text"
                    value={searchCity}
                    onChange={e => setSearchCity(e.target.value)}
                    placeholder="Ex: Brasília"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Nome da Rua / Avenida *</label>
                <input
                  type="text"
                  value={searchStreet}
                  onChange={e => setSearchStreet(e.target.value)}
                  placeholder="Ex: Avenida das Castanheiras"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSearchingAddress}
                style={{
                  padding: '12px',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {isSearchingAddress ? 'Buscando...' : 'Buscar CEP'}
              </button>
            </form>

            {cepSearchError && (
              <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '12px', fontWeight: 600 }}>{cepSearchError}</p>
            )}

            {cepSearchResults.length > 0 && (
              <div style={{ marginTop: '16px', maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cepSearchResults.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectCepResult(item)}
                    style={{
                      textAlign: 'left',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      cursor: 'pointer',
                      fontSize: '12.5px'
                    }}
                  >
                    <strong>{item.cep}</strong> — {item.logradouro}, {item.bairro} ({item.localidade}/{item.uf})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-MODAL DE ALERTA: PRESENÇA NA ENTREGA */}
      {showDeliveryWarningModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(5, 15, 32, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 5000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={() => setShowDeliveryWarningModal(false)}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            maxWidth: '480px',
            width: '100%',
            padding: '28px 24px 24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>

            <button
              onClick={() => setShowDeliveryWarningModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            {/* Icon Banner */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#fef3c7',
              border: '2px solid #f59e0b',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>home_pin</span>
            </div>

            <h3 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
              Atenção: Presença no Local
            </h3>

            <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
              Ao escolher <strong>Pagar na entrega</strong>, é <strong>obrigatório que você ou alguém responsável esteja no endereço</strong> para receber os produtos e efetuar o pagamento.
            </p>

            {/* Resume Box */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '14px 16px',
              margin: '0 0 20px',
              textAlign: 'left',
              fontSize: '13px',
              color: '#334155',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#009845' }}>calendar_today</span>
                <span><strong>Data de Entrega:</strong> {selectedDeliveryDay?.label || dataAgendamento}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#009845' }}>schedule</span>
                <span><strong>Período:</strong> {getPeriodLabel(periodo, schedulingAvailability?.antecedencia_mesmo_dia_horas || 3)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setPaymentTiming('na_entrega');
                  setShowDeliveryWarningModal(false);
                }}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  backgroundColor: '#009845',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0, 152, 69, 0.35)'
                }}
              >
                Estarei no local para receber
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentTiming('agora');
                  setShowDeliveryWarningModal(false);
                }}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  backgroundColor: '#f0f9ff',
                  color: '#009EE3',
                  border: '1.5px solid #009EE3',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <MercadoPagoLogoBadge />
                <span>Preferir Pagar Agora</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
