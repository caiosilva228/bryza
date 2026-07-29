'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import styles from './account.module.css';

export default function CustomerAccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro ao carregar a conta do cliente:', error);
  }, [error]);

  return (
    <section className={styles.errorState} role="alert">
      <span className={styles.errorIcon}>
        <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
      </span>
      <h2>Não foi possível carregar sua conta</h2>
      <p>
        Tivemos uma dificuldade temporária para buscar seus pedidos. Tente
        novamente ou volte para a loja.
      </p>
      <div className={`${styles.statusRow} ${styles.centeredActions}`}>
        <button className={styles.primaryButton} type="button" onClick={reset}>
          Tentar novamente
        </button>
        <Link className={styles.secondaryButton} href="/loja">
          Voltar para a loja
        </Link>
      </div>
    </section>
  );
}
