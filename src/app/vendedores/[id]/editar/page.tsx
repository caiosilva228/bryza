import { MainLayout } from '@/components/layout/MainLayout';
import Link from 'next/link';
import { VendedorForm } from '../../novo/VendedorForm';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';

export const revalidate = 0;

export default async function EditarVendedorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', resolvedParams.id)
    .single();

  if (error || !profile) {
    return notFound();
  }

  return (
    <MainLayout>
      <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <Link href="/vendedores" style={{ 
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
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)' }}>Editar Vendedor</h1>
          <p style={{ color: 'var(--color-on-surface-variant)' }}>Atualize as informações do membro da equipe de vendas.</p>
        </div>

        <div style={{ 
          backgroundColor: 'var(--color-surface-container-lowest)', 
          padding: '32px', 
          borderRadius: '16px', 
          border: '1px solid var(--color-outline-variant)' 
        }}>
          <VendedorForm vendedor={profile} />
        </div>
      </div>
    </MainLayout>
  );
}
