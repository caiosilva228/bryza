import Link from 'next/link';
import styles from '../../account.module.css';

export default function CustomerOrderNotFound() {
  return (
    <section className={styles.emptyState}>
      <span className={styles.emptyIcon}>
        <span className="material-symbols-outlined" aria-hidden="true">search_off</span>
      </span>
      <h2>Pedido não encontrado</h2>
      <p>
        Este pedido pode não existir ou não estar disponível para a sua conta.
      </p>
      <Link className={styles.primaryButton} href="/loja/minha-conta/pedidos">
        Voltar aos meus pedidos
      </Link>
    </section>
  );
}
