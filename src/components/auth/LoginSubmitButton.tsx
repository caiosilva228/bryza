'use client';

import { useFormStatus } from 'react-dom';
import styles from './LoginSubmitButton.module.css';

interface LoginSubmitButtonProps {
  label: string;
  variant?: 'admin' | 'ambassador';
}

export function LoginSubmitButton({ label, variant = 'ambassador' }: LoginSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <>
      <button
        type="submit"
        className={`${styles.button} ${variant === 'admin' ? `${styles.adminButton} admin-submit-btn` : 'submit-btn'}`}
        disabled={pending}
        aria-disabled={pending}
      >
        {pending ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            <span>Autenticando...</span>
          </>
        ) : (
          <>
            <span>{label}</span>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }} aria-hidden="true">east</span>
          </>
        )}
      </button>

      {pending && (
        <div className={styles.overlay} role="status" aria-live="polite" aria-label="Autenticando e preparando seu painel">
          <div className={styles.statusCard}>
            <span className={styles.statusSpinner} aria-hidden="true" />
            <span>Autenticando e preparando seu painel...</span>
          </div>
        </div>
      )}
    </>
  );
}
