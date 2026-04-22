import { MainLayout } from '@/components/layout/MainLayout';
import { getVendedores, getCurrentProfile } from '@/services/profiles';
import { salvarCliente } from '../actions';
import Link from 'next/link';
import { ClienteForm } from './ClienteForm';

export const revalidate = 0;

export default async function NovoClientePage() {
  const profile = await getCurrentProfile();
  const vendedores = await getVendedores();

  const isVendedor = profile?.role === 'vendedor';

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid var(--color-outline-variant)',
    fontFamily: 'var(--font-body)',
    fontSize: '16px',
    backgroundColor: 'var(--color-surface-container-lowest)',
    color: 'var(--color-on-surface)',
    marginBottom: '16px',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--color-on-surface-variant)'
  };

  return (
    <MainLayout>
      <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <Link href="/clientes" style={{ 
            color: 'var(--color-primary)', 
            textDecoration: 'none', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '16px',
            fontWeight: 600
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
            Voltar para Listagem
          </Link>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)' }}>Novo Cliente</h1>
          <p style={{ color: 'var(--color-on-surface-variant)' }}>Cadastre as informações da conta para começar seu funil.</p>
        </div>

        <div style={{ 
          backgroundColor: 'var(--color-surface-container-lowest)', 
          padding: '32px', 
          borderRadius: '16px', 
          border: '1px solid var(--color-outline-variant)' 
        }}>
          <ClienteForm profile={profile} vendedores={vendedores} isVendedor={isVendedor} />
        </div>
      </div>
    </MainLayout>
  );
}
