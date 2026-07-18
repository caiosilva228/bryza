'use client';

import { useState, useEffect, useTransition } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { editarEmbaixador } from '../actions';
import { toast } from 'sonner';

export default function NovoEmbaixadorPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [sponsors, setSponsors] = useState<{ id: string; full_name: string; username: string }[]>([]);
  
  // Estados do formulário
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
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
    cpfClean: string;
    referralLink: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

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
        .select('id, full_name, username')
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
          cpfClean,
          referralLink: `https://bryzasistem.netlify.app/r/${newAmb.username}`
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
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>SENHA INICIAL (CPF informado)</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)' }}>{createdData.cpfClean}</span>
                  <button 
                    onClick={() => handleCopy(createdData.cpfClean, 'Senha inicial')}
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
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Ex: Caio Silva" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Nome de Exibição</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Como aparecerá na plataforma (opcional)" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>CPF *</label>
                <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} required placeholder="Ex: 123.456.789-00" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Telefone</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ex: (11) 98888-8888" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
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
              Endereço
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Cidade</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Ex: São Paulo" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Estado (UF)</label>
                <input type="text" value={state} onChange={e => setState(e.target.value)} maxLength={2} placeholder="Ex: SP" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Chave Pix</label>
                <input type="text" value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="Informe a chave Pix correspondente" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
            </div>
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Patrocinador Futuro (Opcional)</label>
                <select value={sponsorId} onChange={e => setSponsorId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                  <option value="">Nenhum / Sem Patrocinador</option>
                  {sponsors.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.username})</option>
                  ))}
                </select>
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
