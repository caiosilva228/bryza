'use client';

import { useMemo, useState, useTransition } from 'react';
import { alterarSenhaPrimeiroAcesso } from './actions';
import { logout } from '../login/actions';
import styles from './primeiro-acesso.module.css';

export default function PrimeiroAcessoPage() {
  const [cpf, setCpf] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const cpfClean = useMemo(() => cpf.replace(/\D/g, ''), [cpf]);

  const passwordState = useMemo(() => ({
    hasValidCpf: cpfClean.length === 11,
    hasMinimumLength: newPassword.length >= 8,
    passwordsMatch: confirmPassword.length > 0 && newPassword === confirmPassword,
  }), [cpfClean, newPassword, confirmPassword]);

  const canSubmit = passwordState.hasValidCpf && passwordState.hasMinimumLength && passwordState.passwordsMatch && !isPending;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (cpfClean.length !== 11) {
      setError('Informe um CPF válido com 11 dígitos.');
      return;
    }

    if (!passwordState.hasMinimumLength) {
      setError('A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    if (!passwordState.passwordsMatch) {
      setError('As senhas não coincidem.');
      return;
    }

    const formData = new FormData();
    formData.append('cpf', cpfClean);
    formData.append('newPassword', newPassword);
    formData.append('confirmPassword', confirmPassword);

    startTransition(async () => {
      const result = await alterarSenhaPrimeiroAcesso(null, formData);
      if (result && !result.success) {
        setError(result.error || 'Ocorreu um erro ao atualizar os dados.');
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
                src="/Logo%20Bryza.svg"
                alt="Bryza"
              />
            </div>

            <span className={styles.securityBadge}>
              <span className="material-symbols-outlined">verified_user</span>
              Ambiente seguro
            </span>

            <h2>Falta pouco para acessar seu painel.</h2>
            <p>
              Complete seus dados informando seu CPF e criando uma nova senha pessoal para proteger
              sua conta.
            </p>
          </div>

          <ul className={styles.benefits}>
            <li><span className="material-symbols-outlined">badge</span> CPF obrigatório para validação da conta</li>
            <li><span className="material-symbols-outlined">lock</span> Sua senha é armazenada com segurança</li>
            <li><span className="material-symbols-outlined">shield_person</span> Somente você terá acesso ao painel</li>
          </ul>
        </aside>

        <div className={styles.formPanel}>
          <div className={styles.mobileLogo}>
            <img
              src="/Logo%20Bryza.svg"
              alt="Bryza"
            />
          </div>

          <span className={styles.step}>Primeiro acesso</span>
          <h1 id="first-access-title">Informe seu CPF e crie uma senha</h1>
          <p className={styles.subtitle}>
            Informe seu CPF para validação e escolha uma nova senha pessoal.
          </p>

          {error && (
            <div className={styles.error} role="alert" aria-live="assertive">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="cpf">CPF *</label>
              <div className={styles.inputShell}>
                <span className={`material-symbols-outlined ${styles.leadingIcon}`}>badge</span>
                <input
                  type="text"
                  id="cpf"
                  name="cpf"
                  value={cpf}
                  onChange={(event) => {
                    let v = event.target.value.replace(/\D/g, '');
                    v = v.replace(/(\d{3})(\d)/, '$1.$2');
                    v = v.replace(/(\d{3})(\d)/, '$1.$2');
                    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                    setCpf(v.slice(0, 14));
                    setError(null);
                  }}
                  placeholder="Ex: 123.456.789-00"
                  maxLength={14}
                  required
                  disabled={isPending}
                  autoFocus
                />
              </div>
            </div>

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
              <div className={passwordState.hasValidCpf ? styles.ruleValid : ''}>
                <span className="material-symbols-outlined">{passwordState.hasValidCpf ? 'check_circle' : 'radio_button_unchecked'}</span>
                CPF com 11 dígitos preenchido
              </div>
              <div className={passwordState.hasMinimumLength ? styles.ruleValid : ''}>
                <span className="material-symbols-outlined">{passwordState.hasMinimumLength ? 'check_circle' : 'radio_button_unchecked'}</span>
                Pelo menos 8 caracteres na senha
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
                <>Salvar dados e continuar <span className="material-symbols-outlined">arrow_forward</span></>
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
