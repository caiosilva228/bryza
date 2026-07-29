'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  MapPin,
  Search,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import {
  registerStoreCustomerAmbassador,
  validateStoreSponsor,
  type StoreSponsor,
} from './actions';
import styles from './store-registration.module.css';

type Step = 'referral' | 'personal' | 'access' | 'address' | 'success';

type StoreRegistrationModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

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

function validCpf(value: string) {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export default function StoreRegistrationModal({
  isOpen,
  onClose,
}: StoreRegistrationModalProps) {
  const [step, setStep] = useState<Step>('referral');
  const [referred, setReferred] = useState<'yes' | 'no' | null>(null);
  const [sponsorCode, setSponsorCode] = useState('');
  const [sponsor, setSponsor] = useState<StoreSponsor | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cpfStatus, setCpfStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  // Endereço e CEP (com validação e máscara idêntica a /cadastro)
  const [cep, setCep] = useState('');
  const [cepStatus, setCepStatus] = useState<'idle' | 'searching' | 'valid' | 'invalid'>('idle');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [complement, setComplement] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Sub-modal de Busca de CEP por Endereço (igual /cadastro)
  const [isCepModalOpen, setIsCepModalOpen] = useState(false);
  const [searchUf, setSearchUf] = useState('DF');
  const [searchCity, setSearchCity] = useState('Brasília');
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

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        if (isCepModalOpen) {
          setIsCepModalOpen(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [busy, isOpen, isCepModalOpen, onClose]);

  if (!isOpen) return null;

  // Máscara dinâmica de Telefone / WhatsApp: (XX) XXXXX-XXXX
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = rawDigits;
    if (rawDigits.length > 7) {
      formatted = `(${rawDigits.slice(0, 2)}) ${rawDigits.slice(2, 7)}-${rawDigits.slice(7)}`;
    } else if (rawDigits.length > 2) {
      formatted = `(${rawDigits.slice(0, 2)}) ${rawDigits.slice(2)}`;
    }
    setPhone(formatted);
  };

  // Máscara e Validação de CPF: XXX.XXX.XXX-XX
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
      if (validCpf(rawDigits)) {
        setCpfStatus('valid');
      } else {
        setCpfStatus('invalid');
      }
    } else {
      setCpfStatus('idle');
    }
  };

  // Máscara e Validação de CEP + Consulta ViaCEP Automática (Modelo /cadastro)
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = rawDigits;
    if (rawDigits.length > 5) {
      formatted = `${rawDigits.slice(0, 5)}-${rawDigits.slice(5)}`;
    }
    setCep(formatted);
    setCepStatus('idle');

    if (rawDigits.length < 8) return;

    if (rawDigits.length === 8) {
      setSearchingCep(true);
      setCepStatus('searching');
      try {
        const response = await fetch(`https://viacep.com.br/ws/${rawDigits}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setAddress(data.logradouro || '');
          setNeighborhood(data.bairro || '');
          setCity(data.localidade || '');
          setState(data.uf || '');
          setCepStatus('valid');
        } else {
          setCepStatus('invalid');
        }
      } catch {
        setCepStatus('invalid');
      } finally {
        setSearchingCep(false);
      }
    }
  };

  // Abrir Modal de Busca de CEP por Endereço
  const handleOpenCepModal = () => {
    setSearchUf(state || 'DF');
    setSearchCity(city || 'Brasília');
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
      const ufEscaped = encodeURIComponent(searchUf);
      const cityEscaped = encodeURIComponent(searchCity.trim());
      const streetEscaped = encodeURIComponent(searchStreet.trim());

      const res = await fetch(`https://viacep.com.br/ws/${ufEscaped}/${cityEscaped}/${streetEscaped}/json/`);
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        setCepSearchResults(data);
      } else {
        setCepSearchError('Nenhum CEP foi encontrado para o endereço informado.');
      }
    } catch {
      setCepSearchError('Ocorreu um erro ao consultar o CEP. Tente novamente.');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleSelectCepResult = (item: {
    cep: string;
    logradouro: string;
    bairro: string;
    localidade: string;
    uf: string;
  }) => {
    const cleanCep = item.cep.replace(/\D/g, '');
    const formattedCep = cleanCep.length === 8 ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}` : item.cep;
    setCep(formattedCep);
    setAddress(item.logradouro || '');
    setNeighborhood(item.bairro || '');
    setCity(item.localidade || '');
    setState(item.uf || '');
    setCepStatus('valid');
    setIsCepModalOpen(false);
  };

  const goBack = () => {
    setError('');
    if (step === 'personal') setStep('referral');
    if (step === 'access') setStep('personal');
    if (step === 'address') setStep('access');
  };

  const continueReferral = async () => {
    setError('');
    if (!referred) {
      setError('Informe se você foi indicado por um embaixador.');
      return;
    }
    if (referred === 'no') {
      setSponsor(null);
      setSponsorCode('');
      setStep('personal');
      return;
    }
    setBusy(true);
    try {
      const result = await validateStoreSponsor(sponsorCode);
      if (!result.success) {
        setSponsor(null);
        setError(result.message);
        return;
      }
      setSponsor(result.sponsor);
      setSponsorCode(result.sponsor.code);
      setStep('personal');
    } finally {
      setBusy(false);
    }
  };

  const continuePersonal = () => {
    setError('');
    if (fullName.trim().length < 3) {
      setError('Informe seu nome completo.');
      return;
    }
    if (!/^\d{10,11}$/.test(phone.replace(/\D/g, ''))) {
      setError('Informe um WhatsApp válido no formato (00) 00000-0000.');
      return;
    }
    if (!validCpf(cpf)) {
      setError('Informe um CPF válido.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }
    setStep('access');
  };

  const continueAccess = () => {
    setError('');
    if (password.length < 8) {
      setError('Crie uma senha com pelo menos 8 caracteres.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('A confirmação da senha não confere.');
      return;
    }
    setStep('address');
  };

  const findCep = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setError('Informe um CEP com 8 dígitos.');
      return;
    }
    setSearchingCep(true);
    setError('');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepStatus('invalid');
        setError('CEP não encontrado. Você pode preencher o endereço manualmente.');
        return;
      }
      setAddress(data.logradouro || '');
      setNeighborhood(data.bairro || '');
      setCity(data.localidade || '');
      setState(data.uf || '');
      setCepStatus('valid');
    } catch {
      setCepStatus('invalid');
      setError('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
    } finally {
      setSearchingCep(false);
    }
  };

  const submitRegistration = async () => {
    setError('');
    if (
      cep.replace(/\D/g, '').length !== 8
      || !address.trim()
      || !number.trim()
      || !neighborhood.trim()
      || !city.trim()
      || state.trim().length !== 2
    ) {
      setError('Preencha o endereço completo.');
      return;
    }

    setBusy(true);
    try {
      const result = await registerStoreCustomerAmbassador({
        sponsorCode: referred === 'yes' ? sponsor?.code || sponsorCode : '',
        fullName,
        phone,
        cpf,
        email,
        password,
        passwordConfirmation,
        cep,
        address,
        number,
        neighborhood,
        city,
        state,
        complement,
      });
      if (!result.success) {
        setError(result.message);
        return;
      }
      setSignedIn(result.signedIn);
      setStep('success');
    } finally {
      setBusy(false);
    }
  };

  const progress = {
    referral: 1,
    personal: 2,
    access: 3,
    address: 4,
    success: 4,
  }[step];

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-registration-title"
      >
        <header className={styles.header}>
          <div>
            <span>CADASTRO BRYZA</span>
            <h2 id="store-registration-title">
              {step === 'success' ? 'Cadastro concluído!' : 'Crie sua conta'}
            </h2>
            <p>Você será cadastrado como cliente e embaixador.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fechar cadastro">
            <X size={22} />
          </button>
        </header>

        {step !== 'success' ? (
          <>
            <div className={styles.progress} aria-label={`Etapa ${progress} de 4`}>
              <span style={{ width: `${progress * 25}%` }} />
            </div>
            <div className={styles.stepLabel}>Etapa {progress} de 4</div>
          </>
        ) : null}

        <div className={styles.body}>
          {error ? <div className={styles.error} role="alert">{error}</div> : null}

          {step === 'referral' ? (
            <section>
              <h3>Você foi indicado por um embaixador?</h3>
              <p className={styles.intro}>
                Esta informação define corretamente a indicação e as futuras comissões.
              </p>
              <div className={styles.choiceGrid}>
                <button
                  type="button"
                  className={referred === 'yes' ? styles.choiceActive : styles.choice}
                  onClick={() => {
                    setReferred('yes');
                    setError('');
                  }}
                  aria-pressed={referred === 'yes'}
                >
                  Sim, fui indicado
                </button>
                <button
                  type="button"
                  className={referred === 'no' ? styles.choiceActive : styles.choice}
                  onClick={() => {
                    setReferred('no');
                    setSponsor(null);
                    setSponsorCode('');
                    setError('');
                  }}
                  aria-pressed={referred === 'no'}
                >
                  Continuar sem indicação
                </button>
              </div>
              {referred === 'yes' ? (
                <label className={styles.field}>
                  Código do embaixador
                  <input
                    value={sponsorCode}
                    onChange={(event) => {
                      setSponsorCode(event.target.value.toLowerCase());
                      setSponsor(null);
                    }}
                    placeholder="Ex.: bryza123"
                    autoCapitalize="none"
                    autoFocus
                  />
                </label>
              ) : null}
              {sponsor ? (
                <div className={styles.confirmed}>
                  <CheckCircle2 size={18} />
                  Indicação confirmada: {sponsor.name}
                </div>
              ) : null}
            </section>
          ) : null}

          {step === 'personal' ? (
            <section>
              <h3>Seus dados</h3>
              {sponsor ? (
                <div className={styles.confirmed}>
                  <CheckCircle2 size={18} />
                  Indicado por {sponsor.name} ({sponsor.code})
                </div>
              ) : null}
              <div className={styles.formGrid}>
                <label className={`${styles.field} ${styles.full}`}>
                  Nome completo
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" autoFocus />
                </label>

                {/* Campo WhatsApp com Máscara (00) 00000-0000 */}
                <label className={styles.field}>
                  WhatsApp
                  <input
                    value={phone}
                    onChange={handlePhoneChange}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </label>

                {/* Campo CPF com Máscara 000.000.000-00 e Validação de Status */}
                <label className={styles.field}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>CPF</span>
                    {cpfStatus === 'valid' && (
                      <span style={{ fontSize: '11px', color: '#08783e', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle2 size={13} /> CPF Válido
                      </span>
                    )}
                    {cpfStatus === 'invalid' && (
                      <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <XCircle size={13} /> CPF Inválido
                      </span>
                    )}
                  </div>
                  <input
                    value={cpf}
                    onChange={handleCpfChange}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    style={{
                      borderColor: cpfStatus === 'valid' ? '#009845' : cpfStatus === 'invalid' ? '#dc2626' : undefined
                    }}
                  />
                </label>

                <label className={`${styles.field} ${styles.full}`}>
                  E-mail
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="voce@exemplo.com" />
                </label>
              </div>
            </section>
          ) : null}

          {step === 'access' ? (
            <section>
              <h3>Crie sua senha</h3>
              <p className={styles.intro}>
                Essa será a mesma senha para a loja e para o Portal do Embaixador.
              </p>
              <div className={styles.formGrid}>
                <label className={`${styles.field} ${styles.full}`}>
                  Senha
                  <input type="password" minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
                  <small>Mínimo de 8 caracteres.</small>
                </label>
                <label className={`${styles.field} ${styles.full}`}>
                  Confirme a senha
                  <input type="password" minLength={8} maxLength={72} value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} autoComplete="new-password" />
                </label>
              </div>
            </section>
          ) : null}

          {step === 'address' ? (
            <section>
              <h3>Endereço de entrega</h3>
              <div className={styles.formGrid}>
                
                {/* Campo CEP com Máscara 00000-000, Validação e Busca por Endereço (Modelo /cadastro) */}
                <label className={styles.field}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>CEP</span>
                    {cepStatus === 'valid' && (
                      <span style={{ fontSize: '11px', color: '#08783e', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle2 size={13} /> CEP Localizado
                      </span>
                    )}
                    {cepStatus === 'invalid' && (
                      <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <XCircle size={13} /> CEP Não Encontrado
                      </span>
                    )}
                  </div>
                  <div className={styles.cepRow}>
                    <input
                      value={cep}
                      onChange={handleCepChange}
                      inputMode="numeric"
                      placeholder="00000-000"
                      maxLength={9}
                      autoFocus
                      style={{
                        borderColor: cepStatus === 'valid' ? '#009845' : cepStatus === 'invalid' ? '#dc2626' : undefined
                      }}
                    />
                    <button type="button" onClick={findCep} disabled={searchingCep}>
                      <Search size={17} />
                      {searchingCep ? 'Buscando…' : 'Buscar'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenCepModal}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0b5ea8',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '4px 0 0 0',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Search size={12} /> Não sei meu CEP / Buscar por endereço
                  </button>
                </label>

                <label className={styles.field}>
                  Número
                  <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ex.: 105" />
                </label>

                <label className={`${styles.field} ${styles.full}`}>
                  Endereço
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, Avenida, Quadra..." />
                </label>

                <label className={styles.field}>
                  Bairro
                  <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                </label>

                <label className={styles.field}>
                  Cidade
                  <input value={city} onChange={(e) => setCity(e.target.value)} />
                </label>

                <label className={styles.field}>
                  UF
                  <input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} placeholder="Ex.: DF" />
                </label>

                <label className={styles.field}>
                  Complemento
                  <input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Opcional (Apto, Bloco...)" />
                </label>
              </div>
            </section>
          ) : null}

          {step === 'success' ? (
            <section className={styles.success}>
              <span><CheckCircle2 size={36} /></span>
              <h3>Bem-vindo à Bryza!</h3>
              <p>
                Sua identidade única foi cadastrada com os papéis de cliente e
                embaixador.
              </p>
              <div className={styles.successNote}>
                {signedIn
                  ? 'Você já está conectado e pode acompanhar seus pedidos.'
                  : 'Seu cadastro foi concluído. Entre usando os dados que acabou de criar.'}
              </div>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  window.location.href = signedIn
                    ? '/loja/minha-conta'
                    : '/loja?login=required&retorno=/loja/minha-conta';
                }}
              >
                {signedIn ? 'Ir para Minha Conta' : 'Entrar na minha conta'}
                <ArrowRight size={18} />
              </button>
            </section>
          ) : null}
        </div>

        {step !== 'success' ? (
          <footer className={styles.footer}>
            {step !== 'referral' ? (
              <button type="button" className={styles.secondary} onClick={goBack} disabled={busy}>
                <ArrowLeft size={18} /> Voltar
              </button>
            ) : <span />}
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={
                step === 'referral'
                  ? continueReferral
                  : step === 'personal'
                    ? continuePersonal
                    : step === 'access'
                      ? continueAccess
                      : submitRegistration
              }
            >
              {busy
                ? 'Processando…'
                : step === 'address'
                  ? 'Concluir cadastro'
                  : 'Continuar'}
              {step === 'address' ? <LockKeyhole size={18} /> : <ArrowRight size={18} />}
            </button>
          </footer>
        ) : null}

        <div className={styles.security}>
          <UserPlus size={15} />
          Uma única conta para comprar, indicar e acompanhar comissões.
        </div>
      </div>

      {/* SUB-MODAL DE BUSCA DE CEP POR ENDEREÇO (MODELO DA PÁGINA DE /CADASTRO) */}
      {isCepModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(5, 19, 41, 0.8)',
          backdropFilter: 'blur(6px)',
          zIndex: 6000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={() => setIsCepModalOpen(false)}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} color="#009845" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Buscar CEP por Endereço
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCepModalOpen(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSearchCepByAddress} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>Estado (UF)</label>
                  <select
                    value={searchUf}
                    onChange={(e) => setSearchUf(e.target.value)}
                    style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '13px', fontWeight: 600 }}
                  >
                    {ESTADOS_BRASIL.map(e => (
                      <option key={e.sigla} value={e.sigla}>{e.sigla} - {e.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>Cidade</label>
                  <input
                    type="text"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                    placeholder="Ex.: Brasília"
                    style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', fontWeight: 500 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>Nome da Rua ou Avenida</label>
                <input
                  type="text"
                  value={searchStreet}
                  onChange={(e) => setSearchStreet(e.target.value)}
                  placeholder="Ex.: Quadra 5 ou Avenida Comercial"
                  style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', fontWeight: 500 }}
                />
              </div>

              <button
                type="submit"
                disabled={isSearchingAddress}
                style={{
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: '#009845',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '4px'
                }}
              >
                <Search size={16} />
                {isSearchingAddress ? 'Pesquisando...' : 'Pesquisar CEP'}
              </button>
            </form>

            {cepSearchError && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '12px', fontWeight: 700 }}>
                {cepSearchError}
              </div>
            )}

            {cepSearchResults.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {cepSearchResults.length} CEP(s) encontrado(s):
                </span>
                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {cepSearchResults.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectCepResult(item)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0fdf4';
                        e.currentTarget.style.borderColor = '#009845';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{item.logradouro}</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{item.bairro} - {item.localidade}/{item.uf}</span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#009845', backgroundColor: '#dcfce7', padding: '4px 8px', borderRadius: '6px' }}>
                        {item.cep}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
