'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  Search,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import styles from './CadastroModal.module.css';
import { cadastrarEmbaixadorPorConvite } from '@/app/cadastro/actions';

interface SponsorInfo {
  name: string;
  photo_path: string | null;
  code: string;
  city?: string | null;
}

interface CadastroModalProps {
  isOpen: boolean;
  onClose: () => void;
  sponsor: SponsorInfo;
}

export function CadastroModal({ isOpen, onClose, sponsor }: CadastroModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
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

  // ViaCEP Loading State
  const [searchingCep, setSearchingCep] = useState(false);
  const [cepFetched, setCepFetched] = useState(false);

  // Completion State
  const [createdCleanPhone, setCreatedCleanPhone] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Phone Mask: (XX) XXXXX-XXXX
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    setPhone(value);
  };

  // CPF Mask: XXX.XXX.XXX-XX
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 9) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
    } else if (value.length > 6) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    } else if (value.length > 3) {
      value = `${value.slice(0, 3)}.${value.slice(3)}`;
    }
    setCpf(value);
  };

  // CEP Mask: XXXXX-XXX + ViaCEP Fetching
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    const cleanCep = value;

    if (value.length > 5) {
      value = `${value.slice(0, 5)}-${value.slice(5)}`;
    }
    setCep(value);

    if (cleanCep.length === 8) {
      setSearchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setAddress(data.logradouro || '');
          setNeighborhood(data.bairro || '');
          setCity(data.localidade || '');
          setState(data.uf || '');
          setCepFetched(true);
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      } finally {
        setSearchingCep(false);
      }
    }
  };

  // Validation per step
  const handleNextStep1 = () => {
    setErrorMessage(null);
    if (!fullName.trim() || fullName.trim().length < 3) {
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }
    const cleanP = phone.replace(/\D/g, '');
    if (!cleanP || cleanP.length < 10) {
      setErrorMessage('Informe um WhatsApp/telefone válido com DDD (mínimo 10 dígitos).');
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = () => {
    setErrorMessage(null);
    const cleanC = cpf.replace(/\D/g, '');
    if (!cleanC || cleanC.length !== 11) {
      setErrorMessage('Informe um CPF válido com 11 dígitos.');
      return;
    }
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setErrorMessage('Informe um e-mail válido.');
      return;
    }
    setStep(3);
  };

  // Final Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
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
        setErrorMessage(res.message || 'Ocorreu um erro no cadastro. Tente novamente.');
        setLoading(false);
        return;
      }

      setCreatedCleanPhone(res.cleanPhone || phone.replace(/\D/g, ''));
      setStep(4);
    } catch (err) {
      setErrorMessage('Ocorreu um erro ao enviar seu cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAndRedirect = () => {
    const textToCopy = createdCleanPhone;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy);
    }
    setCopied(true);

    setTimeout(() => {
      window.location.href = 'https://ev.bryza.com.br';
    }, 1000);
  };

  if (!isOpen) return null;

  const sponsorInitial = sponsor.name ? sponsor.name.charAt(0).toUpperCase() : 'B';

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        {step !== 4 && (
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar modal">
            <X size={18} />
          </button>
        )}

        {/* Header com Informação do Embaixador que Indicou */}
        {step !== 4 && (
          <div className={styles.header}>
            <div className={styles.sponsorCard}>
              {sponsor.photo_path ? (
                <Image
                  src={sponsor.photo_path}
                  alt={sponsor.name}
                  width={44}
                  height={44}
                  className={styles.sponsorAvatar}
                />
              ) : (
                <div className={styles.sponsorAvatar}>{sponsorInitial}</div>
              )}
              <div className={styles.sponsorMeta}>
                <span className={styles.sponsorBadge}>CONVITE DE EMBAIXADOR</span>
                <span className={styles.sponsorName}>{sponsor.name} convidou você</span>
              </div>
            </div>

            <h2 className={styles.modalTitle}>Cadastro de Novo Embaixador</h2>
            <p className={styles.modalSubtitle}>
              {step === 1 && 'Etapa 1 de 3: Seus dados de identificação'}
              {step === 2 && 'Etapa 2 de 3: Documento e contato principal'}
              {step === 3 && 'Etapa 3 de 3: Endereço para entregas'}
            </p>
          </div>
        )}

        {/* Barra de Progresso */}
        {step !== 4 && (
          <div className={styles.progressTrack}>
            <div
              className={styles.progressBar}
              style={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}
            />
          </div>
        )}

        {/* Formulário — Etapas 1, 2, 3 */}
        {step !== 4 ? (
          <form onSubmit={step === 3 ? handleSubmit : (e) => e.preventDefault()} className={styles.body}>
            {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}

            {/* STEP 1: Nome e WhatsApp */}
            {step === 1 && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="fullName">
                    Nome Completo
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    className={styles.input}
                    placeholder="Digite seu nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="phone">
                    WhatsApp / Telefone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    className={styles.input}
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={handlePhoneChange}
                    required
                  />
                </div>
              </>
            )}

            {/* STEP 2: CPF e Email */}
            {step === 2 && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="cpf">
                    CPF (Somente números)
                  </label>
                  <input
                    id="cpf"
                    type="text"
                    className={styles.input}
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCpfChange}
                    autoFocus
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="email">
                    E-mail Principal
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={styles.input}
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {/* STEP 3: CEP e Endereço */}
            {step === 3 && (
              <>
                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="cep">
                      CEP
                    </label>
                    <span className={styles.optionalTag}>(Opcional)</span>
                  </div>
                  <input
                    id="cep"
                    type="text"
                    className={styles.input}
                    placeholder="00000-000"
                    value={cep}
                    onChange={handleCepChange}
                    autoFocus
                  />
                  {searchingCep && (
                    <span className={styles.cepSearchNote}>
                      <Search size={12} className="animate-spin" /> Buscando endereço automaticamente...
                    </span>
                  )}
                  {cepFetched && !searchingCep && (
                    <span className={styles.cepSearchNote}>
                      <Check size={12} /> Endereço localizado!
                    </span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="address">
                    Endereço / Logradouro
                  </label>
                  <input
                    id="address"
                    type="text"
                    className={styles.input}
                    placeholder="Rua, Avenida, Praça..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div className={styles.gridAddress}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="number">
                      Número
                    </label>
                    <input
                      id="number"
                      type="text"
                      className={styles.input}
                      placeholder="123"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="complement">
                      Complemento
                    </label>
                    <input
                      id="complement"
                      type="text"
                      className={styles.input}
                      placeholder="Apt, Bloco..."
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="neighborhood">
                      Bairro
                    </label>
                    <input
                      id="neighborhood"
                      type="text"
                      className={styles.input}
                      placeholder="Bairro"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="city">
                      Cidade / UF
                    </label>
                    <input
                      id="city"
                      type="text"
                      className={styles.input}
                      placeholder="Cidade - UF"
                      value={city && state ? `${city} - ${state}` : city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Controls Footer */}
            <div className={styles.footer}>
              {step > 1 && (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => {
                    setErrorMessage(null);
                    setStep((step - 1) as 1 | 2);
                  }}
                  disabled={loading}
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
              )}

              {step === 1 && (
                <button type="button" className={styles.btnPrimary} onClick={handleNextStep1}>
                  Avançar para Próxima Etapa <ArrowRight size={16} />
                </button>
              )}

              {step === 2 && (
                <button type="button" className={styles.btnPrimary} onClick={handleNextStep2}>
                  Avançar para Próxima Etapa <ArrowRight size={16} />
                </button>
              )}

              {step === 3 && (
                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                  {loading ? 'Finalizando Cadastro...' : 'Concluir Cadastro'} <CheckCircle2 size={18} />
                </button>
              )}
            </div>
          </form>
        ) : (
          /* STEP 4: Tela de Sucesso & Instruções de Primeiro Acesso */
          <div className={styles.successContainer}>
            <div className={styles.successIconBadge}>
              <UserCheck size={32} />
            </div>

            <h3 className={styles.successTitle}>Bem-vindo ao Time Bryza!</h3>
            <p className={styles.successDesc}>
              Seu cadastro foi concluído com sucesso. Sua conta de embaixador está ativa no sistema com comissão inativa até a sua primeira qualificação.
            </p>

            <div className={styles.credentialCard}>
              <span className={styles.credentialTitle}>Seu Login e Senha do Primeiro Acesso</span>
              <div className={styles.phoneBox}>{createdCleanPhone}</div>

              {copied && (
                <span className={styles.copyFeedback}>
                  <Check size={14} /> Número copiado com sucesso!
                </span>
              )}

              <p className={styles.portalInstruction}>
                Para entrar no espaço do embaixador (<span className={styles.portalHighlight}>ev.bryza.com.br</span>), basta colar este número de telefone nos campos de <strong style={{ color: '#ffffff' }}>Login e Senha</strong>.
              </p>
            </div>

            <button type="button" className={styles.btnCopyAndRedirect} onClick={handleCopyAndRedirect}>
              <Copy size={18} />
              <span>{copied ? 'Redirecionando...' : 'Copiar Telefone e Ir para Espaço do Embaixador'}</span>
              <ExternalLink size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
