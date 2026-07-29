'use client';

import { useEffect, useRef, useState } from 'react';
import { login } from '@/app/login/actions';
import { LoginSubmitButton } from '@/components/auth/LoginSubmitButton';
import { X, ArrowLeft, LogIn, UserPlus, ShieldCheck, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';

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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 15, 32, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismissForSession();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="visitor-welcome-title"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* CABEÇALHO ESCURO DE ALTO IMPACTO BRYZA (#051329) */}
        <div style={{
          backgroundColor: '#051329',
          color: '#ffffff',
          padding: '24px 28px 20px',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#A6CE39', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {view === 'welcome' ? 'LOJA VIRTUAL BRYZA' : 'ACESSO DO CLIENTE'}
              </span>
              <h2 id="visitor-welcome-title" style={{ margin: '4px 0 2px', fontSize: '22px', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                {view === 'welcome' ? 'Você já tem cadastro?' : 'Entrar na sua conta'}
              </h2>
            </div>
            
            <button
              onClick={dismissForSession}
              aria-label="Fechar"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s'
              }}
            >
              <X size={20} />
            </button>
          </div>

          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.4, fontWeight: 400 }}>
            {view === 'welcome'
              ? 'Entre com sua conta para checkout rápido e acompanhamento de pedidos, ou compre como visitante.'
              : 'Use seu Código Bryza, e-mail, CPF ou telefone e sua senha.'}
          </p>
        </div>

        {/* CORPO DO MODAL (FUNDO BRANCO CLEAN #FFFFFF) */}
        <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {view === 'welcome' ? (
            <>
              {/* Benefícios Rápidos de Alta Conversão */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#0f172a', fontWeight: 700 }}>
                  <Sparkles size={16} color="#009845" />
                  <span>Checkout ágil</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#0f172a', fontWeight: 700 }}>
                  <ShieldCheck size={16} color="#009845" />
                  <span>Pontos e Comissões</span>
                </div>
              </div>

              {/* Botões Principais de Ação */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  ref={firstActionRef}
                  type="button"
                  onClick={() => {
                    setLoginError('');
                    setReturnTo('/loja');
                    setView('login');
                  }}
                  style={{
                    width: '100%',
                    minHeight: '48px',
                    borderRadius: '12px',
                    backgroundColor: '#009845',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '15px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(0, 152, 69, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <LogIn size={18} />
                  <span>Entrar com minha conta</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    dismissForSession();
                    onCreateAccount();
                  }}
                  style={{
                    width: '100%',
                    minHeight: '48px',
                    borderRadius: '12px',
                    border: '1.5px solid #009845',
                    backgroundColor: '#f0fdf4',
                    color: '#08783e',
                    fontSize: '14.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <UserPlus size={18} />
                  <span>Criar minha conta de cliente</span>
                </button>
              </div>

              <button
                type="button"
                onClick={dismissForSession}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '4px',
                  textDecoration: 'underline'
                }}
              >
                Continuar comprando como visitante
              </button>

              <div style={{ fontSize: '11.5px', color: '#94a3b8', textAlign: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: '12px' }}>
                🔒 Pagamento 100% seguro pelo Mercado Pago ou na entrega.
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setLoginError('');
                  setView('welcome');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#009845',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: 0,
                  marginBottom: '4px'
                }}
              >
                <ArrowLeft size={16} />
                <span>Voltar para opções</span>
              </button>

              {loginError && (
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  color: '#dc2626',
                  fontSize: '13px',
                  fontWeight: 700
                }}>
                  {loginError}
                </div>
              )}

              <form action={login} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <input type="hidden" name="login_context" value="store" />
                <input type="hidden" name="return_to" value={returnTo} />

                <div>
                  <label htmlFor="store-login-identifier" style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                    Código Bryza, E-mail, CPF ou Telefone
                  </label>
                  <input
                    ref={loginInputRef}
                    id="store-login-identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    required
                    placeholder="Digite sua identificação"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '14.5px',
                      fontWeight: 600,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="store-login-password" style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                    Sua Senha
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="store-login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      placeholder="Digite sua senha"
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 16px',
                        borderRadius: '12px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '14.5px',
                        fontWeight: 600,
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '6px' }}>
                  <LoginSubmitButton label="Entrar na minha conta" />
                </div>
              </form>

              {/* BOTÃO PARA CADASTRAR-SE / CRIAR CONTA */}
              <div style={{
                marginTop: '8px',
                paddingTop: '16px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center',
                width: '100%'
              }}>
                <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
                  Ainda não tem uma conta?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    dismissForSession();
                    onCreateAccount();
                  }}
                  style={{
                    width: '100%',
                    minHeight: '46px',
                    borderRadius: '12px',
                    border: '1.5px solid #009845',
                    backgroundColor: '#f0fdf4',
                    color: '#08783e',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(0, 152, 69, 0.08)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <UserPlus size={18} />
                  <span>Criar minha conta de cliente</span>
                </button>
              </div>

              <div style={{ fontSize: '11.5px', color: '#94a3b8', textAlign: 'center' }}>
                <Lock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Sua mesma senha para a loja e para o Portal do Embaixador.
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
