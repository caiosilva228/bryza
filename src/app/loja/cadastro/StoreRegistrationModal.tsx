'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
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
  onOpenLogin?: () => void;
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

// Mapeamento de Bairros por Cidade Selecionada
const NEIGHBORHOODS_BY_CITY: Record<string, string[]> = {
  'Cidade Ocidental': [
    'Dom Bosco',
    'Centro',
    'SQF',
    'SQS',
    'SQN',
    'Jardim ABC',
    'Parque Ocidental',
    'Friburgo',
    'Nápoles',
    'Mocambinho',
    'Anhanguera',
    'São Cristóvão',
    'Estrela D\'Alva',
    'Ipê',
    'Esplanada',
    'Ocidental Club',
    'Remanso',
    'Nova Ocidental',
    'Recreio Mossoró',
    'Araguari',
  ],
  'Valparaíso de Goiás': [
    'Parque Esplanada I',
    'Parque Esplanada II',
    'Parque Esplanada III',
    'Parque Esplanada IV',
    'Parque Esplanada V',
    'Valparaíso I',
    'Valparaíso II',
    'Anhanguera A',
    'Anhanguera B',
    'Jardim Céu Azul',
    'Parque Rio Branco',
    'Morada da Serra',
    'Chácaras Anhanguera',
    'Santa Cruz',
    'Vila Guaira',
    'Ypanema',
    'Parque Marajó',
  ],
  'Luziânia': [
    'Centro',
    'Jardim Ingá',
    'Parque Estrela D\'Alva IX',
    'Parque Alvorada',
    'Jardim Zuleika',
    'Parque Mingone',
    'Vila Guaíra',
    'Jardim Central',
    'Serra Dourada',
    'Nossa Senhora do Rosário',
    'Setor Leste',
    'Setor Sul',
    'Chácaras Marajoara',
  ],
  'Novo Gama': [
    'Centro',
    'Pedregal',
    'Lago Azul',
    'Boa Vista',
    'Lunabel',
    'Novo Gama',
    'Mont Serrat',
    'Serra Dourada',
    'Alvorada',
  ],
  'Brasília': [
    'Asa Sul',
    'Asa Norte',
    'Águas Claras',
    'Taguatinga Centro',
    'Taguatinga Norte',
    'Taguatinga Sul',
    'Ceilândia Centro',
    'Ceilândia Norte',
    'Ceilândia Sul',
    'Samambaia Norte',
    'Samambaia Sul',
    'Gama',
    'Guará I',
    'Guará II',
    'Sudoeste',
    'Lago Sul',
    'Lago Norte',
    'Planaltina',
    'Sobradinho',
    'Cruzeiro',
    'Vicente Pires',
    'Noroeste',
    'Park Way',
    'Recanto das Emas',
    'Santa Maria',
    'Riacho Fundo I',
    'Riacho Fundo II',
    'São Sebastião',
    'Paranoá',
    'Itapoã',
    'Brazlândia',
    'Jardim Botânico',
    'SCIA / Estrutural',
    'SIA',
  ],
  'Formosa': [
    'Centro',
    'Formosinha',
    'Setor Abreu',
    'Parque Lago',
    'Parque Veredas',
    'Jardim Planalto',
    'Jardim América',
    'Caititu',
  ],
  'Planaltina': [
    'Centro',
    'Setor Leste',
    'Setor Norte',
    'Setor Sul',
    'Jardim Roriz',
    'Arapoanga',
    'Vale do Amanhecer',
  ],
  'Santo Antônio do Descoberto': [
    'Centro',
    'Queiroz',
    'Parque Estrela da Alva',
    'Jardim Ana Beatriz',
    'Vila Montes Claros',
  ],
  'Águas Lindas de Goiás': [
    'Centro',
    'Jardim Brasília',
    'Jardim América II',
    'Mansões Camargo',
    'Setor 01',
    'Setor 02',
    'Setor 03',
    'Setor 08',
  ],
};

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder: string;
  loading?: boolean;
}

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  loading = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!value.trim()) return options.slice(0, 40);
    const searchLower = value.toLowerCase().trim();
    return options
      .filter((opt) => opt.toLowerCase().includes(searchLower))
      .slice(0, 40);
  }, [options, value]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1 }}>
      <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={loading ? 'Carregando opções...' : placeholder}
          style={{
            width: '100%',
            height: '44px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            padding: '0 32px 0 12px',
            fontSize: '13.5px',
            fontWeight: 600,
            color: '#0f172a',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        <span
          className="material-symbols-outlined"
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#64748b',
            fontSize: '18px'
          }}
        >
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            maxHeight: '180px',
            overflowY: 'auto',
            padding: '4px'
          }}
        >
          {loading ? (
            <div style={{ padding: '8px 12px', fontSize: '12px', color: '#64748b' }}>
              Carregando opções...
            </div>
          ) : filteredOptions.length > 0 ? (
            filteredOptions.map((opt, i) => (
              <div
                key={i}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: value.toLowerCase() === opt.toLowerCase() ? 800 : 500,
                  color: value.toLowerCase() === opt.toLowerCase() ? '#009845' : '#0f172a',
                  backgroundColor: value.toLowerCase() === opt.toLowerCase() ? '#f0fdf4' : 'transparent',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (value.toLowerCase() !== opt.toLowerCase()) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (value.toLowerCase() !== opt.toLowerCase()) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {opt}
              </div>
            ))
          ) : (
            <div style={{ padding: '8px 12px', fontSize: '12px', color: '#64748b' }}>
              {options.length === 0
                ? 'Nenhum bairro cadastrado para esta cidade. Você pode digitar livremente.'
                : `Nenhuma sugestão encontrada. Pode digitar "${value}".`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  onOpenLogin,
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

  // Endereço e CEP com revelar dinâmico e auto-foco no Número (Lógica do Carrinho)
  const [cep, setCep] = useState('');
  const [cepStatus, setCepStatus] = useState<'idle' | 'searching' | 'valid' | 'invalid'>('idle');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [complement, setComplement] = useState('');
  const [showAddressFields, setShowAddressFields] = useState<boolean>(false);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Modal Grande para alerta de CPF/Telefone já cadastrado
  const [showAlreadyRegisteredModal, setShowAlreadyRegisteredModal] = useState(false);

  // Sub-modal de Busca de CEP por Endereço (com Seletor Inteligente de Cidade e Bairro)
  const [isCepModalOpen, setIsCepModalOpen] = useState(false);
  const [searchUf, setSearchUf] = useState('GO');
  const [searchCity, setSearchCity] = useState('Cidade Ocidental');
  const [searchNeighborhood, setSearchNeighborhood] = useState('');
  const [searchStreet, setSearchStreet] = useState('');
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

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
  const numberInputRef = useRef<HTMLInputElement>(null);

  // Cidades do estado selecionado (via IBGE)
  useEffect(() => {
    if (!searchUf) return;
    let isMounted = true;
    setLoadingCities(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${searchUf}/municipios`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          const names = data.map((item: any) => item.nome).sort();
          setCityOptions(names);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCityOptions(['Cidade Ocidental', 'Valparaíso de Goiás', 'Luziânia', 'Novo Gama', 'Brasília', 'Formosa', 'Planaltina']);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingCities(false);
      });

    return () => {
      isMounted = false;
    };
  }, [searchUf]);

  // Lista dinâmica de bairros EXCLUSIVAMENTE para a cidade selecionada
  const currentNeighborhoodOptions = useMemo(() => {
    if (!searchCity.trim()) return [];
    const matchedCityKey = Object.keys(NEIGHBORHOODS_BY_CITY).find(
      (key) => key.toLowerCase() === searchCity.trim().toLowerCase()
    );
    return matchedCityKey ? NEIGHBORHOODS_BY_CITY[matchedCityKey] : [];
  }, [searchCity]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        if (showAlreadyRegisteredModal) {
          setShowAlreadyRegisteredModal(false);
        } else if (isCepModalOpen) {
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
  }, [busy, isOpen, isCepModalOpen, showAlreadyRegisteredModal, onClose]);

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

  // Máscara e Validação de CEP + Consulta ViaCEP Automática (Revela Endereço & Foca no Número)
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = rawDigits;
    if (rawDigits.length > 5) {
      formatted = `${rawDigits.slice(0, 5)}-${rawDigits.slice(5)}`;
    }
    setCep(formatted);
    setCepStatus('idle');

    if (rawDigits.length < 8) {
      setShowAddressFields(false);
      return;
    }

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
          setShowAddressFields(true);

          setTimeout(() => {
            numberInputRef.current?.focus();
          }, 120);
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

  // Botão de Busca manual de CEP
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
      setShowAddressFields(true);

      setTimeout(() => {
        numberInputRef.current?.focus();
      }, 120);
    } catch {
      setCepStatus('invalid');
      setError('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
    } finally {
      setSearchingCep(false);
    }
  };

  // Abrir Modal de Busca de CEP por Endereço
  const handleOpenCepModal = () => {
    setSearchUf(state || 'GO');
    setSearchCity(city || 'Cidade Ocidental');
    setSearchNeighborhood(neighborhood || '');
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
        let filtered = data;
        if (searchNeighborhood.trim()) {
          const neighLower = searchNeighborhood.trim().toLowerCase();
          const matches = data.filter((item: any) => item.bairro?.toLowerCase().includes(neighLower));
          if (matches.length > 0) filtered = matches;
        }
        setCepSearchResults(filtered);
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
    setShowAddressFields(true);
    setIsCepModalOpen(false);

    setTimeout(() => {
      numberInputRef.current?.focus();
    }, 120);
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
      setError('Preencha o endereço completo com o número do imóvel.');
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
        // Exibir o Modal Grande na Tela se o CPF ou Telefone já possuir cadastro
        if (
          result.message.toLowerCase().includes('já possui cadastro') ||
          result.message.toLowerCase().includes('cpf') ||
          result.message.toLowerCase().includes('telefone')
        ) {
          setShowAlreadyRegisteredModal(true);
        }
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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 15, 32, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-registration-title"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* CABEÇALHO ESCURO DE ALTO IMPACTO BRYZA (#051329) */}
        <div style={{
          backgroundColor: '#051329',
          color: '#ffffff',
          padding: '24px 28px 20px',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#A6CE39', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                CADASTRO BRYZA
              </span>
              <h2 id="store-registration-title" style={{ margin: '4px 0 2px', fontSize: '22px', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                {step === 'success' ? 'Cadastro concluído!' : 'Crie sua conta de cliente'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Fechar cadastro"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s'
              }}
            >
              <X size={20} />
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 400 }}>
            Você terá acesso a compras na loja e ao Portal do Embaixador Bryza.
          </p>
        </div>

        {/* BARRA DE PROGRESSO EM VERDE BRYZA (#009845) */}
        {step !== 'success' ? (
          <div style={{ backgroundColor: '#e2e8f0', height: '4px', width: '100%', position: 'relative' }}>
            <div
              style={{
                backgroundColor: '#009845',
                height: '100%',
                width: `${progress * 25}%`,
                transition: 'width 0.3s ease-in-out'
              }}
            />
          </div>
        ) : null}

        <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error ? (
            <div style={{
              padding: '12px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }} role="alert">
              <span>{error}</span>
              {(error.toLowerCase().includes('já possui cadastro') || error.toLowerCase().includes('cpf') || error.toLowerCase().includes('telefone')) && (
                <button
                  type="button"
                  onClick={() => setShowAlreadyRegisteredModal(true)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #dc2626',
                    color: '#dc2626',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    marginLeft: '10px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Ver opções de Login
                </button>
              )}
            </div>
          ) : null}

          {step === 'referral' ? (
            <section>
              <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                Você foi indicado por um embaixador?
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
                Esta informação define corretamente a indicação e as futuras comissões.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setReferred('yes');
                    setError('');
                  }}
                  aria-pressed={referred === 'yes'}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    border: referred === 'yes' ? '2px solid #009845' : '1.5px solid #cbd5e1',
                    backgroundColor: referred === 'yes' ? '#f0fdf4' : '#ffffff',
                    color: referred === 'yes' ? '#08783e' : '#475569',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Sim, fui indicado
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReferred('no');
                    setSponsor(null);
                    setSponsorCode('');
                    setError('');
                  }}
                  aria-pressed={referred === 'no'}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    border: referred === 'no' ? '2px solid #009845' : '1.5px solid #cbd5e1',
                    backgroundColor: referred === 'no' ? '#f0fdf4' : '#ffffff',
                    color: referred === 'no' ? '#08783e' : '#475569',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Continuar sem indicação
                </button>
              </div>
              {referred === 'yes' ? (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Código do embaixador
                  </label>
                  <input
                    value={sponsorCode}
                    onChange={(event) => {
                      setSponsorCode(event.target.value.toLowerCase());
                      setSponsor(null);
                    }}
                    placeholder="Ex.: bryza123"
                    autoCapitalize="none"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '14.5px',
                      fontWeight: 600,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              ) : null}
              {sponsor ? (
                <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={18} color="#22c55e" />
                  <span>Indicação confirmada: {sponsor.name}</span>
                </div>
              ) : null}
            </section>
          ) : null}

          {step === 'personal' ? (
            <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Seus dados de contato
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Informações necessárias para faturamento e suporte ao cliente.
                </p>
              </div>

              {sponsor ? (
                <div style={{ padding: '8px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} color="#22c55e" />
                  <span>Indicado por {sponsor.name} ({sponsor.code})</span>
                </div>
              ) : null}

              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Nome completo *
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                  placeholder="Seu nome completo"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '14.5px', fontWeight: 600, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    WhatsApp *
                  </label>
                  <input
                    value={phone}
                    onChange={handlePhoneChange}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '14.5px', fontWeight: 600, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                      CPF *
                    </label>
                    {cpfStatus === 'valid' && (
                      <span style={{ fontSize: '11px', color: '#08783e', fontWeight: 800 }}>✓ VÁLIDO</span>
                    )}
                    {cpfStatus === 'invalid' && (
                      <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 800 }}>✖ INVÁLIDO</span>
                    )}
                  </div>
                  <input
                    value={cpf}
                    onChange={handleCpfChange}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: cpfStatus === 'valid' ? '1.5px solid #009845' : cpfStatus === 'invalid' ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1',
                      fontSize: '14.5px',
                      fontWeight: 600,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  E-mail principal *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '14.5px', fontWeight: 600, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </section>
          ) : null}

          {step === 'access' ? (
            <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Crie sua senha de acesso
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Essa será a sua senha única para a loja e para o Portal do Embaixador.
                </p>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Senha (mínimo de 8 caracteres) *
                </label>
                <input
                  type="password"
                  minLength={8}
                  maxLength={72}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  placeholder="Digite sua nova senha"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '14.5px', fontWeight: 600, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Confirme a senha *
                </label>
                <input
                  type="password"
                  minLength={8}
                  maxLength={72}
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Repita a senha para confirmar"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '14.5px', fontWeight: 600, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </section>
          ) : null}

          {step === 'address' ? (
            <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Endereço de entrega
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  {showAddressFields
                    ? 'Endereço localizado! Informe o número do imóvel para concluir.'
                    : 'Digite seu CEP para carregar o endereço automaticamente.'}
                </p>
              </div>

              {/* Campo CEP com Busca e Validação Automática */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    CEP *
                  </label>
                  {cepStatus === 'valid' && (
                    <span style={{ fontSize: '11px', color: '#08783e', fontWeight: 800 }}>✓ CEP LOCALIZADO</span>
                  )}
                  {cepStatus === 'invalid' && (
                    <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 800 }}>✖ CEP NÃO ENCONTRADO</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={cep}
                    onChange={handleCepChange}
                    inputMode="numeric"
                    placeholder="00000-000"
                    maxLength={9}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: cepStatus === 'valid' ? '1.5px solid #009845' : cepStatus === 'invalid' ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={findCep}
                    disabled={searchingCep}
                    style={{
                      padding: '0 20px',
                      backgroundColor: '#009845',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Search size={16} />
                    <span>{searchingCep ? 'Buscando…' : 'Buscar'}</span>
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
                    padding: '6px 0 0 0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Search size={12} /> Não sei meu CEP / Buscar por endereço
                </button>
              </div>

              {!showAddressFields && cepStatus === 'invalid' && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddressFields(true);
                      setTimeout(() => numberInputRef.current?.focus(), 100);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px dashed #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#0b5ea8',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      cursor: 'pointer'
                    }}
                  >
                    Preencher endereço manualmente
                  </button>
                </div>
              )}

              {/* Campos Revelados Automaticamente */}
              {showAddressFields && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#009845', display: 'block', marginBottom: '4px' }}>
                      Número do imóvel / casa *
                    </label>
                    <input
                      ref={numberInputRef}
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="Ex.: Casa 105, Lote 14, Apto 302..."
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1.5px solid #009845',
                        boxShadow: '0 0 0 3px rgba(0, 152, 69, 0.18)',
                        fontSize: '14.5px',
                        fontWeight: 700,
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Endereço (Rua / Avenida)
                    </label>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, Avenida, Quadra..." style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Bairro</label>
                      <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} style={{ width: '100%', padding: '12px 12px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Cidade</label>
                      <input value={city} onChange={(e) => setCity(e.target.value)} style={{ width: '100%', padding: '12px 12px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>UF</label>
                      <input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} style={{ width: '100%', padding: '12px 8px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '14px', fontWeight: 700, color: '#0f172a', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Complemento (Opcional)</label>
                    <input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Ex.: Apto 201, Bloco B" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {step === 'success' ? (
            <section style={{ textAlign: 'center', padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#dcfce7', border: '2px solid #22c55e', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>Bem-vindo à Bryza!</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
                Sua conta única foi cadastrada com sucesso com acesso de cliente e embaixador.
              </p>
              <button
                type="button"
                onClick={() => {
                  window.location.href = signedIn
                    ? '/loja/minha-conta'
                    : '/loja?login=required&retorno=/loja/minha-conta';
                }}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#009845',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 152, 69, 0.35)'
                }}
              >
                <span>{signedIn ? 'Ir para Minha Conta' : 'Entrar na minha conta'}</span>
                <ArrowRight size={18} />
              </button>
            </section>
          ) : null}

          {/* RODAPÉ DO FORMULÁRIO */}
          {step !== 'success' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              {step !== 'referral' ? (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={busy}
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
              ) : <span />}

              <button
                type="button"
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
                style={{
                  padding: '14px 28px',
                  backgroundColor: '#009845',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 152, 69, 0.35)',
                  marginLeft: 'auto'
                }}
              >
                <span>
                  {busy
                    ? 'Processando…'
                    : step === 'address'
                      ? 'Concluir cadastro'
                      : 'Continuar'}
                </span>
                {step === 'address' ? <LockKeyhole size={18} /> : <ArrowRight size={18} />}
              </button>
            </div>
          ) : null}

        </div>
      </div>

      {/* MODAL GRANDE DE ALERTA: CPF / TELEFONE JÁ POSSUI CADASTRO */}
      {showAlreadyRegisteredModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 19, 41, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 7000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowAlreadyRegisteredModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              maxWidth: '520px',
              width: '100%',
              padding: '32px 28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              textAlign: 'center',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '18px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowAlreadyRegisteredModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            {/* Ícone de Destaque Vermelho/Âmbar */}
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                border: '2px solid #ef4444',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(239, 68, 68, 0.25)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '42px' }}>
                account_box
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                Este CPF ou Telefone já possui cadastro!
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
                Identificamos que já existe uma conta cadastrada com esses dados no sistema Bryza.
                Você não precisa criar uma nova conta, basta entrar!
              </p>
            </div>

            {/* Box Resumo dos Dados Digitados */}
            <div
              style={{
                width: '100%',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '13px',
                color: '#334155',
                textAlign: 'left'
              }}
            >
              {cpf ? (
                <div>
                  <strong>CPF informado:</strong> {cpf}
                </div>
              ) : null}
              {phone ? (
                <div>
                  <strong>WhatsApp informado:</strong> {phone}
                </div>
              ) : null}
            </div>

            {/* Botões de Ação */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowAlreadyRegisteredModal(false);
                  onClose();
                  if (onOpenLogin) {
                    onOpenLogin();
                  } else {
                    window.location.href = '/loja?login=required&retorno=/loja/minha-conta';
                  }
                }}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#009845',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 152, 69, 0.35)'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>login</span>
                <span>Entrar na minha conta</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAlreadyRegisteredModal(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Corrigir CPF ou Telefone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL DE BUSCA DE CEP POR ENDEREÇO */}
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
            maxWidth: '580px',
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
                    onChange={(e) => {
                      setSearchUf(e.target.value);
                      setSearchCity('');
                      setSearchNeighborhood('');
                    }}
                    style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '13px', fontWeight: 600, boxSizing: 'border-box' }}
                  >
                    {ESTADOS_BRASIL.map(e => (
                      <option key={e.sigla} value={e.sigla}>{e.sigla} - {e.nome}</option>
                    ))}
                  </select>
                </div>

                <SearchableSelect
                  label="Cidade *"
                  value={searchCity}
                  onChange={(newCity) => {
                    setSearchCity(newCity);
                    setSearchNeighborhood('');
                  }}
                  options={cityOptions}
                  placeholder="Digite ou selecione a cidade..."
                  loading={loadingCities}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <SearchableSelect
                  label="Bairro (Opcional)"
                  value={searchNeighborhood}
                  onChange={setSearchNeighborhood}
                  options={currentNeighborhoodOptions}
                  placeholder={
                    searchCity.trim()
                      ? currentNeighborhoodOptions.length > 0
                        ? `Bairros de ${searchCity}...`
                        : 'Digite o bairro...'
                      : 'Selecione a cidade primeiro...'
                  }
                />

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>Rua / Avenida *</label>
                  <input
                    type="text"
                    value={searchStreet}
                    onChange={(e) => setSearchStreet(e.target.value)}
                    placeholder="Ex.: Quadra 5 ou Av. Comercial"
                    style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', fontWeight: 500, boxSizing: 'border-box' }}
                  />
                </div>
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
                  marginTop: '6px',
                  boxShadow: '0 4px 14px rgba(0, 152, 69, 0.3)'
                }}
              >
                <Search size={16} />
                {isSearchingAddress ? 'Pesquisando CEP...' : 'Pesquisar CEP'}
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
