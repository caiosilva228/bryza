import { MainLayout } from '@/components/layout/MainLayout';
import { createClient } from '@/utils/supabase/server';
import { VendedorMetricas } from '@/models/types';
import Link from 'next/link';
import VendedorFilter from './VendedorFilter';
import VendedoresTable from './VendedoresTable';

export const revalidate = 0; // Garantir atualização em tempo real

export default async function VendedoresPage({
  searchParams
}: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {

  const supabase = await createClient();
  const [resolvedParams, { data: vendedores }] = await Promise.all([
    searchParams,
    supabase.rpc('get_vendedores_com_metricas')
  ]);

  let lista = (vendedores as VendedorMetricas[]) || [];

  // Filtros resolvidos
  const filtroNome = typeof resolvedParams.nome === 'string' ? resolvedParams.nome.toLowerCase() : '';
  const filtroStatus = typeof resolvedParams.status === 'string' ? resolvedParams.status : '';
  const filtroNivel = typeof resolvedParams.nivel === 'string' ? resolvedParams.nivel : '';

  if (filtroNome) lista = lista.filter(v => v.nome.toLowerCase().includes(filtroNome));
  if (filtroStatus === 'ativo') lista = lista.filter(v => v.ativo === true);
  if (filtroStatus === 'inativo') lista = lista.filter(v => v.ativo === false);
  if (filtroNivel) lista = lista.filter(v => v.nivel_comissao === filtroNivel);

  return (
    <MainLayout>
      <div className="page-wrapper">
        <div className="page-header">
          <div className="page-header-text">
            <h1 style={{ color: 'var(--color-primary)' }}>Equipe de Vendas</h1>
            <p>Gerencie os vendedores, ative ou inative contas.</p>
          </div>
          <div className="page-header-actions">
            <Link href="/vendedores/novo" className="btn-primary">
              <span className="material-symbols-outlined">add</span>
              Novo Vendedor
            </Link>
          </div>
        </div>


        {/* Filtros Automáticos (Client Component) */}
        <VendedorFilter />

        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          border: '1px solid var(--color-outline-variant)',
          overflow: 'hidden',
          minHeight: '300px'
        }}>
          {lista.length === 0 ? (
            <div style={{
              padding: '80px 32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--color-surface-container-low)'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-surface-container-high)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-outline-variant)' }}>person_off</span>
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '8px' }}>Nenhum vendedor encontrado</h3>
              <p style={{ color: 'var(--color-on-surface-variant)', maxWidth: '400px', margin: '0 auto' }}>
                Não encontramos vendedores que atendam aos filtros aplicados. Tente ajustar sua busca ou limpar os filtros.
              </p>
              <Link href="/vendedores" style={{
                marginTop: '24px',
                color: 'var(--color-primary)',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>restart_alt</span>
                Ver todos os vendedores
              </Link>
            </div>
          ) : (
            <VendedoresTable lista={lista} />
          )}
        </div>
      </div>
    </MainLayout>
  );
}
