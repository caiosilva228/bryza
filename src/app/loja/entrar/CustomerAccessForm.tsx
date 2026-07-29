'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ArrowLeft, CheckCircle2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { requestCustomerAccess, type CustomerAccessState } from './actions';
import styles from './customer-access.module.css';

const initialState: CustomerAccessState = {
  status: 'idle',
  message: '',
};

type CustomerAccessFormProps = {
  mode: 'entrar' | 'cadastro';
  returnPath: string;
  invalidLink?: boolean;
};

export default function CustomerAccessForm({
  mode,
  returnPath,
  invalidLink = false,
}: CustomerAccessFormProps) {
  const [state, formAction, pending] = useActionState(requestCustomerAccess, initialState);
  const isSignup = mode === 'cadastro';

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="customer-access-title">
        <Link href="/loja" className={styles.backLink}>
          <ArrowLeft size={18} aria-hidden="true" />
          Voltar para a loja
        </Link>

        <div className={styles.brandMark} aria-hidden="true">
          B
        </div>

        <div className={styles.heading}>
          <span className={styles.eyebrow}>
            <ShieldCheck size={17} aria-hidden="true" />
            Área segura Bryza
          </span>
          <h1 id="customer-access-title">
            {isSignup ? 'Crie sua conta' : 'Acesse sua conta'}
          </h1>
          <p>
            {isSignup
              ? 'Acompanhe pedidos, salve seus dados e compre novamente sem preencher tudo.'
              : 'Veja seus pedidos, pagamentos e cada etapa da entrega em um só lugar.'}
          </p>
        </div>

        {invalidLink && (
          <p className={styles.error} role="alert">
            Este link expirou ou já foi utilizado. Solicite um novo acesso abaixo.
          </p>
        )}

        {state.status === 'success' ? (
          <div className={styles.successPanel} role="status" aria-live="polite">
            <CheckCircle2 size={36} aria-hidden="true" />
            <h2>Confira seu e-mail</h2>
            <p>{state.message}</p>
            <p className={styles.smallText}>
              O link é de uso único. Verifique também a caixa de spam.
            </p>
            <Link href="/loja" className={styles.primaryLink}>
              Continuar comprando
            </Link>
          </div>
        ) : (
          <form action={formAction} className={styles.form}>
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="retorno" value={returnPath} />

            <label htmlFor="customer-email">Seu melhor e-mail</label>
            <div className={styles.inputWrap}>
              <Mail size={20} aria-hidden="true" />
              <input
                id="customer-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                maxLength={254}
                required
                autoFocus
              />
            </div>

            {state.status === 'error' && (
              <p className={styles.error} role="alert">
                {state.message}
              </p>
            )}

            <button type="submit" className={styles.primaryButton} disabled={pending}>
              <LockKeyhole size={19} aria-hidden="true" />
              {pending
                ? 'Enviando link seguro...'
                : isSignup
                  ? 'Criar conta e receber link'
                  : 'Receber link de acesso'}
            </button>

            <p className={styles.securityNote}>
              Você não precisa decorar uma senha. Enviaremos um link seguro e temporário.
            </p>
          </form>
        )}

        <div className={styles.switchMode}>
          <span>{isSignup ? 'Já possui cadastro?' : 'É sua primeira compra?'}</span>
          <Link
            href={`/loja/entrar?modo=${isSignup ? 'entrar' : 'cadastro'}&retorno=${encodeURIComponent(returnPath)}`}
          >
            {isSignup ? 'Entrar na minha conta' : 'Criar minha conta'}
          </Link>
        </div>

        <Link href="/loja" className={styles.guestLink}>
          Continuar como visitante
        </Link>
      </section>
    </main>
  );
}
