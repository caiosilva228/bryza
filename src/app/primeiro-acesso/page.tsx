'use client';

import { useState, useTransition } from 'react';
import styles from '../login/login.module.css';
import { alterarSenhaPrimeiroAcesso } from './actions';
import { logout } from '../login/actions';

export default function PrimeiroAcessoPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validações básicas no lado do cliente para UX amigável
    if (newPassword.length < 8) {
      setError('A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    const formData = new FormData();
    formData.append('newPassword', newPassword);
    formData.append('confirmPassword', confirmPassword);

    startTransition(async () => {
      const result = await alterarSenhaPrimeiroAcesso(null, formData);
      if (result && !result.success) {
        setError(result.error || 'Ocorreu um erro ao atualizar a senha.');
      }
    });
  };

  return (
    <div className={styles.container}>
      <main className={styles.mainCard} style={{ maxWidth: '450px' }}>
        <section className={styles.formSide} style={{ padding: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <img 
              src="https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/Bryza/New%20Logo%20Bryza.svg" 
              alt="Bryza Logo" 
              style={{ height: '50px', width: 'auto' }}
            />
          </div>

          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '22px', fontWeight: 600, color: 'var(--color-on-surface)', marginBottom: '8px' }}>
              Primeiro Acesso
            </h2>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px', lineHeight: 1.5 }}>
              Para garantir a segurança da sua conta, você deve alterar a sua senha inicial antes de prosseguir.
            </p>
          </div>

          {error && (
            <div style={{ 
              backgroundColor: 'var(--color-error-container)', 
              color: 'var(--color-error)', 
              padding: '12px 16px', 
              borderRadius: '8px', 
              fontSize: '13px', 
              fontWeight: 500,
              marginBottom: '20px',
              border: '1px solid rgba(186, 26, 26, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label htmlFor="newPassword" className={styles.label}>Nova Senha</label>
              <div className={styles.inputGroup}>
                <span className={`material-symbols-outlined ${styles.inputIcon}`}>lock</span>
                <input 
                  type="password" 
                  id="newPassword" 
                  name="newPassword" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.input} 
                  placeholder="Mínimo de 8 caracteres" 
                  required 
                  disabled={isPending}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className={styles.label}>Confirme a Nova Senha</label>
              <div className={styles.inputGroup}>
                <span className={`material-symbols-outlined ${styles.inputIcon}`}>lock_reset</span>
                <input 
                  type="password" 
                  id="confirmPassword" 
                  name="confirmPassword" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={styles.input} 
                  placeholder="Repita a nova senha" 
                  required 
                  disabled={isPending}
                />
              </div>
            </div>

            <button type="submit" className={styles.submitButton} disabled={isPending} style={{ marginTop: '10px' }}>
              {isPending ? 'Salvando...' : 'Atualizar Senha'}
              {!isPending && <span className="material-symbols-outlined">arrow_forward</span>}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <form action={logout}>
              <button 
                type="submit" 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--color-outline)', 
                  fontSize: '12px', 
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontWeight: 500
                }}
              >
                Voltar e sair da conta
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
