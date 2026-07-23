'use client';

import { useState, useEffect, useTransition } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getReferralUrl } from '@/utils/env';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { editarEmbaixador } from '../actions';
import { toast } from 'sonner';

export default function NovoEmbaixadorPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [sponsors, setSponsors] = useState<{ id: string; full_name: string; username: string; cpf: string; referral_code: string }[]>([]);
  const [sponsorSearch, setSponsorSearch] = useState('');
  
  // Estados do formulário
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [cpf, setCpf] = useState('');
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
  const [planId, setPlanId] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [status, setStatus] = useState('pendente');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Estados de confirmação
  const [createdData, setCreatedData] = useState<{
    username: string;
    phoneClean: string;
    referralLink: string;
  } | null>(null);

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
  }, [mapLoaded]);

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
    const loadSelectData = async () => {
      const supabase = createClient();
      
      // Buscar Planos
      const { data: plansData } = await supabase
        .from('commission_plans')
        .select('id, name')
        .eq('status', 'ativo')
        .order('name');
      if (plansData) {
        setPlans(plansData);
        const { data: settings } = await supabase
          .from('ambassador_program_settings')
          .select('default_commission_plan_id')
          .eq('singleton', true)
          .maybeSingle();
        const defaultPlan = plansData.find(plan => plan.id === settings?.default_commission_plan_id);
        if (defaultPlan) setPlanId(defaultPlan.id);
        else if (plansData.length > 0) setPlanId(plansData[0].id);
      }

      // Buscar Embaixadores para Patrocinadores
      const { data: ambData } = await supabase
        .from('ambassadors')
        .select('id, full_name, username, cpf, referral_code')
        .eq('status', 'ativo')
        .order('full_name');
      if (ambData) setSponsors(ambData);
    };

    loadSelectData();
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cpfClean = cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) {
      toast.error('O CPF deve conter exatamente 11 dígitos.');
      return;
    }

    const phoneClean = phone.replace(/\D/g, '');
    if (!/^\d{10,11}$/.test(phoneClean)) {
      toast.error('Informe um telefone válido com DDD.');
      return;
    }

    // Validar foto
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
        // 1. Chamar API de criação
        const response = await fetch('/api/embaixadores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName,
            display_name: displayName,
            cpf: cpfClean,
            phone,
            email,
            instagram,
            city,
            state,
            cep,
            address,
            number,
            neighborhood,
            latitude,
            longitude,
            pix_type: pixType,
            pix_key: pixKey,
            commission_plan_id: planId,
            parent_ambassador_id: sponsorId || null,
            status,
            notes
          })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          toast.error(result.error || 'Erro ao cadastrar embaixador.');
          return;
        }

        const newAmb = result.data;
        let finalPhotoPath = null;

        // 2. Se houver foto selecionada, fazer upload no bucket privado
        if (photoFile) {
          const supabase = createClient();
          const fileExt = photoFile.name.split('.').pop();
          const randomName = `${crypto.randomUUID()}.${fileExt}`;
          // Caminho físico: ambassador-photos/user_id/random-uuid.jpg
          // Observação: newAmb.id ou user_id pode ser usado. Usaremos o id do embaixador para organização
          const uploadPath = `${newAmb.id}/${randomName}`;

          const { error: uploadError } = await supabase.storage
            .from('ambassador-photos')
            .upload(uploadPath, photoFile);

          if (uploadError) {
            console.error('Erro no upload de foto:', uploadError);
            toast.warning('Cadastro realizado, mas falhou ao fazer upload da foto.');
          } else {
            finalPhotoPath = uploadPath;
            // Atualizar o photo_path no cadastro
            await editarEmbaixador(newAmb.id, {
              full_name: fullName,
              display_name: displayName,
              phone,
              email,
              instagram,
              city,
              state,
              pix_type: pixType,
              pix_key: pixKey,
              notes,
              photo_path: finalPhotoPath
            });
          }
        }

        toast.success('Embaixador cadastrado com sucesso!');
        
        // 3. Exibir tela de confirmação
        setCreatedData({
          username: newAmb.username,
          phoneClean,
          referralLink: getReferralUrl(newAmb.username)
        });

      } catch (err: any) {
        toast.error('Erro de conexão ao salvar embaixador.');
      }
    });
  };

  if (createdData) {
    return (
      <MainLayout>
        <div style={{ maxWidth: '600px', margin: '40px auto' }}>
          <div style={{
            backgroundColor: 'var(--color-surface-container-low)',
            padding: '40px',
            borderRadius: '24px',
            border: '1px solid var(--color-outline-variant)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '64px', color: 'var(--color-success, #059669)' }}>check_circle</span>
            </div>
            
            <div>
              <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '24px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '8px' }}>
                Cadastro Confirmado!
              </h2>
              <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px' }}>
                O embaixador foi criado com sucesso no sistema. Copie as credenciais abaixo para enviar ao usuário.
              </p>
            </div>

            <div style={{
              backgroundColor: 'var(--color-surface-container-high)',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid var(--color-outline-variant)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'left'
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>USUÁRIO</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)' }}>{createdData.username}</span>
                  <button 
                    onClick={() => handleCopy(createdData.username, 'Usuário')}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>content_copy</span> Copiar
                  </button>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>SENHA INICIAL (Telefone informado)</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)' }}>{createdData.phoneClean}</span>
                  <button 
                    onClick={() => handleCopy(createdData.phoneClean, 'Senha inicial')}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>content_copy</span> Copiar
                  </button>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>LINK DE INDICAÇÃO</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-on-surface)', wordBreak: 'break-all', fontWeight: 500 }}>{createdData.referralLink}</span>
                  <button 
                    onClick={() => handleCopy(createdData.referralLink, 'Link de indicação')}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, marginLeft: '12px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>content_copy</span> Copiar
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push('/embaixadores')}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              Ir para a Listagem
            </button>
          </div>
        </div>
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
          <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700 }}>
            Novo Embaixador
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
            Preencha a ficha cadastral do novo embaixador da marca.
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
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value.toUpperCase())} required placeholder="Ex: CAIO SILVA" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Nome de Exibição</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value.toUpperCase())} placeholder="Como aparecerá na plataforma (opcional)" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>CPF (Opcional)</label>
                <input type="text" value={cpf} onChange={e => {
                  let v = e.target.value.replace(/\D/g, '');
                  v = v.replace(/(\d{3})(\d)/, '$1.$2');
                  v = v.replace(/(\d{3})(\d)/, '$1.$2');
                  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                  setCpf(v.slice(0, 14));
                }} placeholder="Ex: 123.456.789-00" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} maxLength={14} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Telefone *</label>
                <input type="text" value={phone} onChange={e => {
                  let v = e.target.value.replace(/\D/g, '');
                  if (v.length <= 11) {
                    v = v.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
                  }
                  setPhone(v.slice(0, 15));
                }} required placeholder="Ex: (11) 98888-8888" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} maxLength={15} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>E-mail de Contato *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Ex: caio@gmail.com" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Instagram</label>
                <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="Ex: @caiosilva" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
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
                  <option value="chave_aleatoria">Outro / Chave Aleatória</option>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Chave Pix *</label>
                <input type="text" value={pixKey} onChange={e => setPixKey(e.target.value)} required placeholder="Informe a chave Pix correspondente" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-error, #B3261E)', marginTop: '8px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>info</span>
              Obrigatório: A conta bancária (Chave Pix) deve estar obrigatoriamente no nome da pessoa cadastrada.
            </p>
          </div>

          {/* Seção Configuração de Plano e Acesso */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
              Configuração e Vinculação
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Plano de Comissão *</label>
                <select value={planId} onChange={e => setPlanId(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Indicado por (Opcional)</label>
                <input 
                  type="text" 
                  value={sponsorSearch} 
                  onChange={e => {
                    setSponsorSearch(e.target.value);
                    const selected = sponsors.find(s => {
                      const text = `${s.full_name} | CPF: ${s.cpf || 'N/A'} | Cód: ${s.referral_code || s.username}`;
                      return text === e.target.value;
                    });
                    if (selected) setSponsorId(selected.id);
                    else setSponsorId('');
                  }} 
                  list="sponsors-list" 
                  placeholder="Pesquise por nome, CPF ou código"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} 
                />
                <datalist id="sponsors-list">
                  {sponsors.map(s => (
                    <option key={s.id} value={`${s.full_name} | CPF: ${s.cpf || 'N/A'} | Cód: ${s.referral_code || s.username}`} />
                  ))}
                </datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Status Inicial *</label>
                <select value={status} onChange={e => setStatus(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                  <option value="pendente">Pendente (Inativo para login)</option>
                  <option value="ativo">Ativo (Permite login imediato)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Foto do Embaixador (Opcional)</label>
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
              </div>
            </div>
            
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Observações</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas operacionais internas" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical' }} />
            </div>
          </div>

          {/* Ações do Formulário */}
          <div style={{ display: 'flex', justifySelf: 'end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => router.push('/embaixadores')}
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
              {isPending ? 'Salvando...' : 'Salvar Cadastro'}
              {!isPending && <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
