import styles from './login.module.css';
import { login } from './actions';

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = params.error;

  let errorMessage = '';
  if (error === 'InvalidCredentials') {
    errorMessage = 'Usuário ou senha inválidos.';
  } else if (error === 'BlockedUser') {
    errorMessage = 'Sua conta está inativa ou bloqueada. Entre em contato com o suporte.';
  } else if (error === 'RateLimit') {
    errorMessage = 'Muitas tentativas de login. Tente novamente mais tarde.';
  }

  return (
    <div className={styles.container}>
      <main className={styles.mainCard}>
        {/* Lado Institucional (Escondido no mobile via CSS) */}
        <section className={styles.brandingSide}>
          <div className={styles.brandingContent}>
            <div style={{ marginBottom: '40px' }}>
              <img 
                src="https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/Bryza/New%20Logo%20Bryza.svg" 
                alt="Bryza Logo" 
                style={{ width: '200px', height: 'auto' }}
              />
            </div>
            
            <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '36px', fontWeight: 700, color: 'white', lineHeight: 1.2, marginBottom: '24px' }}>
              A precisão que seu <br/>negócio merece.
            </h1>
            
            <p style={{ color: 'var(--color-primary-fixed-dim)', fontSize: '18px', lineHeight: 1.6, maxWidth: '320px' }}>
              Acesse o portal de gestão operacional para controlar vendas, estoque e logística em tempo real.
            </p>
          </div>
          
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--color-primary-fixed-dim)', fontSize: '14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified_user</span> Seguro</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bolt</span> Sistema de Gestão Versão 1.0</span>
            </div>
          </div>
        </section>

        {/* Lado do Formulário */}
        <section className={styles.formSide}>
          <div className={styles.mobileLogo} style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
            <img 
              src="https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/Bryza/New%20Logo%20Bryza.svg" 
              alt="Bryza Logo" 
              style={{ height: '60px', width: 'auto' }}
            />
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '24px', fontWeight: 600, color: 'var(--color-on-surface)', marginBottom: '8px' }}>Seja bem-vindo</h2>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px' }}>Entre com suas credenciais para continuar.</p>
          </div>

          {errorMessage && (
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
              {errorMessage}
            </div>
          )}

          <form action={login} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label htmlFor="identifier" className={styles.label}>E-mail ou usuário</label>
              <div className={styles.inputGroup}>
                <span className={`material-symbols-outlined ${styles.inputIcon}`}>person</span>
                <input 
                  type="text" 
                  id="identifier" 
                  name="identifier" 
                  className={styles.input} 
                  placeholder="seu@email.com ou bryza01" 
                  required 
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="password" className={styles.label}>Senha</label>
                <a href="#" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>Esqueci minha senha</a>
              </div>
              <div className={styles.inputGroup}>
                <span className={`material-symbols-outlined ${styles.inputIcon}`}>lock</span>
                <input 
                  type="password" 
                  id="password" 
                  name="password" 
                  className={styles.input} 
                  placeholder="••••••••" 
                  required 
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="remember" style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }} />
              <label htmlFor="remember" style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', userSelect: 'none' }}>Manter conectado</label>
            </div>

            <button type="submit" className={styles.submitButton}>
              Entrar
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </form>

          <footer style={{ marginTop: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
              © 2024 BRYZA Tecnologia S.A. <br/> Todos os direitos reservados.
            </p>
          </footer>
        </section>
      </main>
    </div>
  );
}
