import { MainLayout } from '@/components/layout/MainLayout';
import { getClientes } from '@/services/clientes';
import { getVendedores } from '@/services/profiles';
import Link from 'next/link';
import ClienteFilter from './ClienteFilter';
import ClienteTable from './ClienteTable';

export const revalidate = 0; // Garantir atualização em tempo real no dashboard

export default async function ClientesPage({
  searchParams
}: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const [clientesData, vendedores, resolvedParams] = await Promise.all([
    getClientes(),
    getVendedores(),
    searchParams
  ]);

  // Filtros resolvidos
  const search = typeof resolvedParams.search === 'string' ? resolvedParams.search.toLowerCase() : '';
  const vendedorId = typeof resolvedParams.vendedor === 'string' ? resolvedParams.vendedor : '';
  const status = typeof resolvedParams.status === 'string' ? resolvedParams.status : '';
  const cidade = typeof resolvedParams.cidade === 'string' ? resolvedParams.cidade.toLowerCase() : '';

  let filteredClientes = clientesData;

  // Filtro por termo de busca (Nome ou ID)
  if (search) {
    filteredClientes = filteredClientes.filter(c => 
      c.nome.toLowerCase().includes(search) || 
      `C${String(c.codigo_cliente || 0).padStart(5, '0')}`.toLowerCase().includes(search)
    );
  }

  // Filtro por Vendedor
  if (vendedorId) {
    filteredClientes = filteredClientes.filter(c => c.vendedor_responsavel_id === vendedorId);
  }

  // Filtro por Status
  if (status) {
    filteredClientes = filteredClientes.filter(c => c.status_cliente === status);
  }

  // Filtro por Cidade
  if (cidade) {
    filteredClientes = filteredClientes.filter(c => c.cidade.toLowerCase().includes(cidade));
  }

  return (
    <MainLayout>
      <div className="page-wrapper">
        {/* Cabeçalho */}
        <div className="page-header">
          <div className="page-header-text">
            <h1 style={{ color: 'var(--color-primary)' }}>Gestão de Clientes</h1>
            <p>Gerencie sua carteira de clientes, histórico de vendas e métricas LTV.</p>
          </div>
          <div className="page-header-actions">
            <Link href="/clientes/novo" className="btn-primary">
              <span className="material-symbols-outlined">add</span>
              Novo Cliente
            </Link>
          </div>
        </div>


        {/* Filtros Automáticos (Client Component) */}
        <ClienteFilter vendedores={vendedores} />

        <div style={{ 
          backgroundColor: 'var(--color-surface-container-lowest)', 
          borderRadius: '16px', 
          border: '1px solid var(--color-outline-variant)',
          overflow: 'hidden',
          minHeight: '200px'
        }}>
          {filteredClientes.length === 0 ? (
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
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-outline-variant)' }}>search_off</span>
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '8px' }}>Nenhum cliente encontrado</h3>
              <p style={{ color: 'var(--color-on-surface-variant)', maxWidth: '400px', margin: '0 auto' }}>
                Não encontramos resultados para os filtros aplicados. Tente ajustar sua busca ou limpar os filtros para ver toda a lista.
              </p>
              <Link href="/clientes" style={{ 
                marginTop: '24px', 
                color: 'var(--color-primary)', 
                fontWeight: 600, 
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>restart_alt</span>
                Ver todos os clientes
              </Link>
            </div>
          ) : (
            <ClienteTable clientes={filteredClientes} />
          )}
        </div>
      </div>
    </MainLayout>
  );
}


