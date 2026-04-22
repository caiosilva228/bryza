'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { salvarCliente, atualizarCliente } from '../actions';
import { Cliente } from '@/models/types';

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
    cep: initialData?.cep || '',
    endereco: initialData?.endereco || '',
    numero: initialData?.numero || '',
    bairro: initialData?.bairro || '',
    cidade: initialData?.cidade || '',
    estado: initialData?.estado || ''
  });
  
  const [cidades, setCidades] = useState<string[]>([]);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

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
          setFormData(prev => ({
            ...prev,
            endereco: data.logradouro.toUpperCase(),
            bairro: data.bairro.toUpperCase(),
            cidade: data.localidade.toUpperCase(),
            estado: data.uf.toUpperCase()
          }));
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

  // Determinar a action baseada no modo (Novo ou Editar)
  const formAction = initialData 
    ? atualizarCliente.bind(null, initialData.id) 
    : salvarCliente;

  return (
    <form action={formAction}>
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
        <button type="submit" style={{
          backgroundColor: 'var(--color-primary)',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '8px',
          fontFamily: 'var(--font-headline)',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span className="material-symbols-outlined">save</span>
          {initialData ? 'Atualizar Cliente' : 'Salvar Cadastro'}
        </button>
      </div>
    </form>

  );
}
