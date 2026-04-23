import { MainLayout } from '@/components/layout/MainLayout';
import { DashboardService } from '@/services/dashboard';
import { DashboardBlock } from '@/components/dashboard/DashboardBlock';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MiniTable } from '@/components/dashboard/MiniTable';
import { DashboardFilter } from '@/components/dashboard/DashboardFilter';
import { MetaCard } from '@/components/dashboard/MetaCard';
import { MetasService, calcularDiasUteisRestantes } from '@/services/metas';
import { formatCurrency } from '@/utils/format';
import { format, parseISO, subDays, startOfMonth, startOfYesterday } from 'date-fns';
import styles from './page.module.css';

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ data?: string; periodo?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { data: paramData, periodo } = await searchParams;

  // Resolve a data de referência a partir do preset ou do date picker
  let referenceDateStr: string;
  if (periodo === 'yesterday') {
    referenceDateStr = startOfYesterday().toISOString();
  } else if (periodo === '7d') {
    referenceDateStr = subDays(new Date(), 7).toISOString();
  } else if (periodo === '30d') {
    referenceDateStr = subDays(new Date(), 30).toISOString();
  } else if (periodo === 'month') {
    referenceDateStr = startOfMonth(new Date()).toISOString();
  } else if (paramData) {
    referenceDateStr = paramData;
  } else {
    referenceDateStr = new Date().toISOString();
  }

  const dateObj = parseISO(referenceDateStr);
  const periodoMes = format(dateObj, 'yyyy-MM');

  const stats = await DashboardService.getAdminStats(referenceDateStr);

  // Meta mensal do período selecionado
  const metaMensal = await MetasService.getMetaMensal(periodoMes);
  
  const { diasUteisTotal, diasUteisRestantes } = calcularDiasUteisRestantes(dateObj);

  return (
    <MainLayout>
      <div className={styles.dashWrapper}>
        <header style={{ marginBottom: '40px' }}>
          <h1 className={styles.dashTitle}>
            BRYZA <span style={{ color: 'var(--color-primary)' }}>ADMIN</span>
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)', fontWeight: 500, fontSize: '15px', margin: 0, opacity: 0.8 }}>
            Visão operacional e controle de performance.
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
            label="HOJE" 
            value={formatCurrency(stats.financeiro.faturamento_dia).replace('R$', '')} 
            prefix="R$"
            suffix="Faturamento"
            variation={stats.financeiro.variacoes.dia}
            icon="today"
          />
          <MetricCard 
            label="SEMANA" 
            value={formatCurrency(stats.financeiro.faturamento_semana).replace('R$', '')} 
            prefix="R$"
            suffix="Faturamento"
            variation={stats.financeiro.variacoes.semana}
            icon="calendar_view_week"
          />
          <MetricCard 
            label="ESTE MÊS" 
            value={formatCurrency(stats.financeiro.faturamento_mes).replace('R$', '')} 
            prefix="R$"
            suffix="Faturamento"
            variation={stats.financeiro.variacoes.mes}
            icon="calendar_month"
          />
          <MetricCard 
            label="PERFORMANCE" 
            value={formatCurrency(stats.financeiro.ticket_medio).replace('R$', '')} 
            prefix="R$"
            suffix="Ticket Médio"
            icon="analytics"
          />
        </DashboardBlock>

        {/* GRID: bloco principal + coluna lateral */}
        <div className={styles.dashTwoCol}>
          {/* BLOCO 2 — PEDIDOS & RANKINGS (COLUNA LARGA) */}
          <div className={styles.dashColWide}>
            <DashboardBlock title="Resumo de Pedidos" icon="shopping_cart" columns={2}>
              <MetricCard 
                label="EM PREPARAÇÃO" 
                value={stats.pedidos.aguardando_preparacao} 
                suffix="Fila Técnica"
                icon="hourglass_top"
                colorHint="warning"
              />
              <MetricCard 
                label="PRONTO ENTREGA" 
                value={stats.pedidos.pronto_para_entrega} 
                suffix="Expedição"
                icon="check_circle"
                colorHint="primary"
              />
              <MetricCard 
                label="EM ROTA" 
                value={stats.pedidos.em_rota} 
                suffix="Logística"
                icon="local_shipping"
                colorHint="secondary"
              />
              <MetricCard 
                label="ENTREGUES" 
                value={stats.pedidos.entregue_hoje} 
                suffix="Hoje"
                icon="inventory"
                colorHint="tertiary"
              />
              <MetricCard 
                label="FINALIZADOS" 
                value={stats.pedidos.finalizados_hoje} 
                suffix="Arquivo"
                icon="task_alt"
                colorHint="success"
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
            <DashboardBlock title="Performance de Clientes" icon="group" columns={2}>
              <MetricCard label="NOVOS HOJE" value={stats.clientes.novos_hoje} suffix="Expansão" icon="person_add" />
              <MetricCard label="ATIVOS MÊS" value={stats.clientes.ativos_mes} suffix="Retenção" icon="verified_user" />
              <MetricCard label="RECORRENTES" value={stats.clientes.recorrentes} suffix="Fidelidade" icon="repeat" />
              <MetricCard 
                label="INATIVOS" 
                value={stats.clientes.inativos} 
                suffix="Churn"
                icon="person_off" 
                colorHint="error"
              />
            </DashboardBlock>

            <DashboardBlock title="Alertas Críticos" icon="warning" columns={1}>
              <div style={{ 
                backgroundColor: 'var(--color-error-container)', 
                padding: '24px', 
                borderRadius: '24px', 
                border: '1px solid rgba(186, 26, 26, 0.1)', 
                marginBottom: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-error)', fontWeight: 700, marginBottom: '12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>inventory_2</span>
                  Estoque Baixo
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-error)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {stats.estoque.itens_baixo_estoque} 
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-error)', opacity: 0.8 }}>itens no limite</span>
                </div>
              </div>
              
              <div style={{ 
                backgroundColor: 'rgba(164, 114, 0, 0.05)', 
                padding: '24px', 
                borderRadius: '24px', 
                border: '1px solid rgba(164, 114, 0, 0.1)' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a47200', fontWeight: 700, marginBottom: '12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>schedule</span>
                  Atrasos Logísticos
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 800, color: '#a47200', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {stats.logistica.pedidos_atrasados} 
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 500, color: '#a47200', opacity: 0.8 }}>entregas pendentes</span>
                </div>
              </div>
            </DashboardBlock>
          </div>
        </div>

        {/* LOGÍSTICA & PERFORMANCE */}
        <DashboardBlock title="Métricas de Eficiência" icon="speed" columns={3}>
          <MetricCard 
            label="Sucesso de Entrega" 
            value={`${stats.logistica.taxa_sucesso_entrega}%`} 
            icon="verified"
            colorHint="tertiary"
          />
          <MetricCard 
            label="Média de Preparação" 
            value={`${stats.logistica.tempo_medio_preparacao_minutos} min`} 
            icon="timelapse"
            colorHint="primary"
          />
          <MetricCard 
            label="Itens Parados" 
            value={stats.estoque.itens_parados} 
            icon="production_quantity_limits"
            colorHint="secondary"
          />
        </DashboardBlock>
      </div>
    </MainLayout>
  );
}
