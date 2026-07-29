import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOutCustomer } from './actions';
import styles from './account.module.css';

export default function CustomerAccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={styles.accountRoot}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/loja" aria-label="Voltar para a loja Bryza">
            <Image
              src="/Logo Bryza.svg"
              alt="Bryza"
              width={156}
              height={48}
              priority
            />
          </Link>

          <nav className={styles.desktopNav} aria-label="Navegação da conta">
            <Link className={styles.navLink} href="/loja/minha-conta">
              <span className="material-symbols-outlined" aria-hidden="true">person</span>
              Visão geral
            </Link>
            <Link className={styles.navLink} href="/loja/minha-conta/pedidos">
              <span className="material-symbols-outlined" aria-hidden="true">package_2</span>
              Meus pedidos
            </Link>
            <Link className={styles.backToStore} href="/loja">
              Continuar comprando
            </Link>
            <form action={signOutCustomer}>
              <button className={styles.signOutButton} type="submit">
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>© {new Date().getFullYear()} Bryza. Acompanhe suas compras com tranquilidade.</span>
          <span>Pagamento e entrega aparecem separadamente para maior clareza.</span>
        </div>
      </footer>

      <nav className={styles.mobileNav} aria-label="Navegação móvel da conta">
        <Link className={styles.mobileNavLink} href="/loja">
          <span className="material-symbols-outlined" aria-hidden="true">storefront</span>
          Loja
        </Link>
        <Link className={styles.mobileNavLink} href="/loja/minha-conta">
          <span className="material-symbols-outlined" aria-hidden="true">person</span>
          Minha conta
        </Link>
        <Link className={styles.mobileNavLink} href="/loja/minha-conta/pedidos">
          <span className="material-symbols-outlined" aria-hidden="true">package_2</span>
          Pedidos
        </Link>
        <form action={signOutCustomer}>
          <button className={styles.mobileNavLink} type="submit">
            <span className="material-symbols-outlined" aria-hidden="true">logout</span>
            Sair
          </button>
        </form>
      </nav>
    </div>
  );
}
