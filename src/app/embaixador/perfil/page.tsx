'use client';

import { useState, useEffect, useTransition } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getMeuPerfilData, atualizarMeuPerfil, getSignedProfilePhotoUrl, type AmbassadorProfileData } from '../actions';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export default function MeuPerfilPage() {
  const [data, setData] = useState<AmbassadorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Campos mutáveis
  const [phone, setPhone] = useState('');
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
  const [mapLoaded, setMapLoaded] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [pixType, setPixType] = useState<AmbassadorProfileData['pix_type']>('chave_aleatoria');
  const [pixKey, setPixKey] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

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
    const initialLat = lat || -15.793889;
    const initialLng = lng || -47.882778;
    const zoom = lat && lng ? 16 : 12;

    const container = L.DomUtil.get('map-container');
    if (container) (container as any)._leaflet_id = null;

    const map = L.map('map-container').setView([initialLat, initialLng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);

    const updateCoords = (newLat: number, newLng: number) => {
      setLat(newLat);
      setLng(newLng);
      setLatitude(newLat.toFixed(6));
      setLongitude(newLng.toFixed(6));
    };

    marker.on('dragend', () => {
      const position = marker.getLatLng();
      updateCoords(position.lat, position.lng);
    });

    map.on('click', (e: any) => {
      marker.setLatLng(e.latlng);
      updateCoords(e.latlng.lat, e.latlng.lng);
    });

    (window as any).leafletMap = map;
    (window as any).leafletMarker = marker;

    return () => map.remove();
  }, [mapLoaded, lat, lng]);

  const handleSearchAddress = async (queryText: string) => {
    if (!queryText) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryText)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        const map = (window as any).leafletMap;
        const marker = (window as any).leafletMarker;
        if (map && marker) {
          map.setView([newLat, newLng], 16);
          marker.setLatLng([newLat, newLng]);
          setLat(newLat);
          setLng(newLng);
          setLatitude(newLat.toFixed(6));
          setLongitude(newLng.toFixed(6));
        }
      } else {
        toast.error('Endereço não localizado no mapa.');
      }
    } catch (err) {
      toast.error('Erro ao pesquisar endereço.');
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
        const map = (window as any).leafletMap;
        const marker = (window as any).leafletMarker;
        if (map && marker) {
          map.setView([newLat, newLng], 16);
          marker.setLatLng([newLat, newLng]);
          setLat(newLat);
          setLng(newLng);
          setLatitude(newLat.toFixed(6));
          setLongitude(newLng.toFixed(6));
          toast.success('Localização atualizada para o dispositivo.');
        }
      },
      () => toast.error('Erro ao obter a localização do dispositivo.')
    );
  };

  const handleCepBlur = async () => {
    const cepNumeros = cep.replace(/\D/g, '');
    if (cepNumeros.length === 8) {
      setIsLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepNumeros}/json/`);
        const data = await res.json();
        if (!data.erro) {
          const logradouro = data.logradouro.toUpperCase();
          const bairroData = data.bairro.toUpperCase();
          const localidade = data.localidade.toUpperCase();
          const uf = data.uf.toUpperCase();

          setAddress(logradouro);
          setNeighborhood(bairroData);
          setCity(localidade);
          setState(uf);

          const queryStr = `${logradouro}, ${bairroData}, ${localidade}, ${uf}, Brasil`;
          setTimeout(() => handleSearchAddress(queryStr), 400);
        }
      } catch (err) {
        console.error('Erro ao buscar CEP', err);
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await getMeuPerfilData();
      setData(res);
      setPhone(res.phone);
      setInstagram(res.instagram);
      setCity(res.city);
      setState(res.state);
      setCep(res.cep || '');
      setAddress(res.address || '');
      setNumber(res.number || '');
      setNeighborhood(res.neighborhood || '');
      setLatitude(res.latitude?.toString() || '');
      setLongitude(res.longitude?.toString() || '');
      if (res.latitude) setLat(Number(res.latitude));
      if (res.longitude) setLng(Number(res.longitude));
      setPixType(res.pix_type);
      setPixKey(res.pix_key_masked);
      if (res.photo_path) {
        getSignedProfilePhotoUrl(res.photo_path).then(setPhotoUrl);
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar dados do perfil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar foto se fornecida
    if (photoFile) {
      const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMime.includes(photoFile.type)) {
        toast.error('Foto inválida. Use apenas JPEG, PNG ou WebP.');
        return;
      }
      if (photoFile.size > 5 * 1024 * 1024) {
        toast.error('A foto deve ter no máximo 5MB.');
        return;
      }
    }

    startTransition(async () => {
      try {
        let finalPhotoPath = data?.photo_path;

        if (photoFile) {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Sessão inválida');

          const ext = photoFile.name.split('.').pop();
          const uploadPath = `${user.id}/${crypto.randomUUID()}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from('ambassador-photos')
            .upload(uploadPath, photoFile);

          if (uploadErr) {
            toast.warning('Falha ao enviar a foto. Atualizando os outros dados.');
          } else {
            finalPhotoPath = uploadPath;
          }
        }

        const isPixKeyMasked = pixKey.includes('*');
        if (pixType !== data?.pix_type && isPixKeyMasked) {
          throw new Error('Ao alterar o tipo da chave Pix, informe também a nova chave.');
        }

        await atualizarMeuPerfil({
          phone,
          instagram,
          city,
          state,
          cep,
          address,
          number,
          neighborhood,
          latitude,
          longitude,
          pix_type: pixType !== data?.pix_type ? pixType : undefined,
          pix_key: isPixKeyMasked ? undefined : pixKey,
          photo_path: finalPhotoPath || undefined
        });

        toast.success('Perfil atualizado com sucesso!');
        loadProfile();
      } catch (err: any) {
        toast.error(err.message || 'Erro ao atualizar perfil.');
      }
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <div style={{ padding: '40px', textAlign: 'center' }}>Carregando perfil...</div>
      </MainLayout>
    );
  }

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
          <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700, margin: 0 }}>
            Meu Perfil
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
            Gerencie suas informações de contato, foto e dados para recebimento Pix.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{
          backgroundColor: 'var(--color-surface-container-low)',
          padding: '32px',
          borderRadius: '20px',
          border: '1px solid var(--color-outline-variant)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Dados Fixo Imutáveis */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
              Dados do Seu Cadastro (Protegidos)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Código do Embaixador</label>
                <input type="text" value={data?.referral_code || ''} disabled style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', cursor: 'not-allowed', fontFamily: 'monospace', fontWeight: 700 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Nome de Exibição</label>
                <input type="text" value={data?.display_name || ''} disabled style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', cursor: 'not-allowed' }} />
              </div>
            </div>
          </div>

          {/* Dados Mutáveis */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
              Informações de Contato & Localização
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Telefone / WhatsApp</label>
                <input type="text" value={phone} onChange={e => {
                  let v = e.target.value.replace(/\D/g, '');
                  if (v.length <= 11) {
                    v = v.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
                  }
                  setPhone(v.slice(0, 15));
                }} placeholder="(00) 00000-0000" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} maxLength={15} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Instagram</label>
                <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@seu.usuario" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>CEP {isLoadingCep && <span style={{ fontSize: '11px', color: 'var(--color-tertiary)', fontWeight: 'normal' }}>(Buscando...)</span>}</label>
                <input type="text" value={cep} onChange={e => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))} onBlur={handleCepBlur} placeholder="Ex: 00000000" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Logradouro / Rua</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value.toUpperCase())} placeholder="Ex: RUA DAS FLORES" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Número / Complemento</label>
                <input type="text" value={number} onChange={e => setNumber(e.target.value.toUpperCase())} placeholder="Ex: 123" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Bairro</label>
                <input type="text" value={neighborhood} onChange={e => setNeighborhood(e.target.value.toUpperCase())} placeholder="Ex: CENTRO" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Cidade</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value.toUpperCase())} list="cidades-list" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Estado (UF)</label>
                <input type="text" value={state} onChange={e => setState(e.target.value.toUpperCase())} list="estados-list" maxLength={2} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
                <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                  Clique no mapa ou arraste o pino para definir a latitude e longitude. Você também pode buscar um endereço específico ou usar a localização do seu dispositivo.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 300px', display: 'flex', gap: '8px' }}>
                    <input 
                      id="search-address-input"
                      type="text" 
                      placeholder="EX: RUA FLORIANO PEIXOTO, 100, CIDADE OCIDENTAL, GO" 
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchAddress((e.target as HTMLInputElement).value);
                        }
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('search-address-input') as HTMLInputElement;
                        if (el) handleSearchAddress(el.value);
                      }}
                      style={{
                        backgroundColor: 'var(--color-primary-container)',
                        color: 'var(--color-on-primary-container)',
                        border: '1px solid var(--color-outline-variant)',
                        borderRadius: '8px',
                        padding: '0 16px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '12px'
                      }}
                    >
                      Buscar
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
                      borderRadius: '8px',
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '12px'
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
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Latitude</label>
                <input type="text" value={latitude} readOnly placeholder="Clique no mapa..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Longitude</label>
                <input type="text" value={longitude} readOnly placeholder="Clique no mapa..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }} />
              </div>
            </div>
          </div>

          {/* Informações de Pagamento Pix */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
              Dados de Recebimento Pix
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Tipo de Chave</label>
                <select disabled={!data?.allow_pix_edit || data?.require_pix_change_approval} value={pixType} onChange={e => setPixType(e.target.value as AmbassadorProfileData['pix_type'])} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                  <option value="chave_aleatoria">Chave Aleatória / Outro</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Chave Pix *</label>
                <input disabled={!data?.allow_pix_edit || data?.require_pix_change_approval} required type="text" value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="Digite sua chave Pix" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-error, #B3261E)', marginTop: '8px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>info</span>
              Obrigatório: A conta bancária (Chave Pix) deve estar obrigatoriamente no seu nome (da pessoa cadastrada).
            </p>
          </div>

          {/* Foto de Perfil */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
              Foto de Perfil
            </h3>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: 'var(--color-surface-container-high)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-primary)', flexShrink: 0 }}>
                {photoUrl ? (
                  <img src={photoUrl} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--color-outline)' }}>person</span>
                )}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                style={{ fontSize: '13px', color: 'var(--color-on-surface)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '12px 28px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                border: 'none',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              {isPending ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
