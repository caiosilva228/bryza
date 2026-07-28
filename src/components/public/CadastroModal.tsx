'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Check, X, LockKeyhole, ArrowRight, ArrowLeft, Copy, ExternalLink, Search, MapPin, CheckCircle2, XCircle } from 'lucide-react';
import styles from './KitBryzaSalesPage.module.css';
import { cadastrarEmbaixadorPorConvite } from '@/app/cadastro/actions';

interface SponsorInfo {
  name: string;
  photo_path: string | null;
  code: string;
  city?: string | null;
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

interface CadastroModalProps {
  isOpen: boolean;
  onClose: () => void;
  sponsor: SponsorInfo;
}

export function CadastroModal({ isOpen, onClose, sponsor }: CadastroModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [complement, setComplement] = useState('');

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

  const [createdCleanPhone, setCreatedCleanPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, loading, isCepModalOpen, onClose]);

  // Phone Mask
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    setPhone(value);
  };

  // CPF Mask + Validação de Verdadeiro / Falso
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
    setCpf(value);

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

  // CEP Mask + ViaCEP Auto-Fetch + Verificação Verdadeiro/Falso
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 8);
    const cleanCep = value;
    if (value.length > 5) {
      value = `${value.slice(0, 5)}-${value.slice(5)}`;
    }
    setCep(value);
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
          setAddress(data.logradouro || '');
          setNeighborhood(data.bairro || '');
          setCity(data.localidade || '');
          setState(data.uf || '');
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

  // Abrir Modal Interno de Busca de CEP
  const handleOpenCepModal = () => {
    setSearchUf(state || '');
    setSearchCity(city || '');
    setSearchStreet('');
    setCepSearchResults([]);
    setCepSearchError('');
    setIsCepModalOpen(true);
  };

  // Buscar CEP por Endereço no ViaCEP
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
        setCepSearchError('Nenhum CEP encontrado. Tente simplificar o nome da rua ou preencher os campos manualmente.');
      }
    } catch {
      setCepSearchError('Ocorreu um erro ao pesquisar. Tente novamente.');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // Selecionar resultado do CEP
  const handleSelectCepResult = (item: { cep: string; logradouro: string; bairro: string; localidade: string; uf: string }) => {
    setCep(item.cep);
    setAddress(item.logradouro || '');
    setNeighborhood(item.bairro || '');
    setCity(item.localidade || '');
    setState(item.uf || '');
    setCepStatus('valid');
    setShowAddressFields(true);
    setIsCepModalOpen(false);
  };

  const handleNextStep1 = () => {
    setError('');
    if (!fullName.trim() || fullName.trim().length < 3) {
      setError('Por favor, informe seu nome completo.');
      return;
    }
    const cleanP = phone.replace(/\D/g, '');
    if (!cleanP || cleanP.length < 10) {
      setError('Informe um WhatsApp/telefone válido com DDD.');
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = () => {
    setError('');
    const cleanC = cpf.replace(/\D/g, '');
    if (!cleanC || cleanC.length !== 11 || !isValidCPF(cleanC)) {
      setCpfStatus('invalid');
      setError('Por favor, informe um CPF válido com 11 dígitos.');
      return;
    }
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setError('Informe um e-mail válido.');
      return;
    }
    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    if (!address.trim() || !number.trim() || !neighborhood.trim() || !city.trim() || !state.trim()) {
      setError('Por favor, preencha todos os campos do endereço (Endereço, Número, Bairro, Cidade e UF).');
      return;
    }

    setLoading(true);

    try {
      const res = await cadastrarEmbaixadorPorConvite({
        sponsorCode: sponsor.code,
        fullName,
        phone,
        cpf,
        email,
        cep,
        address,
        number,
        neighborhood,
        city,
        state,
        complement,
      });

      if (!res.success) {
        setError(res.message || 'Erro ao processar o cadastro.');
        setLoading(false);
        return;
      }

      setCreatedCleanPhone(res.cleanPhone || phone.replace(/\D/g, ''));
      setStep(4);
    } catch {
      setError('Ocorreu um erro ao enviar seu cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAndRedirect = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(createdCleanPhone);
    }
    setCopied(true);
    setTimeout(() => {
      window.location.href = 'https://ev.bryza.com.br';
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <section
        ref={modalRef}
        className={styles.orderModal}
        role="dialog"
        aria-modal="true"
      >
        <header className={styles.modalHeader}>
          <div>
            <span>PROGRAMA DE EMBAIXADORES BRYZA</span>
            <h2>{step === 4 ? 'Cadastro recebido!' : 'Cadastro de Embaixador'}</h2>
            <p>
              {step === 1 && `Convite exclusivo de ${sponsor.name}. Preencha seus dados.`}
              {step === 2 && 'Preencha seus documentos e e-mail.'}
              {step === 3 && 'Preencha seu endereço de entrega.'}
              {step === 4 && 'Sua conta de embaixador foi criada com sucesso.'}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={loading} aria-label="Fechar">
            <X />
          </button>
        </header>

        {step === 4 ? (
          <div className={styles.successState}>
            <span>
              <Check />
            </span>
            <h3>Bem-vindo ao Time Bryza!</h3>
            <p>
              Sua conta de embaixador está ativa no sistema com comissão inativa até a sua primeira qualificação.
            </p>
            <div style={{ margin: '24px auto', padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', maxWidth: '460px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>
                Seu Primeiro Acesso (Login e Senha)
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#051329', fontFamily: 'monospace', letterSpacing: '0.06em', background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px dashed #5a8216' }}>
                {createdCleanPhone}
              </div>
              <p style={{ fontSize: '13px', color: '#475569', margin: '12px 0 0 0', lineHeight: 1.4 }}>
                Para acessar o portal <strong>ev.bryza.com.br</strong>, basta colar este número de telefone nos campos de <strong>Login e Senha</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyAndRedirect}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '52px',
                padding: '0 24px',
                background: 'var(--bryza-green-600)',
                color: '#fff',
                border: 0,
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '15px',
                textTransform: 'uppercase',
                width: '100%',
                maxWidth: '460px'
              }}
            >
              <Copy size={18} />
              {copied ? 'Copiado! Redirecionando…' : 'Copiar Telefone e Ir para Espaço do Embaixador'}
              <ExternalLink size={16} />
            </button>
          </div>
        ) : (
          <form className={styles.orderForm} onSubmit={step === 3 ? handleSubmit : (e) => e.preventDefault()}>
            {error && <div className={styles.formError}>{error}</div>}

            {step === 1 && (
              <fieldset>
                <legend>Seus dados</legend>
                <div className={styles.formGrid}>
                  <label className={styles.fullField}>
                    Nome completo *
                    <input
                      type="text"
                      required
                      placeholder="Digite seu nome completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoFocus
                    />
                  </label>
                  <label className={styles.fullField}>
                    WhatsApp *
                    <input
                      type="tel"
                      required
                      placeholder="(00) 00000-0000"
                      value={phone}
                      onChange={handlePhoneChange}
                    />
                  </label>
                </div>
              </fieldset>
            )}

            {step === 2 && (
              <fieldset>
                <legend>Documentos e Contato</legend>
                <div className={styles.formGrid}>
                  <label className={styles.fullField}>
                    CPF *
                    <input
                      type="text"
                      required
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={handleCpfChange}
                      autoFocus
                      style={{
                        borderColor:
                          cpfStatus === 'valid'
                            ? '#16a34a'
                            : cpfStatus === 'invalid'
                            ? '#dc2626'
                            : undefined,
                      }}
                    />
                    {cpfStatus === 'valid' && (
                      <span style={{ fontSize: '12.5px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontWeight: 700 }}>
                        <CheckCircle2 size={16} /> CPF Válido!
                      </span>
                    )}
                    {cpfStatus === 'invalid' && (
                      <span style={{ fontSize: '12.5px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontWeight: 700 }}>
                        <XCircle size={16} /> CPF Inválido. Verifique os números digitados.
                      </span>
                    )}
                  </label>

                  <label className={styles.fullField}>
                    E-mail Principal *
                    <input
                      type="email"
                      required
                      placeholder="seuemail@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                </div>
              </fieldset>
            )}

            {step === 3 && (
              <fieldset>
                <legend>Endereço de entrega</legend>
                <div className={styles.formGrid}>
                  <label className={styles.fullField}>
                    CEP *
                    <input
                      type="text"
                      placeholder="00000-000"
                      value={cep}
                      onChange={handleCepChange}
                      autoFocus
                      required
                      style={{
                        borderColor:
                          cepStatus === 'valid'
                            ? '#16a34a'
                            : cepStatus === 'invalid'
                            ? '#dc2626'
                            : undefined,
                      }}
                    />
                    
                    {/* Verificação em Tempo Real (Verdadeiro / Falso / Buscando) */}
                    {cepStatus === 'searching' && (
                      <span style={{ fontSize: '12px', color: '#0b5ea8', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontWeight: 600 }}>
                        <Search size={13} /> Verificando CEP nos Correios...
                      </span>
                    )}
                    {cepStatus === 'valid' && (
                      <span style={{ fontSize: '12.5px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontWeight: 700 }}>
                        <CheckCircle2 size={16} /> CEP Válido! Endereço localizado.
                      </span>
                    )}
                    {cepStatus === 'invalid' && (
                      <span style={{ fontSize: '12.5px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontWeight: 700 }}>
                        <XCircle size={16} /> CEP Inválido ou não encontrado nos Correios.
                      </span>
                    )}
                  </label>

                  {!showAddressFields && (
                    <div className={styles.fullField} style={{ marginTop: '-4px', marginBottom: '8px' }}>
                      <button
                        type="button"
                        onClick={handleOpenCepModal}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0b5ea8',
                          fontSize: '13px',
                          fontWeight: 600,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Search size={14} /> Não sei meu CEP / Buscar por endereço
                      </button>
                    </div>
                  )}

                  {showAddressFields && (
                    <>
                      <label className={styles.fullField}>
                        Endereço / Logradouro *
                        <input
                          type="text"
                          placeholder="Rua, Avenida..."
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          required
                        />
                      </label>

                      <label>
                        Número *
                        <input
                          type="text"
                          placeholder="123"
                          value={number}
                          onChange={(e) => setNumber(e.target.value)}
                          required
                        />
                      </label>

                      <label>
                        Complemento
                        <input
                          type="text"
                          placeholder="Opcional (Apto, Bloco)"
                          value={complement}
                          onChange={(e) => setComplement(e.target.value)}
                        />
                      </label>

                      <label>
                        Bairro *
                        <input
                          type="text"
                          placeholder="Seu bairro"
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          required
                        />
                      </label>

                      <label>
                        Cidade *
                        <input
                          type="text"
                          placeholder="Cidade"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          required
                        />
                      </label>

                      <label>
                        UF *
                        <select
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          style={{ color: '#0f172a', background: '#ffffff' }}
                          required
                        >
                          <option value="">UF</option>
                          {ESTADOS_BRASIL.map((est) => (
                            <option key={est.sigla} value={est.sigla}>
                              {est.sigla}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className={styles.fullField} style={{ marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={handleOpenCepModal}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            fontSize: '12px',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Search size={12} /> Buscar CEP por nome de rua
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </fieldset>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setStep((step - 1) as 1 | 2);
                  }}
                  disabled={loading}
                  style={{
                    minHeight: '54px',
                    padding: '0 20px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    textTransform: 'uppercase',
                    fontSize: '13px'
                  }}
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
              )}

              {step === 1 && (
                <button
                  type="button"
                  className={styles.submitOrder}
                  onClick={handleNextStep1}
                >
                  Avançar para Próxima Etapa <ArrowRight size={16} />
                </button>
              )}

              {step === 2 && (
                <button
                  type="button"
                  className={styles.submitOrder}
                  onClick={handleNextStep2}
                >
                  Avançar para Próxima Etapa <ArrowRight size={16} />
                </button>
              )}

              {step === 3 && (
                <button
                  type="submit"
                  className={styles.submitOrder}
                  disabled={loading}
                >
                  {loading ? 'Finalizando cadastro…' : 'Concluir Cadastro'} <LockKeyhole />
                </button>
              )}
            </div>
            <small className={styles.privacyNote}>
              Seus dados serão usados apenas para a criação da conta de embaixador e atendimento.
            </small>
          </form>
        )}
      </section>

      {/* Modal Interno de Consulta de CEP por Endereço */}
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
          onMouseDown={(e) => {
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
            {/* Cabeçalho do Sub-Modal */}
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

            {/* Formulário de Pesquisa */}
            <form onSubmit={handleSearchCepByAddress} style={{ padding: '20px 22px 16px' }}>
              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px', lineHeight: 1.4 }}>
                Informe o estado, a cidade e o nome da sua rua para localizar seu CEP sem sair da página:
              </p>

              {cepSearchError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px' }}>
                  {cepSearchError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  UF *
                  <select
                    value={searchUf}
                    onChange={(e) => setSearchUf(e.target.value)}
                    style={{ minHeight: '44px', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '15px', color: '#0f172a', background: '#ffffff' }}
                    required
                  >
                    <option value="">UF</option>
                    {ESTADOS_BRASIL.map((est) => (
                      <option key={est.sigla} value={est.sigla}>
                        {est.sigla}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  Cidade *
                  <input
                    type="text"
                    placeholder="Ex: Goiânia"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                    style={{ minHeight: '44px', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '15px', color: '#0f172a' }}
                    required
                  />
                </label>
              </div>

              <label style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
                Nome da Rua / Avenida *
                <input
                  type="text"
                  placeholder="Ex: Paulista ou Rua das Flores"
                  value={searchStreet}
                  onChange={(e) => setSearchStreet(e.target.value)}
                  style={{ minHeight: '44px', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '15px', color: '#0f172a' }}
                  required
                />
              </label>

              <button
                type="submit"
                disabled={isSearchingAddress}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  background: '#0b5ea8',
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <Search size={16} />
                {isSearchingAddress ? 'Localizando CEP...' : 'Buscar CEP'}
              </button>
            </form>

            {/* Lista de Resultados */}
            {cepSearchResults.length > 0 && (
              <div style={{ padding: '0 22px 20px', borderTop: '1px solid #e2e8f0', marginTop: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: '14px 0 10px' }}>
                  Resultados Encontrados ({cepSearchResults.length}) — Toque para selecionar:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                  {cepSearchResults.map((item, idx) => (
                    <button
                      key={`${item.cep}-${idx}`}
                      type="button"
                      onClick={() => handleSelectCepResult(item)}
                      style={{
                        padding: '12px 14px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#5a8216', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={15} /> {item.cep}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                          {item.logradouro}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          {item.bairro} • {item.localidade}/{item.uf}
                        </div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#0b5ea8', background: '#e0f2fe', padding: '4px 10px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                        Selecionar →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Opção de preencher tudo manualmente */}
            <div style={{ padding: '12px 22px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setShowAddressFields(true);
                  setIsCepModalOpen(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Prefiro preencher meu endereço manualmente sem CEP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
