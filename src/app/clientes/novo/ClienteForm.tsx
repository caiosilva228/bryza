'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Cliente } from '@/models/types';
import { toast } from 'sonner';

export function ClienteForm({ 
  profile, 
  vendedores, 
  isVendedor,
  initialData 
}: { 
  profile: any, 
  vendedores: any[], 
  isVendedor: boolean,
  initialData?: Cliente
}) {
  const [formData, setFormData] = useState({
    nome: initialData?.nome || '',
    telefone: initialData?.telefone || '',
    cpf: initialData?.cpf || '',
    cep: initialData?.cep || '',
    endereco: initialData?.endereco || '',
    numero: initialData?.numero || '',
    bairro: initialData?.bairro || '',
    cidade: initialData?.cidade || '',
    estado: initialData?.estado || '',
    latitude: initialData?.latitude?.toString() || '',
    longitude: initialData?.longitude?.toString() || ''
  });
  
  const [cidades, setCidades] = useState<string[]>([]);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [lat, setLat] = useState<number | null>(initialData?.latitude || null);
  const [lng, setLng] = useState<number | null>(initialData?.longitude || null);
  const router = useRouter();

  const ESTADOS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", 
    "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", 
    "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  // Buscar cidades quando estado muda
  useEffect(() => {
    if (formData.estado && formData.estado.length === 2 && ESTADOS.includes(formData.estado.toUpperCase())) {
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.estado}/municipios`)
        .then(res => res.json())
        .then((data: any[]) => {
          setCidades(data.map(c => c.nome.toUpperCase()));
        })
        .catch(console.error);
    } else {
      setCidades([]);
    }
  }, [formData.estado]);

  // Carregar Leaflet (CSS e JS) via CDN dinamicamente para evitar problemas de SSR no Next.js
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

  // Inicializar mapa do OpenStreetMap
  useEffect(() => {
    if (!mapLoaded || !(window as any).L) return;

    const L = (window as any).L;
    const initialLat = lat || -15.793889;
    const initialLng = lng || -47.882778;
    const zoom = lat && lng ? 16 : 12;

    const container = L.DomUtil.get('map-container');
    if (container) {
      (container as any)._leaflet_id = null;
    }

    const map = L.map('map-container').setView([initialLat, initialLng], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], {
      draggable: true
    }).addTo(map);

    const updateCoords = (newLat: number, newLng: number) => {
      setLat(newLat);
      setLng(newLng);
      setFormData(prev => ({
        ...prev,
        latitude: newLat.toFixed(6),
        longitude: newLng.toFixed(6)
      }));
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

    return () => {
      map.remove();
    };
  }, [mapLoaded]);

  const handleSearchAddress = async (queryText: string) => {
    if (!queryText) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryText)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const first = data[0];
        const newLat = parseFloat(first.lat);
        const newLng = parseFloat(first.lon);
        
        const map = (window as any).leafletMap;
        const marker = (window as any).leafletMarker;
        if (map && marker) {
          map.setView([newLat, newLng], 16);
          marker.setLatLng([newLat, newLng]);
          setLat(newLat);
          setLng(newLng);
          setFormData(prev => ({
            ...prev,
            latitude: newLat.toFixed(6),
            longitude: newLng.toFixed(6)
          }));
        }
      } else {
        toast.error('Endereço não localizado no mapa.');
      }
    } catch (err) {
      console.error(err);
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
          setFormData(prev => ({
            ...prev,
            latitude: newLat.toFixed(6),
            longitude: newLng.toFixed(6)
          }));
          toast.success('Localização atualizada para o dispositivo.');
        }
      },
      () => {
        toast.error('Erro ao obter a localização do dispositivo.');
      }
    );
  };

  const formatPhone = (value: string) => {
    if (!value) return "";
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers
        .replace(/^(\d{2})(\d)/g, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2")
        .slice(0, 15);
    }
    return value.slice(0, 15);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    let transformedValue = value;

    if (name === 'telefone') {
      transformedValue = formatPhone(value);
    } else if (name === 'cpf') {
      transformedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .slice(0, 14);
    } else if (e.target instanceof HTMLInputElement && e.target.type !== 'tel' && e.target.type !== 'number') {
      transformedValue = value.toUpperCase();
    }
    
    setFormData(prev => ({ ...prev, [name]: transformedValue }));
  };

  const handleCepBlur = async () => {
    const cepNumeros = formData.cep.replace(/\D/g, '');
    if (cepNumeros.length === 8) {
      setIsLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepNumeros}/json/`);
        const data = await res.json();
        if (!data.erro) {
          const logradouro = data.logradouro.toUpperCase();
          const bairro = data.bairro.toUpperCase();
          const localidade = data.localidade.toUpperCase();
          const uf = data.uf.toUpperCase();

          setFormData(prev => ({
            ...prev,
            endereco: logradouro,
            bairro: bairro,
            cidade: localidade,
            estado: uf
          }));

          // Centralizar mapa automaticamente
          const queryStr = `${logradouro}, ${bairro}, ${localidade}, ${uf}, Brasil`;
          setTimeout(() => handleSearchAddress(queryStr), 400);
        }
      } catch (err) {
        console.error('Erro ao buscar CEP', err);
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid var(--color-outline-variant)',
    fontFamily: 'var(--font-body)',
    fontSize: '16px',
    backgroundColor: 'var(--color-surface-container-lowest)',
    color: 'var(--color-on-surface)',
    marginBottom: '16px',
    textTransform: 'uppercase' as const, // Força visualmente Maiúsculas
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--color-on-surface-variant)'
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);

      if (initialData?.id) {
        formData.set('cliente_id', initialData.id);
      }

      const response = await fetch('/api/clientes', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Erro inesperado ao cadastrar o cliente.');
      }

      toast.success(result.message || 'Cliente cadastrado com sucesso.');
      router.replace('/clientes');
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast.error(error instanceof Error ? error.message : 'Erro inesperado ao cadastrar o cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <datalist id="estados-list">
        {ESTADOS.map(uf => <option key={uf} value={uf} />)}
      </datalist>
      <datalist id="cidades-list">
        {cidades.map(cidade => <option key={cidade} value={cidade} />)}
      </datalist>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Nome / Razão Social *</label>
          <input 
            type="text" 
            name="nome" 
            required 
            placeholder="EX: MERCADO COMPRE BEM LTDA" 
            style={inputStyle} 
            value={formData.nome}
            onChange={handleChange}
          />
        </div>

        <div>
          <label style={labelStyle}>Telefone / WhatsApp *</label>
          <input 
            type="tel" 
            name="telefone" 
            required 
            placeholder="(00) 00000-0000" 
            style={inputStyle} 
            value={formData.telefone}
            onChange={handleChange}
            maxLength={15}
          />
        </div>

        <div>
          <label style={labelStyle}>CPF</label>
          <input 
            type="text" 
            name="cpf" 
            placeholder="000.000.000-00" 
            style={inputStyle} 
            value={formData.cpf}
            onChange={handleChange}
            maxLength={14}
          />
        </div>

        <div>
          <label style={labelStyle}>Origem</label>
          <select name="origem" style={{...inputStyle, textTransform: 'none'}} defaultValue={initialData?.origem || 'indicacao'}>
            <option value="indicacao">Indicação</option>
            <option value="instagram">Instagram</option>
            <option value="google">Google</option>
            <option value="trafego_pago">Tráfego Pago</option>
            <option value="amostra_gratis">Amostra Grátis</option>
            <option value="visita">Visita Comercial</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        {initialData && (
          <div>
            <label style={labelStyle}>Status do Cliente</label>
            <select name="status_cliente" style={{...inputStyle, textTransform: 'none'}} defaultValue={initialData.status_cliente}>
              <option value="lead">Lead</option>
              <option value="cliente">Cliente</option>
              <option value="recorrente">Recorrente</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        )}

        <div style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', marginTop: '16px', color: 'var(--color-primary)' }}>Endereço e Localização</h3>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-outline-variant)', marginBottom: '24px' }} />
        </div>

        <div>
          <label style={labelStyle}>CEP {isLoadingCep && <span style={{ fontSize: '12px', color: 'var(--color-tertiary)', fontWeight: 'normal' }}>(Buscando...)</span>}</label>
          <input 
            type="text" 
            name="cep" 
            placeholder="EX: 00000-000" 
            style={inputStyle} 
            value={formData.cep}
            onChange={handleChange}
            onBlur={handleCepBlur}
            maxLength={9}
          />
        </div>

        <div>
          <label style={labelStyle}>Logradouro / Rua</label>
          <input 
            type="text" 
            name="endereco" 
            placeholder="EX: RUA DAS FLORES" 
            style={inputStyle}
            value={formData.endereco}
            onChange={handleChange} 
          />
        </div>

        <div>
          <label style={labelStyle}>Número / Complemento</label>
          <input 
            type="text" 
            name="numero" 
            placeholder="EX: 123 - APTO 4" 
            style={inputStyle}
            value={formData.numero}
            onChange={handleChange} 
          />
        </div>

        <div>
          <label style={labelStyle}>Bairro</label>
          <input 
            type="text" 
            name="bairro" 
            placeholder="EX: CENTRO" 
            style={inputStyle}
            value={formData.bairro}
            onChange={handleChange} 
          />
        </div>

        <div>
          <label style={labelStyle}>Cidade</label>
          <input 
            type="text" 
            name="cidade" 
            placeholder="EX: SÃO PAULO" 
            style={inputStyle}
            list="cidades-list"
            value={formData.cidade}
            onChange={handleChange} 
            autoComplete="off"
          />
        </div>

        <div>
          <label style={labelStyle}>Estado</label>
          <input 
            type="text" 
            name="estado" 
            placeholder="EX: SP" 
            style={inputStyle}
            list="estados-list"
            value={formData.estado}
            onChange={handleChange}
            maxLength={2} 
            autoComplete="off"
          />
        </div>

        {/* Geolocalização Leaflet / OpenStreetMap */}
        <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--color-primary)' }}>Mapa de Localização (OpenStreetMap)</h3>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
            Clique no mapa ou arraste o pino para definir a latitude e longitude do cliente. Você também pode buscar um endereço específico ou usar a localização do seu dispositivo.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', display: 'flex', gap: '8px' }}>
              <input 
                id="search-address-input"
                type="text" 
                placeholder="EX: RUA FLORIANO PEIXOTO, 100, CIDADE OCIDENTAL, GO" 
                style={{ ...inputStyle, marginBottom: 0, textTransform: 'none' }}
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
                  fontWeight: 700,
                  fontSize: '14px',
                  fontFamily: 'var(--font-headline)'
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
                padding: '12px 16px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                fontFamily: 'var(--font-headline)'
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
          <label style={labelStyle}>Latitude</label>
          <input 
            type="text" 
            name="latitude" 
            readOnly 
            placeholder="Clique no mapa..."
            style={{ ...inputStyle, backgroundColor: 'var(--color-surface-container)' }}
            value={formData.latitude}
          />
        </div>

        <div>
          <label style={labelStyle}>Longitude</label>
          <input 
            type="text" 
            name="longitude" 
            readOnly 
            placeholder="Clique no mapa..."
            style={{ ...inputStyle, backgroundColor: 'var(--color-surface-container)' }}
            value={formData.longitude}
          />
        </div>
        
        <div style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', marginTop: '16px', color: 'var(--color-primary)' }}>Responsável</h3>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-outline-variant)', marginBottom: '24px' }} />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Vendedor da Conta</label>
          <select 
            name="vendedor_responsavel_id" 
            style={{...inputStyle, textTransform: 'none', backgroundColor: isVendedor ? 'var(--color-surface-container)' : inputStyle.backgroundColor}}
            disabled={isVendedor}
            defaultValue={initialData?.vendedor_responsavel_id || ''}
          >
            {isVendedor ? (
              <option value={profile.id}>
                {profile.codigo_vendedor ? `V${String(profile.codigo_vendedor).padStart(5, '0')} - ` : ''}
                {profile.nome} (Você)
              </option>
            ) : (
              <>
                <option value="">Selecione um Vendedor...</option>
                {vendedores.map((vend: any) => (
                  <option key={vend.id} value={vend.id}>
                    V{String(vend.codigo_vendedor || 0).padStart(5, '0')} - {vend.nome}
                  </option>
                ))}
              </>
            )}
          </select>
          {isVendedor && (
            <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '-8px', marginBottom: '16px' }}>
              Como vendedor, você será automaticamente vinculado a este cliente. O administrador pode reagendar os vínculos posteriormente.
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '24px' }}>
        <Link href="/clientes" style={{
          color: 'var(--color-on-surface-variant)',
          padding: '12px 24px',
          textDecoration: 'none',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center'
        }}>
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontFamily: 'var(--font-headline)',
            fontWeight: 700,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.opacity = '0.92'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          <span className="material-symbols-outlined">{isSubmitting ? 'hourglass_top' : 'save'}</span>
          {isSubmitting ? 'Salvando...' : initialData ? 'Atualizar Cliente' : 'Salvar Cadastro'}
        </button>
      </div>
    </form>

  );
}
