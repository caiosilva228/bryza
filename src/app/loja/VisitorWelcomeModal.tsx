'use client';

import { useEffect, useRef, useState } from 'react';
import { login } from '@/app/login/actions';
import { LoginSubmitButton } from '@/components/auth/LoginSubmitButton';
import styles from './visitor-welcome-modal.module.css';

const VISITOR_DISMISS_KEY = 'bryza_store_visitor_welcome_dismissed';

type VisitorWelcomeModalProps = {
  isLoggedIn: boolean;
  sessionResolved: boolean;
  loginRequest: number;
  loginReturnTo?: string;
  onCreateAccount: () => void;
};

export default function VisitorWelcomeModal({
  isLoggedIn,
  sessionResolved,
  loginRequest,
  loginReturnTo = '/loja',
  onCreateAccount,
}: VisitorWelcomeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'welcome' | 'login'>('welcome');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [returnTo, setReturnTo] = useState(loginReturnTo);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const loginInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionResolved || isLoggedIn) {
      setIsOpen(false);
      return;
    }

    try {
      setIsOpen(sessionStorage.getItem(VISITOR_DISMISS_KEY) !== 'true');
    } catch {
      setIsOpen(true);
    }
  }, [isLoggedIn, sessionResolved]);

  useEffect(() => {
    if (!loginRequest || isLoggedIn) return;
    setLoginError('');
    setReturnTo(loginReturnTo);
    setView('login');
    setIsOpen(true);
  }, [isLoggedIn, loginRequest, loginReturnTo]);

  useEffect(() => {
    if (!sessionResolved || isLoggedIn) return;
    const params = new URLSearchParams(window.location.search);
    const error = params.get('login_error');
    const requestedReturn = params.get('retorno');
    const safeReturn =
      (
        requestedReturn === '/loja'
        || requestedReturn?.startsWith('/loja/')
        || requestedReturn?.startsWith('/loja?')
      )
        ? requestedReturn
        : '/loja';

    if (params.get('cadastro') === 'required') {
      setIsOpen(false);
      onCreateAccount();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      const messages: Record<string, string> = {
        InvalidCredentials: 'Código Bryza, e-mail, CPF, telefone ou senha inválidos.',
        BlockedUser: 'Sua conta de embaixador está inativa ou bloqueada.',
        RateLimit: 'Muitas tentativas de login. Tente novamente mais tarde.',
      };
      setLoginError(messages[error] || 'Não foi possível entrar. Tente novamente.');
      setReturnTo(safeReturn);
      setView('login');
      setIsOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('login') === 'required') {
      setReturnTo(safeReturn);
      setView('login');
      setIsOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isLoggedIn, onCreateAccount, sessionResolved]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (view === 'login') {
      loginInputRef.current?.focus();
    } else {
      firstActionRef.current?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissForSession();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen, view]);

  function dismissForSession() {
    try {
      sessionStorage.setItem(VISITOR_DISMISS_KEY, 'true');
    } catch {
      // O modal ainda pode ser dispensado quando o navegador bloqueia o storage.
    }
    setIsOpen(false);
  }

  if (!isOpen || isLoggedIn) return null;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismissForSession();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="visitor-welcome-title"
        aria-describedby="visitor-welcome-description"
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={dismissForSession}
          aria-label="Fechar e continuar como visitante"
        >
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>

        {view === 'welcome' ? (
          <>
            <div className={styles.brandMark} aria-hidden="true">
              <span className="material-symbols-outlined">shopping_bag</span>
            </div>

            <p className={styles.eyebrow}>Bem-vindo à Loja Bryza</p>
            <h2 id="visitor-welcome-title">Você já tem cadastro?</h2>
            <p id="visitor-welcome-description" className={styles.description}>
              Embaixador, entre com a mesma credencial do seu portal. Se preferir,
              você também pode comprar normalmente como visitante.
            </p>

            <div className={styles.benefits} aria-label="Benefícios do cadastro">
              <span>
                <span className="material-symbols-outlined" aria-hidden="true">bolt</span>
                Checkout mais rápido
              </span>
              <span>
                <span className="material-symbols-outlined" aria-hidden="true">local_shipping</span>
                Acompanhe seus pedidos
              </span>
            </div>

            <div className={styles.actions}>
              <button
                ref={firstActionRef}
                type="button"
                className={styles.primaryAction}
                onClick={() => {
                  setLoginError('');
                  setReturnTo('/loja');
                  setView('login');
                }}
              >
                <span className="material-symbols-outlined" aria-hidden="true">login</span>
                Entrar
              </button>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => {
                  dismissForSession();
                  onCreateAccount();
                }}
              >
                <span className="material-symbols-outlined" aria-hidden="true">person_add</span>
                Criar cadastro
              </button>
            </div>

            <button type="button" className={styles.guestAction} onClick={dismissForSession}>
              Continuar como visitante
            </button>

            <p className={styles.privacyNote}>
              Você poderá escolher pagar agora ou somente na entrega.
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => {
                setLoginError('');
                setView('welcome');
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
              Voltar
            </button>

            <div className={styles.brandMark} aria-hidden="true">
              <span className="material-symbols-outlined">person</span>
            </div>
            <p className={styles.eyebrow}>Acesso unificado Bryza</p>
            <h2 id="visitor-welcome-title">Entrar na loja</h2>
            <p id="visitor-welcome-description" className={styles.description}>
              Use o mesmo Código Bryza, e-mail, CPF ou telefone e a mesma senha
              do Portal do Embaixador.
            </p>

            {loginError ? (
              <p className={styles.loginError} role="alert">{loginError}</p>
            ) : null}

            <form action={login} className={styles.loginForm}>
              <input type="hidden" name="login_context" value="store" />
              <input type="hidden" name="return_to" value={returnTo} />

              <label htmlFor="store-login-identifier">
                Código Bryza, e-mail, CPF ou telefone
              </label>
              <div className={styles.inputWrap}>
                <span className="material-symbols-outlined" aria-hidden="true">person</span>
                <input
                  ref={loginInputRef}
                  id="store-login-identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  required
                  placeholder="Digite sua identificação"
                />
              </div>

              <label htmlFor="store-login-password">Sua senha</label>
              <div className={styles.inputWrap}>
                <span className="material-symbols-outlined" aria-hidden="true">lock</span>
                <input
                  id="store-login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Digite sua senha"
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              <LoginSubmitButton label="Entrar" />
            </form>

            <p className={styles.privacyNote}>
              Uma única credencial para a loja e para o Portal do Embaixador.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
