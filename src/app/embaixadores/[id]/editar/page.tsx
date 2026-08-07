'use client';

import { useState, useEffect, useTransition, use, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

interface Context {
  params: Promise<{ id: string }>;
}

interface NominatimAddress {
  [key: string]: string | undefined;
}

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  type?: string;
  addresstype?: string;
  address?: NominatimAddress;
}

type GeocodeConfidence = 'exact' | 'logradouro' | 'candidato';

type RankedGeocodeResult = NominatimResult & {
  score: number;
  confidence: GeocodeConfidence;
};

interface AddressFields {
  cep: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
}

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const normalizeText = (value?: string) => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const normalizeStreet = (value?: string) => normalizeText(value)
  .replace(/\b(avenida|av)\b/g, 'av')
  .replace(/\b(rua|r)\b/g, 'r')
  .replace(/\b(alameda|al)\b/g, 'al')
  .replace(/\b(quadra|qd)\b/g, 'quadra')
  .replace(/\s+/g, ' ')
  .trim();

function streetMatches(expected?: string, actual?: string) {
  const left = normalizeStreet(expected);
  const right = normalizeStreet(actual);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const leftNumbers: string[] = left.match(/\d+/g) || [];
  const rightNumbers: string[] = right.match(/\d+/g) || [];
  if (leftNumbers.length && rightNumbers.length && leftNumbers.some((n) => !rightNumbers.includes(n))) {
    return false;
  }

  const leftWords = left.split(' ').filter((word) => word.length > 1);
  const rightWords = right.split(' ').filter((word) => word.length > 1);
  return leftWords.every((word) => rightWords.includes(word))
    || rightWords.every((word) => leftWords.includes(word));
}

function resultCity(address?: NominatimAddress) {
  return address?.city || address?.town || address?.municipality || address?.village || '';
}

function stateMatches(expected?: string, address?: NominatimAddress) {
  const normalizedExpected = normalizeText(expected);
  const resultState = normalizeText(address?.state);
  const resultCode = (address?.['ISO3166-2-lvl4'] || '').toUpperCase();
  if (!normalizedExpected) return true;
  if (normalizedExpected.length === 2 && resultCode.endsWith(`-${normalizedExpected.toUpperCase()}`)) return true;
  return Boolean(resultState && (resultState === normalizedExpected || resultState.includes(normalizedExpected)));
}

function usableHouseNumber(value?: string) {
  return Boolean(value && !/^(s\/?n|sem numero|sem n[uú]mero)$/i.test(value.trim()));
}

function houseNumberMatches(expected?: string, actual?: string) {
  if (!usableHouseNumber(expected) || !actual) return false;
  const expectedDigits = digitsOnly(expected || '');
  const actualDigits = digitsOnly(actual);
  return Boolean(expectedDigits && actualDigits && expectedDigits === actualDigits);
}

function rankGeocodeResults(
  results: NominatimResult[],
  fields: AddressFields,
  hasExplicitQuery: boolean,
) {
  const expectedStreet = normalizeStreet(fields.address);
  const expectedCity = normalizeText(fields.city);
  const expectedCep = digitsOnly(fields.cep);

  return results
    .filter((result) => Number.isFinite(Number(result.lat)) && Number.isFinite(Number(result.lon)))
    .map((result): RankedGeocodeResult => {
      const address = result.address || {};
      const road = address.road || result.name || '';
      const matchesStreet = Boolean(expectedStreet && streetMatches(fields.address, road));
      const matchesCity = Boolean(expectedCity && normalizeText(resultCity(address)) === expectedCity);
      const matchesState = stateMatches(fields.state, address);
      const resultCep = digitsOnly(address.postcode || '');
      const matchesCep = Boolean(expectedCep && resultCep && resultCep === expectedCep);
      const matchesNumber = houseNumberMatches(fields.number, address.house_number);
      const resultType = normalizeText(result.addresstype || result.type);

      let score = hasExplicitQuery ? 40 : 0;
      if (address.country_code?.toLowerCase() === 'br') score += 25;
      if (matchesCity) score += 30;
      else if (expectedCity) score -= 30;
      if (matchesState) score += 20;
      else if (fields.state) score -= 20;
      if (matchesCep) score += 45;
      else if (expectedCep && resultCep) score -= 25;
      if (expectedStreet) score += matchesStreet ? 80 : -100;
      if (usableHouseNumber(fields.number)) score += matchesNumber ? 80 : -10;
      if (['house', 'building', 'entrance'].includes(resultType)) score += 20;
      else if (resultType === 'road') score += 5;

      const confidence: GeocodeConfidence = matchesStreet && matchesNumber
        ? 'exact'
        : matchesStreet
          ? 'logradouro'
          : 'candidato';

      return { ...result, score, confidence };
    })
    .sort((a, b) => b.score - a.score);
}

export default function EditarEmbaixadorPage({ params }: Context) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  // Estados do formulário
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [cpfMasked, setCpfMasked] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [cidades, setCidades] = useState<string[]>([]);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [searchResults, setSearchResults] = useState<RankedGeocodeResult[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [pixType, setPixType] = useState('pix');
  const [pixKey, setPixKey] = useState('');
  const [notes, setNotes] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const searchRequestRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const lastSearchAtRef = useRef(0);

  const [isPending, startTransition] = useTransition();

  const ESTADOS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", 
    "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", 
    "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  useEffect(() => {
    if (state && state.length === 2 && ESTADOS.includes(state.toUpperCase())) {
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios`)
        .then(res => res.json())
        .then((data: any[]) => setCidades(data.map(c => c.nome.toUpperCase())))
        .catch(console.error);
    } else {
      setCidades([]);
    }
  }, [state]);

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setMapLoaded(true);
      document.body.appendChild(script);
    } else if ((window as any).L) {
      setMapLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!mapLoaded || !(window as any).L) return;
    const L = (window as any).L;
    const hasCoordinates = lat !== null && lng !== null;
    const initialLat = lat ?? -15.793889;
    const initialLng = lng ?? -47.882778;
    const zoom = hasCoordinates ? 16 : 12;

    const container = L.DomUtil.get('map-container');
    if (container) (container as any)._leaflet_id = null;

    const map = L.map('map-container').setView([initialLat, initialLng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const updateCoords = (newLat: number, newLng: number) => {
      setLat(newLat);
      setLng(newLng);
      setLatitude(newLat.toFixed(6));
      setLongitude(newLng.toFixed(6));
    };

    const attachDragHandler = (marker: any) => marker.on('dragend', () => {
      const position = marker.getLatLng();
      updateCoords(position.lat, position.lng);
    });

    const marker = hasCoordinates
      ? L.marker([initialLat, initialLng], { draggable: true }).addTo(map)
      : null;
    if (marker) attachDragHandler(marker);

    map.on('click', (e: any) => {
      const currentMarker = (window as any).leafletMarker;
      if (currentMarker) {
        currentMarker.setLatLng(e.latlng);
      } else {
        const newMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
        attachDragHandler(newMarker);
        (window as any).leafletMarker = newMarker;
      }
      updateCoords(e.latlng.lat, e.latlng.lng);
    });

    (window as any).leafletMap = map;
    (window as any).leafletMarker = marker;

    return () => map.remove();
  }, [mapLoaded, lat, lng]);

  const updateMapLocation = (newLat: number, newLng: number, zoom = 16) => {
    const map = (window as any).leafletMap;
    const marker = (window as any).leafletMarker;
    if (map && marker) {
      map.setView([newLat, newLng], zoom);
      marker.setLatLng([newLat, newLng]);
    }
    setLat(newLat);
    setLng(newLng);
    setLatitude(newLat.toFixed(6));
    setLongitude(newLng.toFixed(6));
  };

  const applyGeocodeResult = (result: RankedGeocodeResult, showToast = true) => {
    const newLat = Number(result.lat);
    const newLng = Number(result.lon);
    if (!Number.isFinite(newLat) || !Number.isFinite(newLng)) return false;

    updateMapLocation(newLat, newLng);
    const message = result.confidence === 'exact'
      ? 'Número do endereço localizado no OpenStreetMap.'
      : result.confidence === 'logradouro'
        ? 'Logradouro localizado. Confira e ajuste o pino para o número correto.'
        : 'Resultado localizado. Confira o ponto no mapa antes de salvar.';
    setLocationMessage(message);

    if (showToast) {
      if (result.confidence === 'exact') toast.success(message);
      else toast.info(message);
    }
    return true;
  };

  const handleSearchAddress = async (
    queryText = searchQuery,
    overrides: Partial<AddressFields> = {},
  ) => {
    const fields: AddressFields = {
      cep,
      address,
      number,
      neighborhood,
      city,
      state,
      ...overrides,
    };
    const explicitQuery = queryText.trim();
    const hasStructuredInput = Boolean(
      fields.address.trim()
      || fields.city.trim()
      || fields.state.trim()
      || digitsOnly(fields.cep),
    );

    if (!explicitQuery && !hasStructuredInput) {
      toast.error('Informe o CEP ou o endereço completo para pesquisar.');
      return;
    }

    const requestId = ++searchRequestRef.current;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setIsSearchingAddress(true);
    setSearchResults([]);
    setLocationMessage('');

    try {
      const elapsed = Date.now() - lastSearchAtRef.current;
      if (elapsed < 1000) {
        await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
      }
      if (requestId !== searchRequestRef.current) return;

      const params = new URLSearchParams();
      if (explicitQuery) {
        params.set('q', explicitQuery);
      } else {
        const street = [
          usableHouseNumber(fields.number) ? fields.number.trim() : '',
          fields.address.trim(),
        ].filter(Boolean).join(', ');
        if (street) params.set('street', street);
        if (fields.city.trim()) params.set('city', fields.city.trim());
        if (fields.state.trim()) params.set('state', fields.state.trim());
        if (digitsOnly(fields.cep).length === 8) params.set('postalcode', digitsOnly(fields.cep));
      }

      lastSearchAtRef.current = Date.now();
      const response = await fetch(`/api/geocode?${params.toString()}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Erro ao pesquisar endereço.');

      const rankingFields: AddressFields = {
        ...fields,
        ...(body.address && typeof body.address === 'object' ? body.address as Partial<AddressFields> : {}),
      };
      if (body.address) {
        setCep(rankingFields.cep);
        setAddress(rankingFields.address);
        setNeighborhood(rankingFields.neighborhood);
        setCity(rankingFields.city);
        setState(rankingFields.state);
        setSearchQuery('');
      }

      const fieldsForRanking = explicitQuery && !body.address
        ? { cep: '', address: '', number: '', neighborhood: '', city: '', state: '' }
        : rankingFields;

      const ranked = rankGeocodeResults(
        Array.isArray(body.results) ? body.results : [],
        fieldsForRanking,
        Boolean(explicitQuery),
      );
      if (requestId !== searchRequestRef.current) return;

      setSearchResults(ranked.slice(0, 5));
      const best = ranked[0];
      const minimumScore = explicitQuery
        ? 35
        : fieldsForRanking.address.trim()
          ? 80
          : digitsOnly(fieldsForRanking.cep).length === 8
            ? 70
            : 35;

      if (!best || best.score < minimumScore) {
        const message = fieldsForRanking.address.trim()
          ? 'O OpenStreetMap não encontrou esse logradouro com segurança. Confira o número, cidade e UF e ajuste o pino manualmente.'
          : 'O OpenStreetMap não encontrou uma localização segura para esse CEP. Confira o endereço e ajuste o pino manualmente.';
        setLocationMessage(message);
        toast.warning(message);
        return;
      }

      applyGeocodeResult(best);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Erro ao pesquisar endereço:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao pesquisar endereço.');
    } finally {
      if (requestId === searchRequestRef.current) setIsSearchingAddress(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada no seu navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        updateMapLocation(newLat, newLng);
        setLocationMessage('Ponto definido pela localização atual do dispositivo.');
        toast.success('Localização atualizada para o dispositivo.');
      },
      () => toast.error('Erro ao obter a localização do dispositivo.')
    );
  };

  const handleCepBlur = async () => {
    const cepNumeros = digitsOnly(cep);
    if (cepNumeros.length !== 8) return;

    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepNumeros}/json/`);
      const data = await response.json();
      if (!response.ok || data.erro) {
        toast.error('CEP não encontrado. Confira os números e tente novamente.');
        return;
      }

      const nextFields: AddressFields = {
        cep: cepNumeros,
        address: String(data.logradouro || '').toUpperCase(),
        number,
        neighborhood: String(data.bairro || '').toUpperCase(),
        city: String(data.localidade || '').toUpperCase(),
        state: String(data.uf || '').toUpperCase(),
      };

      setAddress(nextFields.address);
      setNeighborhood(nextFields.neighborhood);
      setCity(nextFields.city);
      setState(nextFields.state);
      setSearchQuery('');
      await handleSearchAddress('', nextFields);
    } catch (error) {
      console.error('Erro ao buscar CEP', error);
      toast.error('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
    } finally {
      setIsLoadingCep(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(`/api/embaixadores/${id}/editar`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.error || 'Erro ao carregar dados do embaixador.');
        }

        const amb = body.ambassador;
        setFullName(amb.full_name);
        setDisplayName(amb.display_name);
        setCpfMasked(amb.cpf_masked); // CPF vem mascarado para privacidade
        setPhone(amb.phone || '');
        setEmail(amb.email);
        setInstagram(amb.instagram || '');
        setCity(amb.city || '');
        setState(amb.state || '');
        setPixType(amb.pix_type || 'pix');
        setPixKey(amb.pix_key_masked || ''); // Pix vem mascarado para privacidade
        setNotes(amb.notes || '');
        setPhotoPath(amb.photo_path || null);
        setCep(amb.cep || '');
        setAddress(amb.address || '');
        setNumber(amb.number || '');
        setNeighborhood(amb.neighborhood || '');
        setLatitude(amb.latitude?.toString() || '');
        setLongitude(amb.longitude?.toString() || '');
        if (amb.latitude) setLat(Number(amb.latitude));
        if (amb.longitude) setLng(Number(amb.longitude));
      } catch (e: any) {
        toast.error('Erro ao carregar dados do embaixador.');
        router.push('/embaixadores');
      }
    };
    loadData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar foto se fornecida
    if (photoFile) {
      const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMime.includes(photoFile.type)) {
        toast.error('Tipo de foto inválido. Permitido apenas JPEG, PNG ou WebP.');
        return;
      }
      if (photoFile.size > 5 * 1024 * 1024) {
        toast.error('A foto deve ter no máximo 5MB.');
        return;
      }
    }

    startTransition(async () => {
      try {
        let finalPhotoPath = photoPath;

        // 1. Upload de nova foto se selecionada
        if (photoFile) {
          const supabase = createClient();
          const fileExt = photoFile.name.split('.').pop();
          const randomName = `${crypto.randomUUID()}.${fileExt}`;
          const uploadPath = `${id}/${randomName}`;

          const { error: uploadError } = await supabase.storage
            .from('ambassador-photos')
            .upload(uploadPath, photoFile);

          if (uploadError) {
            console.error('Erro no upload de foto:', uploadError);
            toast.warning('Falha ao subir imagem. Salvando outros dados.');
          } else {
            // Remover foto antiga se existia
            if (photoPath) {
              await supabase.storage.from('ambassador-photos').remove([photoPath]);
            }
            finalPhotoPath = uploadPath;
          }
        }

        // 2. Chamar action de edição (nota: CPF e Pix originais são preservados se não forem re-editados desmascarados, 
        // ou seja, a action de editar não altera CPF se ele for enviado mascarado, ou o CPF não é editável!).
        // Espera: O CPF é fixo por LGPD após cadastro. Se precisar alterar, a administração altera direto via backend.
        // A chave Pix, se não foi alterada (continua mascarada), não atualizamos a chave original no banco.
        // Vamos verificar se a chave pix contém asteriscos. Se sim, mantemos a antiga!
        const isPixKeyMasked = pixKey.includes('*');
        
        const response = await fetch(`/api/embaixadores/${id}/editar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName,
            display_name: displayName,
            phone,
            email,
            instagram,
            city,
            state,
            pix_type: pixType,
          // Se pixKey contiver asteriscos, não enviar (deixar null na action para manter o valor original, ou enviar undefined)
            pix_key: isPixKeyMasked ? null : pixKey,
            notes,
            photo_path: finalPhotoPath,
            cep,
            address,
            number,
            neighborhood,
            latitude,
            longitude,
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.error || 'Erro ao salvar alterações.');
        }

        toast.success('Cadastro atualizado com sucesso!');
        router.push(`/embaixadores/${id}`);
      } catch (err: any) {
        toast.error(err.message || 'Erro ao salvar alterações.');
      }
    });
  };

  return (
    <MainLayout>
      <datalist id="estados-list">
        {ESTADOS.map(uf => <option key={uf} value={uf} />)}
      </datalist>
      <datalist id="cidades-list">
        {cidades.map(c => <option key={c} value={c} />)}
      </datalist>

      <div style={{ maxWidth: '800px', margin: '0 auto 40px' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700 }}>
            Editar Embaixador
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
            Atualize as informações cadastrais de {fullName}.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{
          backgroundColor: 'var(--color-surface-container-low)',
          padding: '32px',
          borderRadius: '16px',
          border: '1px solid var(--color-outline-variant)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Seção Dados Cadastrais */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
              Dados Cadastrais
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Nome Completo *</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value.toUpperCase())} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Nome de Exibição</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>CPF (Não Editável)</label>
                <input type="text" value={cpfMasked} disabled style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', cursor: 'not-allowed' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Telefone</label>
                <input type="text" value={phone} onChange={e => {
                  let v = e.target.value.replace(/\D/g, '');
                  if (v.length <= 11) {
                    v = v.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
                  }
                  setPhone(v.slice(0, 15));
                }} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} maxLength={15} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>E-mail de Contato *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Instagram</label>
                <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
            </div>
          </div>

          {/* Seção Endereço */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
              Endereço e Localização
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>CEP {isLoadingCep && <span style={{ fontSize: '11px', color: 'var(--color-tertiary)', fontWeight: 'normal' }}>(Buscando...)</span>}</label>
                <input type="text" value={cep} onChange={e => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))} onBlur={handleCepBlur} placeholder="Ex: 00000000" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Logradouro / Rua</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value.toUpperCase())} placeholder="Ex: RUA DAS FLORES" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Número / Complemento</label>
                <input type="text" value={number} onChange={e => setNumber(e.target.value.toUpperCase())} placeholder="Ex: 123" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Bairro</label>
                <input type="text" value={neighborhood} onChange={e => setNeighborhood(e.target.value.toUpperCase())} placeholder="Ex: CENTRO" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Cidade</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value.toUpperCase())} list="cidades-list" placeholder="Ex: SÃO PAULO" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Estado (UF)</label>
                <input type="text" value={state} onChange={e => setState(e.target.value.toUpperCase())} list="estados-list" maxLength={2} placeholder="Ex: SP" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>
              
              <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                  Clique no mapa ou arraste o pino para definir a latitude e longitude. Você também pode buscar um endereço específico ou usar a localização do seu dispositivo.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 300px', display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="CEP ou rua + número, bairro, cidade/UF"
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchAddress();
                        }
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => handleSearchAddress()}
                      disabled={isSearchingAddress}
                      style={{
                        backgroundColor: 'var(--color-primary-container)',
                        color: 'var(--color-on-primary-container)',
                        border: '1px solid var(--color-outline-variant)',
                        borderRadius: '6px',
                        padding: '0 16px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '13px'
                      }}
                    >
                      {isSearchingAddress ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={handleGetCurrentLocation}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: 'rgba(0,86,117,0.06)',
                      color: 'var(--color-primary)',
                      border: '1px solid var(--color-primary)',
                      borderRadius: '6px',
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '13px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>my_location</span>
                    Localização Atual
                  </button>
                </div>

                <div 
                  id="map-container" 
                  style={{ 
                    height: '300px', 
                    width: '100%', 
                    borderRadius: '12px', 
                    border: '1px solid var(--color-outline-variant)', 
                    marginBottom: '20px',
                    position: 'relative',
                    zIndex: 1
                  }} 
                 />
                {locationMessage && (
                  <div style={{
                    marginTop: '-8px',
                    marginBottom: '16px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: locationMessage.includes('exato') || locationMessage.includes('Número') ? '#ecfdf5' : '#fff7ed',
                    color: locationMessage.includes('exato') || locationMessage.includes('Número') ? '#166534' : '#9a3412',
                    fontSize: '12px',
                    lineHeight: 1.45,
                  }}>
                    {locationMessage}
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gap: '8px',
                    marginBottom: '16px',
                  }}>
                    <strong style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                      Resultados encontrados — escolha um ponto se necessário:
                    </strong>
                    {searchResults.map((result, index) => (
                      <button
                        key={`${result.lat}-${result.lon}-${index}`}
                        type="button"
                        onClick={() => applyGeocodeResult(result)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          width: '100%',
                          padding: '10px 12px',
                          textAlign: 'left',
                          borderRadius: '8px',
                          border: '1px solid var(--color-outline-variant)',
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-on-surface)',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: '12px', lineHeight: 1.35 }}>
                          {result.display_name || 'Resultado sem descrição'}
                        </span>
                        <span style={{ flex: '0 0 auto', fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          Usar
                        </span>
                      </button>
                    ))}
                  </div>
                )}
               </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Latitude</label>
                <input type="text" value={latitude} readOnly placeholder="Clique no mapa..." style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Longitude</label>
                <input type="text" value={longitude} readOnly placeholder="Clique no mapa..." style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }} />
              </div>
            </div>
          </div>

          {/* Seção Informações Financeiras */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
              Informações Financeiras
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Tipo de Chave Pix</label>
                <select value={pixType} onChange={e => setPixType(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                  <option value="pix">Outro / Chave Aleatória</option>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Chave Pix *</label>
                <input 
                  type="text" 
                  value={pixKey} 
                  onChange={e => setPixKey(e.target.value)} 
                  required
                  placeholder={pixKey.includes('*') ? 'Digite uma nova chave Pix para alterar' : 'Chave Pix'}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} 
                />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-error, #B3261E)', marginTop: '8px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>info</span>
              Obrigatório: A conta bancária (Chave Pix) deve estar obrigatoriamente no nome da pessoa cadastrada.
            </p>
          </div>

          {/* Upload de Foto */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
              Alterar Foto
            </h3>
            <input 
              type="file" 
              accept="image/jpeg,image/png,image/webp" 
              onChange={e => setPhotoFile(e.target.files?.[0] || null)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-outline-variant)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-on-surface)',
                fontSize: '13px'
              }} 
            />
            {photoPath && (
              <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '6px' }}>
                Já existe uma foto cadastrada. O upload de uma nova foto substituirá a anterior.
              </p>
            )}
          </div>

          {/* Observações */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical' }} />
          </div>

          {/* Ações do Formulário */}
          <div style={{ display: 'flex', justifySelf: 'end', gap: '12px' }}>
            <button
              type="button"
              onClick={() => router.push(`/embaixadores/${id}`)}
              disabled={isPending}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid var(--color-outline)',
                background: 'transparent',
                color: 'var(--color-on-surface)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '10px 28px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isPending ? 'Salvando...' : 'Salvar Alterações'}
              {!isPending && <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
