import { MainLayout } from '@/components/layout/MainLayout';
import { getClienteById } from '@/services/clientes';
import { getVendedores, getCurrentProfile } from '@/services/profiles';
import { ClienteForm } from '../../novo/ClienteForm';
import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarClientePage({ params }: Props) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  
  if (!profile) {
    redirect('/login');
  }

  const [cliente, vendedores] = await Promise.all([
    getClienteById(id),
    getVendedores()
  ]);

  if (!cliente) {
    return (
      <MainLayout>
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <h2>Cliente não encontrado</h2>
          <p>O cliente que você está tentando editar não existe ou foi removido.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: 'var(--color-primary)' }}>
            Editar Cliente: {cliente.nome}
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)' }}>
            Altere as informações abaixo para atualizar o cadastro do cliente.
          </p>
        </div>

        <div style={{ 
          backgroundColor: 'var(--color-surface-container-lowest)', 
          padding: '32px', 
          borderRadius: '16px', 
          border: '1px solid var(--color-outline-variant)' 
        }}>
          <ClienteForm 
            profile={profile} 
            vendedores={vendedores} 
            isVendedor={profile.role === 'vendedor'} 
            initialData={cliente}
          />
        </div>
      </div>
    </MainLayout>
  );
}
