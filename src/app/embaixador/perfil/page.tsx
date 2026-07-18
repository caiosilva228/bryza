'use client';

import { useState, useEffect, useTransition } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getPortalDashboardData, atualizarMeuPerfil, getSignedProfilePhotoUrl } from '../actions';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export default function MeuPerfilPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Campos mutáveis
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pixType, setPixType] = useState('pix');
  const [pixKey, setPixKey] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await getPortalDashboardData();
      setData(res);
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

        await atualizarMeuPerfil({
          phone,
          instagram,
          city,
          state,
          pix_type: pixType,
          pix_key: isPixKeyMasked ? undefined : pixKey,
          photo_path: finalPhotoPath
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
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Instagram</label>
                <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@seu.usuario" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Cidade</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Estado (UF)</label>
                <input type="text" value={state} onChange={e => setState(e.target.value)} maxLength={2} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', textTransform: 'uppercase' }} />
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
                <select value={pixType} onChange={e => setPixType(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                  <option value="pix">Chave Aleatória / Outro</option>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '6px' }}>Chave Pix</label>
                <input type="text" value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="Digite sua chave Pix" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>
            </div>
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
