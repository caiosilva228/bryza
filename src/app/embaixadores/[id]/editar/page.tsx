'use client';

import { useState, useEffect, useTransition, use } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getEmbaixadorDetails, editarEmbaixador } from '../../actions';
import { toast } from 'sonner';

interface Context {
  params: Promise<{ id: string }>;
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
  const [mapLoaded, setMapLoaded] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [pixType, setPixType] = useState('pix');
  const [pixKey, setPixKey] = useState('');
  const [notes, setNotes] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

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

  useEffect(() => {
    const loadData = async () => {
      try {
        const amb = await getEmbaixadorDetails(id);
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
        
        await editarEmbaixador(id, {
          full_name: fullName,
          display_name: displayName,
          phone,
          email,
          instagram,
          city,
          state,
          pix_type: pixType,
          // Se pixKey contiver asteriscos, não enviar (deixar null na action para manter o valor original, ou enviar undefined)
          pix_key: isPixKeyMasked ? undefined : pixKey,
          notes,
          photo_path: finalPhotoPath,
          cep,
          address,
          number,
          neighborhood,
          latitude,
          longitude
        });

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
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
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
                      id="search-address-input"
                      type="text" 
                      placeholder="EX: RUA FLORIANO PEIXOTO, 100, CIDADE OCIDENTAL, GO" 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }}
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
                        borderRadius: '6px',
                        padding: '0 16px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '13px'
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
