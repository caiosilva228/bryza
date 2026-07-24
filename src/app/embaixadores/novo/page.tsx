import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';

export default function NewAmbassadorPage() {
  return (
    <MainLayout>
      <div className="page-wrapper">
        <section style={{ maxWidth: '760px', margin: '40px auto', padding: '32px', borderRadius: '20px', background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '42px', color: 'var(--color-primary)' }}>person_add</span>
          <h1 style={{ color: 'var(--color-primary)' }}>Convide um cliente para o programa</h1>
          <p style={{ color: 'var(--color-on-surface-variant)', lineHeight: 1.7 }}>
            Para evitar identidades duplicadas, embaixadores não são mais criados em um cadastro independente.
            Localize ou cadastre primeiro o cliente, confirme os dados e use a opção “Convidar para o programa”
            nos detalhes do cliente.
          </p>
          <p style={{ color: 'var(--color-on-surface-variant)', lineHeight: 1.7 }}>
            A participação só será ativada depois que a pessoa confirmar a conta e aceitar os termos vigentes.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <Link href="/clientes" className="btn-primary">Ir para clientes</Link>
            <Link href="/clientes/novo" className="btn-secondary">Cadastrar cliente</Link>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
