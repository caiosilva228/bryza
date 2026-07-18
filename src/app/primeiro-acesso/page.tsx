'use client';

import { useMemo, useState, useTransition } from 'react';
import { alterarSenhaPrimeiroAcesso } from './actions';
import { logout } from '../login/actions';
import styles from './primeiro-acesso.module.css';

export default function PrimeiroAcessoPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const passwordState = useMemo(() => ({
    hasMinimumLength: newPassword.length >= 8,
    passwordsMatch: confirmPassword.length > 0 && newPassword === confirmPassword,
  }), [newPassword, confirmPassword]);

  const canSubmit = passwordState.hasMinimumLength && passwordState.passwordsMatch && !isPending;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!passwordState.hasMinimumLength) {
      setError('A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    if (!passwordState.passwordsMatch) {
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
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="first-access-title">
        <aside className={styles.intro}>
          <div>
            <div className={styles.logoBox}>
              <img
                src="https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/Bryza/New%20Logo%20Bryza.svg"
                alt="Bryza"
              />
            </div>

            <span className={styles.securityBadge}>
              <span className="material-symbols-outlined">verified_user</span>
              Ambiente seguro
            </span>

            <h2>Falta pouco para acessar seu painel.</h2>
            <p>
              A senha inicial é temporária. Crie uma senha pessoal para proteger
              seus dados, vendas e comissões.
            </p>
          </div>

          <ul className={styles.benefits}>
            <li><span className="material-symbols-outlined">lock</span> Sua senha é armazenada com segurança</li>
            <li><span className="material-symbols-outlined">shield_person</span> Somente você terá acesso ao painel</li>
            <li><span className="material-symbols-outlined">check_circle</span> A troca é necessária apenas uma vez</li>
          </ul>
        </aside>

        <div className={styles.formPanel}>
          <div className={styles.mobileLogo}>
            <img
              src="https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/Bryza/New%20Logo%20Bryza.svg"
              alt="Bryza"
            />
          </div>

          <span className={styles.step}>Primeiro acesso</span>
          <h1 id="first-access-title">Crie sua nova senha</h1>
          <p className={styles.subtitle}>
            Escolha uma senha diferente da senha inicial e dos seus dados pessoais.
          </p>

          {error && (
            <div className={styles.error} role="alert" aria-live="assertive">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="newPassword">Nova senha</label>
              <div className={styles.inputShell}>
                <span className={`material-symbols-outlined ${styles.leadingIcon}`}>lock</span>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  id="newPassword"
                  name="newPassword"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setError(null);
                  }}
                  placeholder="Digite pelo menos 8 caracteres"
                  autoComplete="new-password"
                  aria-describedby="password-rules"
                  minLength={8}
                  required
                  disabled={isPending}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.visibilityButton}
                  onClick={() => setShowNewPassword((current) => !current)}
                  aria-label={showNewPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                  aria-pressed={showNewPassword}
                >
                  <span className="material-symbols-outlined">{showNewPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="confirmPassword">Confirme a nova senha</label>
              <div className={styles.inputShell}>
                <span className={`material-symbols-outlined ${styles.leadingIcon}`}>lock_reset</span>
                <input
                  type={showConfirmation ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError(null);
                  }}
                  placeholder="Digite novamente"
                  autoComplete="new-password"
                  required
                  disabled={isPending}
                />
                <button
                  type="button"
                  className={styles.visibilityButton}
                  onClick={() => setShowConfirmation((current) => !current)}
                  aria-label={showConfirmation ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'}
                  aria-pressed={showConfirmation}
                >
                  <span className="material-symbols-outlined">{showConfirmation ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <div id="password-rules" className={styles.rules} aria-live="polite">
              <div className={passwordState.hasMinimumLength ? styles.ruleValid : ''}>
                <span className="material-symbols-outlined">{passwordState.hasMinimumLength ? 'check_circle' : 'radio_button_unchecked'}</span>
                Pelo menos 8 caracteres
              </div>
              <div className={passwordState.passwordsMatch ? styles.ruleValid : ''}>
                <span className="material-symbols-outlined">{passwordState.passwordsMatch ? 'check_circle' : 'radio_button_unchecked'}</span>
                As duas senhas são iguais
              </div>
            </div>

            <button type="submit" className={styles.submitButton} disabled={!canSubmit}>
              {isPending ? (
                <><span className={`material-symbols-outlined ${styles.spinner}`}>progress_activity</span> Atualizando...</>
              ) : (
                <>Salvar senha e continuar <span className="material-symbols-outlined">arrow_forward</span></>
              )}
            </button>
          </form>

          <div className={styles.logoutArea}>
            <span>Entrou na conta errada?</span>
            <form action={logout}>
              <button type="submit" disabled={isPending}>Sair e voltar ao login</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
