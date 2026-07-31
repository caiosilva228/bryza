'use client';

import { useState } from 'react';
import { ArrowRight, Check, Copy, Gift, ShieldCheck, X } from 'lucide-react';
import styles from './AmbassadorAccessPrompt.module.css';

export type AmbassadorAccessInfo = {
  available: boolean;
  login: string | null;
  temporary_password_is_phone: boolean;
};

function ambassadorLoginUrl(login: string) {
  const params = new URLSearchParams({ identifier: login });
  if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
    return `/embaixador/login?${params.toString()}`;
  }
  return `https://ev.bryza.com.br/login?${params.toString()}`;
}

export function AmbassadorAccessPrompt({ access }: { access: AmbassadorAccessInfo }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'login' | 'password' | null>(null);
  const login = (access.login || '').replace(/\D/g, '');

  if (!access.available || !login) return null;

  const copyValue = async (value: string, field: 'login' | 'password') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      window.setTimeout(() => setCopied(current => current === field ? null : current), 1800);
    } catch {
      setCopied(null);
    }
  };

  return (
    <>
      <section className={styles.benefitCard} aria-label="Benefício do Programa de Embaixadores">
        <span className={styles.giftIcon}><Gift size={26} /></span>
        <div className={styles.benefitCopy}>
          <span className={styles.eyebrow}>Benefício liberado</span>
          <h4>Você ganhou acesso ao Programa de Embaixadores Bryza!</h4>
          <p>Acompanhe seus resultados, compartilhe seu link e receba comissões pelas suas indicações.</p>
        </div>
        <button type="button" className={styles.accessButton} onClick={() => setOpen(true)}>
          Ver meu acesso e entrar <ArrowRight size={18} />
        </button>
      </section>

      {open && (
        <div className={styles.overlay} role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ambassador-access-title">
            <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label="Fechar dados de acesso">
              <X size={20} />
            </button>

            <span className={styles.shieldIcon}><ShieldCheck size={34} /></span>
            <span className={styles.modalEyebrow}>Seu acesso está pronto</span>
            <h3 id="ambassador-access-title">Entre no painel do embaixador</h3>
            <p className={styles.modalDescription}>
              Use o número de telefone informado no pedido. Digite somente os números.
            </p>

            <div className={styles.credentials}>
              <div className={styles.credentialRow}>
                <div>
                  <span>Login</span>
                  <strong>{login}</strong>
                </div>
                <button type="button" onClick={() => void copyValue(login, 'login')} aria-label="Copiar login">
                  {copied === 'login' ? <Check size={18} /> : <Copy size={18} />}
                  {copied === 'login' ? 'Copiado' : 'Copiar'}
                </button>
              </div>

              <div className={styles.credentialRow}>
                <div>
                  <span>{access.temporary_password_is_phone ? 'Senha temporária' : 'Senha'}</span>
                  <strong>{access.temporary_password_is_phone ? login : 'Sua senha atual'}</strong>
                </div>
                {access.temporary_password_is_phone && (
                  <button type="button" onClick={() => void copyValue(login, 'password')} aria-label="Copiar senha temporária">
                    {copied === 'password' ? <Check size={18} /> : <Copy size={18} />}
                    {copied === 'password' ? 'Copiado' : 'Copiar'}
                  </button>
                )}
              </div>
            </div>

            <div className={styles.securityNote}>
              <ShieldCheck size={18} />
              <span>
                {access.temporary_password_is_phone
                  ? 'No primeiro acesso, você será orientado a criar uma nova senha segura.'
                  : 'Esta conta já realizou o primeiro acesso. Use a senha que você cadastrou.'}
              </span>
            </div>

            <button
              type="button"
              className={styles.panelButton}
              onClick={() => window.location.assign(ambassadorLoginUrl(login))}
            >
              Ir para o painel do embaixador <ArrowRight size={19} />
            </button>
          </section>
        </div>
      )}
    </>
  );
}
