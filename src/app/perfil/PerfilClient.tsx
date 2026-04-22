'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { updateProfile, updatePassword } from './actions';
import { Profile } from '@/models/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PerfilClientProps {
  profile: Profile;
}

export function PerfilClient({ profile }: PerfilClientProps) {
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Form Profile State
  const [nome, setNome] = useState(profile.nome);
  const [telefone, setTelefone] = useState(profile.telefone || '');

  // Form Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const formattedDate = profile.created_at 
    ? format(new Date(profile.created_at), "MMM yyyy", { locale: ptBR })
    : 'Data desconhecida';

  const roleLabels: Record<string, string> = {
    'admin': 'Administrador',
    'vendedor': 'Vendedor',
    'logistica': 'Logística'
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      const formData = new FormData();
      formData.append('nome', nome);
      formData.append('telefone', telefone);

      const result = await updateProfile(formData);

      if (result.success) {
        toast.success('Perfil atualizado com sucesso!');
      } else {
        toast.error(result.error || 'Erro ao atualizar perfil');
      }
    } catch (error) {
      toast.error('Erro inesperado ao atualizar perfil');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }

    setIsSavingPassword(true);

    try {
      const formData = new FormData();
      formData.append('currentPassword', currentPassword);
      formData.append('newPassword', newPassword);
      formData.append('confirmPassword', confirmPassword);

      const result = await updatePassword(formData);

      if (result.success) {
        toast.success('Senha atualizada com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(result.error || 'Erro ao atualizar senha');
      }
    } catch (error) {
      toast.error('Erro inesperado ao atualizar senha');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-header-text">
          <h1 style={{ color: 'var(--color-primary)' }}>Meu Perfil</h1>
          <p>Gerencie suas informações pessoais e de acesso ao sistema.</p>
        </div>
        <div className="page-header-actions">
          <button 
            type="submit" 
            form="profile-form" 
            className="btn-primary" 
            disabled={isSavingProfile}
          >
            <span className="material-symbols-outlined">
              {isSavingProfile ? 'hourglass_empty' : 'save'}
            </span>
            {isSavingProfile ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '32px', alignItems: 'start' }}>
        
        {/* Coluna Esquerda - Card de Perfil */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          border: '1px solid var(--color-outline-variant)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '32px 24px'
        }}>
          <div style={{ 
            width: '120px', 
            height: '120px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--color-primary-container)', 
            color: 'var(--color-on-primary-container)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '24px',
            border: '4px solid var(--color-surface)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '64px' }}>person</span>
          </div>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '4px', textAlign: 'center' }}>
            {profile.nome}
          </h2>
          <p style={{ 
            fontSize: '12px', 
            fontWeight: 600, 
            color: 'var(--color-primary)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em',
            marginBottom: '16px'
          }}>
            {roleLabels[profile.role] || profile.role}
          </p>

          <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--color-outline-variant)', margin: '16px 0' }} />

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-on-surface-variant)', fontSize: '14px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>mail</span>
              {profile.email}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-on-surface-variant)', fontSize: '14px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>phone</span>
              {profile.telefone || '-'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-on-surface-variant)', fontSize: '14px', textTransform: 'capitalize' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>calendar_today</span>
              Membro desde {formattedDate}
            </div>
          </div>
        </div>

        {/* Coluna Direita - Formulário de Edição */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Informações Pessoais */}
          <form id="profile-form" onSubmit={handleProfileSubmit} style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: '16px',
            border: '1px solid var(--color-outline-variant)',
            padding: '32px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>badge</span>
              Informações Pessoais
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Nome Completo</label>
                <input 
                  type="text" 
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-outline)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>E-mail</label>
                <input 
                  type="email" 
                  value={profile.email}
                  disabled
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-outline)',
                    backgroundColor: 'var(--color-surface-container-low)',
                    color: 'var(--color-on-surface-variant)',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'not-allowed'
                  }} 
                />
                <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>O e-mail não pode ser alterado.</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Telefone</label>
                <input 
                  type="text" 
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-outline)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Cargo / Função</label>
                <input 
                  type="text" 
                  value={roleLabels[profile.role] || profile.role}
                  disabled
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-outline)',
                    backgroundColor: 'var(--color-surface-container-low)',
                    color: 'var(--color-on-surface-variant)',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'not-allowed'
                  }} 
                />
              </div>
            </div>
          </form>

          {/* Segurança */}
          <form onSubmit={handlePasswordSubmit} style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: '16px',
            border: '1px solid var(--color-outline-variant)',
            padding: '32px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>lock</span>
              Segurança
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', maxWidth: '400px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Senha Atual</label>
                <input 
                  type="password" 
                  placeholder="Digite sua senha atual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-outline)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Nova Senha</label>
                <input 
                  type="password" 
                  placeholder="Digite a nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-outline)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Confirmar Nova Senha</label>
                <input 
                  type="password" 
                  placeholder="Confirme a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-outline)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }} 
                />
              </div>
              
              <div>
                <button type="submit" className="btn-secondary" disabled={isSavingPassword} style={{ width: 'auto' }}>
                  <span className="material-symbols-outlined">
                    {isSavingPassword ? 'hourglass_empty' : 'key'}
                  </span>
                  {isSavingPassword ? 'Atualizando...' : 'Atualizar Senha'}
                </button>
              </div>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
