'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { salvarVendedor } from '../actions';

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", 
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", 
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function VendedorForm({ vendedor }: { vendedor?: any }) {
  const [addressData, setAddressData] = useState({
    endereco: vendedor?.endereco || '',
    bairro: vendedor?.bairro || '',
    cidade: vendedor?.cidade || '',
    estado: vendedor?.estado || '',
  });

  const [telefone, setTelefone] = useState(vendedor?.telefone || '');
  const [cep, setCep] = useState('');
  
  const [cidades, setCidades] = useState<string[]>([]);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatPhone(e.target.value));
  };

  // Buscar cidades quando estado muda
  useEffect(() => {
    if (addressData.estado && addressData.estado.length === 2 && ESTADOS.includes(addressData.estado.toUpperCase())) {
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${addressData.estado}/municipios`)
        .then(res => res.json())
        .then((data: any[]) => {
          setCidades(data.map(c => c.nome.toUpperCase())); // Aproveitando para colocar em uppercase também
        })
        .catch(console.error);
    } else {
      setCidades([]);
    }
  }, [addressData.estado]);

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'estado') {
      setAddressData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    } else {
      setAddressData(prev => ({ ...prev, [name]: (e.target instanceof HTMLInputElement ? value.toUpperCase() : value) }));
    }
  };

  const handleCepBlur = async () => {
    const cepNumeros = cep.replace(/\D/g, '');
    if (cepNumeros.length === 8) {
      setIsLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepNumeros}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setAddressData(prev => ({
            ...prev,
            endereco: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            estado: data.uf
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
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--color-on-surface-variant)'
  };

  const headerStyle = {
    fontSize: '18px', 
    marginBottom: '16px', 
    marginTop: '24px', 
    color: 'var(--color-primary)'
  };

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setSubmitError(null);
    const res = await salvarVendedor(formData);
    // Se chegou aqui e tem res (redirect joga uma exceção no Next.js e não cai aqui)
    if (res && !res.success && res.error) {
      setSubmitError(res.error);
    }
  };

  return (
    <form action={handleSubmit}>
      {submitError && (
        <div style={{ backgroundColor: '#FCE8E6', color: '#C5221F', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 600 }}>
          Falha ao salvar: {submitError}
        </div>
      )}
      {vendedor && <input type="hidden" name="id" value={vendedor.id} />}
      
      <datalist id="estados-list">
        {ESTADOS.map(uf => <option key={uf} value={uf} />)}
      </datalist>
      <datalist id="cidades-list">
        {cidades.map(cidade => <option key={cidade} value={cidade} />)}
      </datalist>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        
        {/* DADOS PESSOAIS */}
        <div style={{ gridColumn: '1 / -1' }}>
          <h3 style={headerStyle}>Dados Pessoais</h3>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-outline-variant)', marginBottom: '24px' }} />
        </div>

        <div>
          <label style={labelStyle}>Nome Completo *</label>
          <input type="text" name="nome" defaultValue={vendedor?.nome} required placeholder="Ex: João Silva" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Email *</label>
          <input type="email" name="email" defaultValue={vendedor?.email} required placeholder="joao@vendas.com.br" style={inputStyle} readOnly={!!vendedor} disabled={!!vendedor} />
          {!!vendedor && <input type="hidden" name="email" value={vendedor.email} />}
        </div>

        <div>
          <label style={labelStyle}>Telefone / WhatsApp</label>
          <input 
            type="tel" 
            name="telefone" 
            value={telefone} 
            onChange={handlePhoneChange} 
            placeholder="(00) 00000-0000" 
            style={inputStyle} 
            maxLength={15}
          />
        </div>

        <div>
          <label style={labelStyle}>CPF</label>
          <input type="text" name="cpf" defaultValue={vendedor?.cpf} placeholder="000.000.000-00" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Data de Nascimento</label>
          <input type="date" name="data_nascimento" defaultValue={vendedor?.data_nascimento} style={inputStyle} />
        </div>

        {/* ENDEREÇO */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
              <label style={labelStyle}>CEP {isLoadingCep && <span style={{ fontSize: '12px', color: 'var(--color-tertiary)', fontWeight: 'normal' }}>(Buscando...)</span>}</label>
              <input 
                type="text" 
                placeholder="Ex: 00000-000" 
                style={inputStyle} 
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                onBlur={handleCepBlur}
                maxLength={9}
              />
            </div>
            <div>
            <label style={labelStyle}>Logradouro</label>
            <input 
                type="text" 
                name="endereco" 
                style={inputStyle}
                value={addressData.endereco}
                onChange={handleAddressChange} 
            />
            </div>
            <div>
            <label style={labelStyle}>Bairro</label>
            <input 
                type="text" 
                name="bairro" 
                style={inputStyle}
                value={addressData.bairro}
                onChange={handleAddressChange} 
            />
            </div>
            <div>
            <label style={labelStyle}>Cidade</label>
            <input 
                type="text" 
                name="cidade" 
                style={inputStyle}
                list="cidades-list"
                value={addressData.cidade}
                onChange={handleAddressChange} 
                autoComplete="off"
            />
            </div>
            <div>
            <label style={labelStyle}>Estado</label>
            <input 
                type="text" 
                name="estado" 
                style={inputStyle}
                list="estados-list"
                value={addressData.estado}
                onChange={handleAddressChange}
                maxLength={2} 
                autoComplete="off"
            />
            </div>
        </div>

        {/* DADOS OPERACIONAIS */}
        <div style={{ gridColumn: '1 / -1' }}>
          <h3 style={headerStyle}>Dados Operacionais</h3>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-outline-variant)', marginBottom: '24px' }} />
        </div>

        <div>
          <label style={labelStyle}>Região de Atuação</label>
          <input type="text" name="regiao_atuacao" defaultValue={vendedor?.regiao_atuacao} placeholder="Ex: Zona Sul" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Data de Entrada</label>
          <input type="date" name="data_entrada" defaultValue={vendedor?.data_entrada} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Status</label>
          <select name="ativo" defaultValue={vendedor?.ativo === false ? 'false' : 'true'} style={inputStyle}>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Observações Internas</label>
          <textarea name="observacoes" defaultValue={vendedor?.observacoes} style={{...inputStyle, height: '100px'}} />
        </div>

        {/* DADOS COMERCIAIS */}
        <div style={{ gridColumn: '1 / -1' }}>
          <h3 style={headerStyle}>Dados Comerciais</h3>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-outline-variant)', marginBottom: '24px' }} />
        </div>

        <div>
          <label style={labelStyle}>Nível Atual de Comissão</label>
          <select name="nivel_comissao" defaultValue={vendedor?.nivel_comissao || 'Bronze'} style={inputStyle}>
            <option value="Bronze">Bronze (8% - Base)</option>
            <option value="Prata">Prata (10% - Intermediário)</option>
            <option value="Ouro">Ouro (12% - Avançado)</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Percentual Específico (%)</label>
          <input type="number" step="0.01" name="percentual_comissao" defaultValue={vendedor?.percentual_comissao || 8.00} style={inputStyle} />
        </div>

        <div style={{ gridColumn: '1 / -1', padding: '16px', backgroundColor: 'var(--color-surface-container)', borderRadius: '12px', border: '1px dashed var(--color-outline)' }}>
            <h4 style={{ margin: '0 0 16px 0', color: 'var(--color-on-surface)' }}>Níveis de Comissão de Referência</h4>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px', backgroundColor: 'var(--color-surface-container-lowest)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #cd7f32' }}>
                    <strong>Nível Bronze</strong><br />
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Comissão: 8%</span><br />
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Faixa: 0 a 20 vendas/dia</span>
                </div>
                <div style={{ flex: 1, minWidth: '200px', backgroundColor: 'var(--color-surface-container-lowest)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #c0c0c0' }}>
                    <strong>Nível Prata</strong><br />
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Comissão: 10%</span><br />
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Faixa: 21 a 40 vendas/dia</span>
                </div>
                <div style={{ flex: 1, minWidth: '200px', backgroundColor: 'var(--color-surface-container-lowest)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #ffd700' }}>
                    <strong>Nível Ouro</strong><br />
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Comissão: 12%</span><br />
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Faixa: Acima de 40 vendas/dia</span>
                </div>
            </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <label style={labelStyle}>Meta Diária de Vendas</label>
          <input type="number" name="meta_diaria" defaultValue={vendedor?.meta_diaria || 0} style={inputStyle} />
        </div>

        <div style={{ marginTop: '24px' }}>
          <label style={labelStyle}>Meta Semanal de Vendas</label>
          <input type="number" name="meta_semanal" defaultValue={vendedor?.meta_semanal || 0} style={inputStyle} />
        </div>

        <div style={{ marginTop: '24px' }}>
          <label style={labelStyle}>Meta Mensal de Vendas</label>
          <input type="number" name="meta_mensal" defaultValue={vendedor?.meta_mensal || 0} style={inputStyle} />
        </div>

      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '24px' }}>
        <Link href="/vendedores" style={{
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
          Salvar Vendedor
        </button>
      </div>

    </form>
  );
}
