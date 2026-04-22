import { MainLayout } from '@/components/layout/MainLayout';
import { createClient } from '@/utils/supabase/server';
import { VendedorMetricas } from '@/models/types';
import Link from 'next/link';
import VendedorFilter from './VendedorFilter';

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
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-container-low)', borderBottom: '1px solid var(--color-outline-variant)' }}>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--color-on-surface-variant)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cód.</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--color-on-surface-variant)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome / Contato</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--color-on-surface-variant)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status / Nível</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--color-on-surface-variant)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Região</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--color-on-surface-variant)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Vendas (D/S/M)</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--color-on-surface-variant)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Comissão Acum.</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--color-on-surface-variant)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(vendedor => (
                    <tr
                      key={vendedor.id}
                      className="transition-colors hover:bg-[var(--color-surface-container-low)]"
                      style={{ borderBottom: '1px solid var(--color-outline-variant)' }}
                    >
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ color: 'var(--color-primary)', fontSize: '13px', fontWeight: 700 }}>
                          #{String(vendedor.codigo_vendedor || '0').padStart(4, '0')}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-on-surface)', fontSize: '14px' }}>{vendedor.nome}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>{vendedor.telefone || vendedor.email}</div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {vendedor.ativo ? (
                            <span style={{
                              display: 'inline-flex', padding: '4px 10px', borderRadius: '20px', fontSize: '10px',
                              backgroundColor: '#E6F4EA', color: '#137333', fontWeight: 700, textTransform: 'uppercase',
                              border: '1px solid #ceead6'
                            }}>Ativo</span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', padding: '4px 10px', borderRadius: '20px', fontSize: '10px',
                              backgroundColor: '#FCE8E6', color: '#C5221F', fontWeight: 700, textTransform: 'uppercase',
                              border: '1px solid #fad2cf'
                            }}>Inativo</span>
                          )}
                          <span style={{
                            display: 'inline-flex', padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                            textTransform: 'uppercase',
                            backgroundColor: vendedor.nivel_comissao === 'Ouro' ? '#fff7e0' : vendedor.nivel_comissao === 'Prata' ? '#f1f3f4' : '#faebe0',
                            color: vendedor.nivel_comissao === 'Ouro' ? '#b28900' : vendedor.nivel_comissao === 'Prata' ? '#5f6368' : '#a85f20',
                            border: vendedor.nivel_comissao === 'Ouro' ? '1px solid #ffe082' : vendedor.nivel_comissao === 'Prata' ? '1px solid #dadce0' : '1px solid #eec3a3'
                          }}>
                            {vendedor.nivel_comissao || 'Bronze'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--color-on-surface)', fontSize: '14px' }}>
                        {vendedor.regiao_atuacao || '--'}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', fontSize: '14px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{vendedor.vendas_dia}</span>
                          <span style={{ color: 'var(--color-outline)' }}>/</span>
                          <span style={{ color: 'var(--color-on-surface-variant)' }}>{vendedor.vendas_semana}</span>
                          <span style={{ color: 'var(--color-outline)' }}>/</span>
                          <span style={{ color: 'var(--color-on-surface-variant)' }}>{vendedor.vendas_mes}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 800, color: 'var(--color-on-surface)', fontSize: '15px' }}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(isNaN(vendedor.comissao_acumulada) ? 0 : vendedor.comissao_acumulada)}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <Link href={`/vendedores/${vendedor.id}/editar`} style={{
                          display: 'inline-flex',
                          padding: '8px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--color-surface-container-high)',
                          color: 'var(--color-on-surface-variant)',
                          textDecoration: 'none',
                          transition: 'all 0.2s'
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
