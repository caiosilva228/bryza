import { MainLayout } from '@/components/layout/MainLayout';
import { DashboardService } from '@/services/dashboard';
import { DashboardBlock } from '@/components/dashboard/DashboardBlock';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MiniTable } from '@/components/dashboard/MiniTable';
import { DashboardFilter } from '@/components/dashboard/DashboardFilter';
import { MetaCard } from '@/components/dashboard/MetaCard';
import { MetasService, calcularDiasUteisRestantes } from '@/services/metas';
import { formatCurrency } from '@/utils/format';
import { format, parseISO } from 'date-fns';
import styles from './page.module.css';

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ data?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { data: paramData } = await searchParams;
  const referenceDateStr = paramData || new Date().toISOString();
  const dateObj = parseISO(referenceDateStr);
  const periodo = format(dateObj, 'yyyy-MM');
  
  const stats = await DashboardService.getAdminStats(referenceDateStr);

  // Meta mensal do período selecionado
  const metaMensal = await MetasService.getMetaMensal(periodo);
  
  const { diasUteisTotal, diasUteisRestantes } = calcularDiasUteisRestantes(dateObj);

  return (
    <MainLayout>
      <div className={styles.dashWrapper}>
        <header style={{ marginBottom: '32px' }}>
          <h1 className={styles.dashTitle}>
            BRYZA <span style={{ color: 'var(--color-primary)' }}>ADMIN</span>
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)', fontWeight: 500, margin: 0 }}>
            Visão operacional e controle completo da empresa.
          </p>
        </header>

        <DashboardFilter />

        {/* BLOCO 0 — META */}
        {metaMensal > 0 && (
          <MetaCard
            metaMensal={metaMensal}
            faturamentoMes={stats.financeiro.faturamento_mes}
            diasUteisRestantes={diasUteisRestantes}
            diasUteisTotal={diasUteisTotal}
          />
        )}

        {/* BLOCO 1 — FINANCEIRO */}
        <DashboardBlock title="Financeiro" icon="payments">
          <MetricCard 
            label="Faturamento do Dia" 
            value={formatCurrency(stats.financeiro.faturamento_dia).replace('R$', '')} 
            prefix="R$"
            variation={stats.financeiro.variacoes.dia}
            icon="today"
          />
          <MetricCard 
            label="Faturamento da Semana" 
            value={formatCurrency(stats.financeiro.faturamento_semana).replace('R$', '')} 
            prefix="R$"
            variation={stats.financeiro.variacoes.semana}
            icon="calendar_view_week"
          />
          <MetricCard 
            label="Faturamento do Mês" 
            value={formatCurrency(stats.financeiro.faturamento_mes).replace('R$', '')} 
            prefix="R$"
            variation={stats.financeiro.variacoes.mes}
            icon="calendar_month"
          />
          <MetricCard 
            label="Ticket Médio" 
            value={formatCurrency(stats.financeiro.ticket_medio).replace('R$', '')} 
            prefix="R$"
            icon="analytics"
          />
        </DashboardBlock>

        {/* GRID: bloco principal + coluna lateral */}
        <div className={styles.dashTwoCol}>
          {/* BLOCO 2 — PEDIDOS & RANKINGS (COLUNA LARGA) */}
          <div className={styles.dashColWide}>
            <DashboardBlock title="Resumo de Pedidos" icon="shopping_cart" columns={2}>
              <MetricCard 
                label="Aguardando Preparação" 
                value={stats.pedidos.aguardando_preparacao} 
                className={{ style: { borderLeft: '6px solid var(--color-tertiary-fixed-dim)' } } as any} 
              />
              <MetricCard 
                label="Pronto p/ Entrega" 
                value={stats.pedidos.pronto_para_entrega} 
                className={{ style: { borderLeft: '6px solid var(--color-primary-fixed-dim)' } } as any} 
              />
              <MetricCard 
                label="Pedidos em Rota" 
                value={stats.pedidos.em_rota} 
                className={{ style: { borderLeft: '6px solid var(--color-secondary-fixed-dim)' } } as any} 
              />
              <MetricCard 
                label="Entregues Hoje" 
                value={stats.pedidos.entregue_hoje} 
                className={{ style: { borderLeft: '6px solid var(--color-tertiary)' } } as any} 
              />
              <MetricCard 
                label="Finalizados Hoje" 
                value={stats.pedidos.finalizados_hoje} 
                className={{ style: { borderLeft: '6px solid var(--color-inverse-surface)' } } as any} 
              />
            </DashboardBlock>
            
            <div className={styles.dashMiniGrid}>
              <MiniTable 
                title="Top Vendedores (Mês)" 
                data={stats.vendedores.ranking}
                columns={[
                  { header: 'VENDEDOR', accessor: 'nome' },
                  { header: 'TOTAL', accessor: 'faturamento', align: 'right', format: (v) => formatCurrency(v) },
                  { header: 'VENDAS', accessor: 'vendas_count', align: 'center' }
                ]}
              />
              <MiniTable 
                title="Top Produtos (Mês)" 
                data={stats.estoque.top_produtos}
                columns={[
                  { header: 'PRODUTO', accessor: 'nome_produto' },
                  { header: 'QTD', accessor: 'quantidade_vendida', align: 'center' }
                ]}
              />
            </div>
          </div>

          {/* BLOCO CLIENTES & ALERTAS (COLUNA LATERAL) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <DashboardBlock title="Performance de Clientes" icon="group" columns={1}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <MetricCard label="Novos Hoje" value={stats.clientes.novos_hoje} icon="person_add" />
                <MetricCard label="Ativos Mês" value={stats.clientes.ativos_mes} icon="verified_user" />
                <MetricCard label="Recorrentes" value={stats.clientes.recorrentes} icon="repeat" />
                <MetricCard 
                  label="Inativos" 
                  value={stats.clientes.inativos} 
                  icon="person_off" 
                  className={{ style: { color: 'var(--color-error)' } } as any} 
                />
              </div>
            </DashboardBlock>

            <DashboardBlock title="Alertas Críticos" icon="warning" columns={1}>
              <div style={{ 
                backgroundColor: 'rgba(186, 26, 26, 0.05)', 
                padding: '20px', 
                borderRadius: '20px', 
                border: '1px solid rgba(186, 26, 26, 0.1)', 
                marginBottom: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-error)', fontWeight: 800, marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>inventory_2</span>
                  ESTOQUE BAIXO
                </div>
                <p style={{ fontSize: '32px', fontWeight: 900, color: 'var(--color-error)', margin: 0, letterSpacing: '-0.02em' }}>
                  {stats.estoque.itens_baixo_estoque} 
                  <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: '8px', opacity: 0.8 }}>itens no limite</span>
                </p>
              </div>
              
              <div style={{ 
                backgroundColor: 'rgba(164, 114, 0, 0.05)', 
                padding: '20px', 
                borderRadius: '20px', 
                border: '1px solid rgba(164, 114, 0, 0.1)' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a47200', fontWeight: 800, marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>schedule</span>
                  LOGÍSTICA
                </div>
                <p style={{ fontSize: '32px', fontWeight: 900, color: '#a47200', margin: 0, letterSpacing: '-0.02em' }}>
                  {stats.logistica.pedidos_atrasados} 
                  <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: '8px', opacity: 0.8 }}>entregas atrasadas</span>
                </p>
              </div>
            </DashboardBlock>
          </div>
        </div>

        {/* LOGÍSTICA & PERFORMANCE */}
        <DashboardBlock title="Métricas de Eficiência" icon="speed" columns={3}>
          <MetricCard 
            label="Sucesso de Entrega" 
            value={`${stats.logistica.taxa_sucesso_entrega}%`} 
            className={{ style: { borderBottom: '6px solid var(--color-tertiary-container)' } } as any} 
          />
          <MetricCard 
            label="Média de Preparação" 
            value={`${stats.logistica.tempo_medio_preparacao_minutos} min`} 
            className={{ style: { borderBottom: '6px solid var(--color-primary-container)' } } as any} 
          />
          <MetricCard 
            label="Itens Parados" 
            value={stats.estoque.itens_parados} 
            className={{ style: { borderBottom: '6px solid var(--color-secondary-fixed-dim)' } } as any} 
          />
        </DashboardBlock>
      </div>
    </MainLayout>
  );
}
