'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { criarEmbaixadorComCliente, type NovoEmbaixadorOptions } from '../actions';

const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)', fontSize: '15px' } as const;
const labelStyle = { display: 'block', marginBottom: '7px', color: 'var(--color-on-surface-variant)', fontSize: '13px', fontWeight: 700 } as const;
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px 22px' } as const;
const digits = (value: string) => value.replace(/\D/g, '');
const formatCpf = (value: string) => digits(value).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const formatPhone = (value: string) => {
  const clean = digits(value).slice(0, 11);
  return clean.length > 10
    ? clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    : clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
};

export function NovoEmbaixadorForm({ options }: { options: NovoEmbaixadorOptions }) {
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState({ cep: '', address: '', neighborhood: '', city: '', state: '' });

  async function loadCep() {
    const cep = digits(address.cep);
    if (cep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!response.ok || data.erro) return;
      setAddress((current) => ({
        ...current,
        address: data.logradouro?.toUpperCase() || current.address,
        neighborhood: data.bairro?.toUpperCase() || current.neighborhood,
        city: data.localidade?.toUpperCase() || current.city,
        state: data.uf?.toUpperCase() || current.state,
      }));
    } catch {
      toast.error('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const latitude = String(form.get('latitude') || '').trim();
    const longitude = String(form.get('longitude') || '').trim();

    try {
      const result = await criarEmbaixadorComCliente({
        fullName: String(form.get('fullName') || ''),
        phone,
        email: String(form.get('email') || ''),
        cpf,
        cep: address.cep,
        address: address.address,
        number: String(form.get('number') || ''),
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        commercialProfileId: String(form.get('commercialProfileId') || ''),
        sponsorAmbassadorId: String(form.get('sponsorAmbassadorId') || '') || undefined,
        planId: String(form.get('planId') || ''),
        initialStatus: String(form.get('initialStatus')) === 'ativo' ? 'ativo' : 'pendente',
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        idempotencyKey: idempotencyKey.current,
      });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.customerCreated
        ? `Embaixador ${result.username} criado com o novo cliente ${result.customerCode}.`
        : `Embaixador ${result.username} vinculado ao cliente existente ${result.customerCode}.`);
      idempotencyKey.current = crypto.randomUUID();
      router.push(`/embaixadores/${result.ambassadorId}`);
    } catch (error) {
      console.error('Erro inesperado no cadastro do embaixador:', error);
      toast.error('Não foi possível concluir o cadastro.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: '28px', border: '1px solid var(--color-outline-variant)', borderRadius: '16px', background: 'var(--color-surface-container-lowest)' }}>
      <div style={{ padding: '14px 16px', marginBottom: '24px', borderRadius: '10px', background: 'var(--color-surface-container-low)' }}>
        <strong>Identidade única:</strong> CPF, telefone e e-mail são conferidos antes da criação. Se já existir um cliente, o cadastro será reutilizado.
      </div>

      <h2 style={{ color: 'var(--color-primary)', margin: '0 0 20px' }}>Dados pessoais</h2>
      <div style={gridStyle}>
        <label style={{ gridColumn: '1 / -1' }}><span style={labelStyle}>Nome completo *</span><input name="fullName" required minLength={2} maxLength={200} style={inputStyle} /></label>
        <label><span style={labelStyle}>CPF *</span><input value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} required inputMode="numeric" style={inputStyle} /></label>
        <label><span style={labelStyle}>Telefone / WhatsApp *</span><input value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} required inputMode="tel" style={inputStyle} /></label>
        <label style={{ gridColumn: '1 / -1' }}><span style={labelStyle}>E-mail</span><input name="email" type="email" maxLength={254} style={inputStyle} /></label>
      </div>

      <h2 style={{ color: 'var(--color-primary)', margin: '32px 0 20px' }}>Endereço e localização</h2>
      <div style={gridStyle}>
        <label><span style={labelStyle}>CEP</span><input value={address.cep} onChange={(event) => setAddress((current) => ({ ...current, cep: event.target.value }))} onBlur={loadCep} inputMode="numeric" style={inputStyle} /></label>
        <label style={{ gridColumn: 'span 2' }}><span style={labelStyle}>Endereço</span><input value={address.address} onChange={(event) => setAddress((current) => ({ ...current, address: event.target.value.toUpperCase() }))} style={inputStyle} /></label>
        <label><span style={labelStyle}>Número / complemento</span><input name="number" style={inputStyle} /></label>
        <label><span style={labelStyle}>Bairro</span><input value={address.neighborhood} onChange={(event) => setAddress((current) => ({ ...current, neighborhood: event.target.value.toUpperCase() }))} style={inputStyle} /></label>
        <label><span style={labelStyle}>Cidade</span><input value={address.city} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value.toUpperCase() }))} style={inputStyle} /></label>
        <label><span style={labelStyle}>Estado</span><select value={address.state} onChange={(event) => setAddress((current) => ({ ...current, state: event.target.value }))} style={inputStyle}><option value="">Selecione</option>{STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
        <label><span style={labelStyle}>Latitude</span><input name="latitude" type="number" step="any" style={inputStyle} /></label>
        <label><span style={labelStyle}>Longitude</span><input name="longitude" type="number" step="any" style={inputStyle} /></label>
      </div>

      <h2 style={{ color: 'var(--color-primary)', margin: '32px 0 20px' }}>Programa e responsabilidade</h2>
      <div style={gridStyle}>
        <label><span style={labelStyle}>Responsável comercial *</span><select name="commercialProfileId" required defaultValue="" style={inputStyle}><option value="" disabled>Selecione</option>{options.commercialProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nome} ({profile.role === 'admin' ? 'Admin' : 'Vendedor'})</option>)}</select></label>
        <label><span style={labelStyle}>Patrocinador / indicado por</span><select name="sponsorAmbassadorId" defaultValue="" style={inputStyle}><option value="">Sem patrocinador</option>{options.sponsors.map((sponsor) => <option key={sponsor.id} value={sponsor.id}>{sponsor.referral_code} — {sponsor.full_name}</option>)}</select></label>
        <label><span style={labelStyle}>Plano de comissão *</span><select name="planId" required defaultValue={options.plans[0]?.id || ''} style={inputStyle}>{options.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
        <label><span style={labelStyle}>Status inicial *</span><select name="initialStatus" defaultValue="pendente" style={inputStyle}><option value="pendente">Pendente — ativar depois</option><option value="ativo">Ativo</option></select></label>
      </div>

      <p style={{ margin: '24px 0 0', color: 'var(--color-on-surface-variant)', fontSize: '13px' }}>O cliente próprio do embaixador nunca será contado como uma autoindicação. O acesso ao painel pode ser criado ou redefinido na tela de detalhes.</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }}>
        <button type="submit" className="btn-primary" disabled={submitting || options.plans.length === 0}><span className="material-symbols-outlined">person_add</span>{submitting ? 'Salvando...' : 'Criar embaixador'}</button>
      </div>
    </form>
  );
}
