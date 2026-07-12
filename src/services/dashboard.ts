import { createClient } from '@/utils/supabase/server';
import { AdminDashboardData } from '@/models/types';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, parseISO, differenceInDays } from 'date-fns';

/**
 * Serviço central de métricas para o Dashboard Administrativo.
 * Focado em performance e visão operacional em tempo real.
 */
export const DashboardService = {
  /**
   * Obtém todas as métricas do dashboard para uma faixa de datas (início e fim).
   * Por padrão, se não informadas, assume o dia de hoje.
   */
  async getAdminStats(startDate?: string, endDate?: string): Promise<AdminDashboardData> {
    const supabase = await createClient();
    
    const today = new Date();
    const defaultStart = startOfDay(today).toISOString();
    const defaultEnd = endOfDay(today).toISOString();

    const pStart = startDate ? startOfDay(parseISO(startDate)).toISOString() : defaultStart;
    const pEnd = endDate ? endOfDay(parseISO(endDate)).toISOString() : defaultEnd;
    
    // Intervalos operacionais fixos para Hoje
    const todayStart = startOfDay(today).toISOString();
    const todayEnd = endOfDay(today).toISOString();
    
    // Intervalos para Ontem (para variação rápida de hoje)
    const yesterdayStart = startOfDay(subDays(today, 1)).toISOString();
    const yesterdayEnd = endOfDay(subDays(today, 1)).toISOString();

    // Intervalos para a Semana (Segunda a Domingo)
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }).toISOString();
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 }).toISOString();
    const lastWeekStart = startOfWeek(subDays(today, 7), { weekStartsOn: 1 }).toISOString();
    const lastWeekEnd = endOfWeek(subDays(today, 7), { weekStartsOn: 1 }).toISOString();

    // Intervalos para o Mês de referência (baseado no final do período para meta mensal)
    const refDate = endDate ? parseISO(endDate) : today;
    const monthStart = startOfMonth(refDate).toISOString();
    const monthEnd = endOfMonth(refDate).toISOString();
    const lastMonthStart = startOfMonth(subMonths(refDate, 1)).toISOString();
    const lastMonthEnd = endOfMonth(subMonths(refDate, 1)).toISOString();

    // Período anterior equivalente para comparação
    const parsedStart = parseISO(pStart);
    const parsedEnd = parseISO(pEnd);
    const diffDays = differenceInDays(parsedEnd, parsedStart) + 1;
    const prevPeriodStart = subDays(parsedStart, diffDays).toISOString();
    const prevPeriodEnd = subDays(parsedEnd, diffDays).toISOString();

    // 1. FINANCEIRO (Busca via RPC para performance)
    const [
      { data: fatDiaData },
      { data: fatOntemData },
      { data: fatSemanaData },
      { data: fatSemanaPassadaData },
      { data: fatMesData },
      { data: fatMesPassadoData },
      { data: fatPeriodoData },
      { data: fatPeriodoAnteriorData }
    ] = await Promise.all([
      supabase.rpc('get_faturamento_periodo', { p_inicio: todayStart, p_fim: todayEnd }),
      supabase.rpc('get_faturamento_periodo', { p_inicio: yesterdayStart, p_fim: yesterdayEnd }),
      supabase.rpc('get_faturamento_periodo', { p_inicio: weekStart, p_fim: weekEnd }),
      supabase.rpc('get_faturamento_periodo', { p_inicio: lastWeekStart, p_fim: lastWeekEnd }),
      supabase.rpc('get_faturamento_periodo', { p_inicio: monthStart, p_fim: monthEnd }),
      supabase.rpc('get_faturamento_periodo', { p_inicio: lastMonthStart, p_fim: lastMonthEnd }),
      supabase.rpc('get_faturamento_periodo', { p_inicio: pStart, p_fim: pEnd }),
      supabase.rpc('get_faturamento_periodo', { p_inicio: prevPeriodStart, p_fim: prevPeriodEnd }),
    ]);

    const faturamento_dia = Number(fatDiaData) || 0;
    const faturamento_semana = Number(fatSemanaData) || 0;
    const faturamento_mes = Number(fatMesData) || 0;
    const faturamento_periodo = Number(fatPeriodoData) || 0;
    const faturamento_periodo_anterior = Number(fatPeriodoAnteriorData) || 0;
    
    const var_dia = calculateVariation(faturamento_dia, Number(fatOntemData) || 0);
    const var_semana = calculateVariation(faturamento_semana, Number(fatSemanaPassadaData) || 0);
    const var_mes = calculateVariation(faturamento_mes, Number(fatMesPassadoData) || 0);
    const var_periodo = calculateVariation(faturamento_periodo, faturamento_periodo_anterior);

    // Ticket Médio do Mês (fallback de compatibilidade)
    const { count: totalVendasMes } = await supabase
      .from('vendas')
      .select('*', { count: 'exact', head: true })
      .gte('data_venda', monthStart)
      .lte('data_venda', monthEnd)
      .not('status_venda', 'eq', 'cancelado');

    const ticket_medio = totalVendasMes ? (faturamento_mes / totalVendasMes) : 0;

    // Ticket Médio do Período
    const { count: totalVendasPeriodo } = await supabase
      .from('vendas')
      .select('*', { count: 'exact', head: true })
      .gte('data_venda', pStart)
      .lte('data_venda', pEnd)
      .not('status_venda', 'eq', 'cancelado');

    const ticket_medio_periodo = totalVendasPeriodo ? (faturamento_periodo / totalVendasPeriodo) : 0;

    // 2. PEDIDOS (Status operacional e eventos do período)
    // 2.1 Pedidos Pendentes (Snapshot atual global)
    const { data: pedidosPendentes } = await supabase
      .from('pedidos')
      .select('status_pedido')
      .not('status_pedido', 'in', '("finalizado","cancelado")');
    
    const countStatus = (status: string) => pedidosPendentes?.filter(p => p.status_pedido === status).length || 0;
    
    // 2.2 Eventos do Dia
    const { count: entregue_hoje } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('status_pedido', 'entregue')
      .gte('updated_at', todayStart)
      .lte('updated_at', todayEnd);

    const { count: finalizados_hoje } = await supabase
      .from('vendas')
      .select('*', { count: 'exact', head: true })
      .gte('data_venda', todayStart)
      .lte('data_venda', todayEnd);

    // 2.3 Eventos do Período
    const { count: entregue_periodo } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('status_pedido', 'entregue')
      .gte('updated_at', pStart)
      .lte('updated_at', pEnd);

    const { count: finalizados_periodo } = await supabase
      .from('vendas')
      .select('*', { count: 'exact', head: true })
      .gte('data_venda', pStart)
      .lte('data_venda', pEnd);

    // 3. CLIENTES
    const { count: novosHoje } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .gte('data_cadastro', todayStart)
      .lte('data_cadastro', todayEnd);

    const { count: novosPeriodo } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .gte('data_cadastro', pStart)
      .lte('data_cadastro', pEnd);

    const { data: statsClientes } = await supabase
      .from('clientes')
      .select('status_cliente, total_compras');

    // 4. VENDEDORES (Ranking no período)
    const { data: ranking } = await supabase.rpc('get_ranking_vendedores', { 
      p_inicio: pStart, 
      p_fim: pEnd 
    });

    // 5. ESTOQUE
    const { data: produtosEstoque } = await supabase
      .from('produtos')
      .select('id, nome_produto, estoque_atual, estoque_minimo');
    
    const itens_baixo_estoque = produtosEstoque?.filter(p => p.estoque_atual <= p.estoque_minimo).length || 0;

    // Top Produtos no período
    const { data: top_produtos } = await supabase.rpc('get_top_produtos', {
      p_inicio: pStart,
      p_fim: pEnd
    });

    // Itens parados (> 60 dias sem venda em relação a hoje)
    const sessentaDiasAtras = subDays(today, 60).toISOString();
    
    const { data: vendasRecentes } = await supabase
      .from('vendas')
      .select('id')
      .gte('data_venda', sessentaDiasAtras);
    
    const idsVendas = vendasRecentes?.map(v => v.id) || [];
    
    const { data: produtosVendidosRecente } = idsVendas.length > 0 
      ? await supabase.from('venda_itens').select('produto_id').in('venda_id', idsVendas)
      : { data: [] };

    const idsVendidos = new Set(produtosVendidosRecente?.map(p => p.produto_id));
    const itens_parados = produtosEstoque?.filter(p => !idsVendidos.has(p.id)).length || 0;

    return {
      financeiro: {
        faturamento_dia,
        faturamento_semana,
        faturamento_mes,
        ticket_medio,
        faturamento_periodo,
        variacao_periodo: var_periodo,
        ticket_medio_periodo,
        variacoes: {
          dia: var_dia,
          semana: var_semana,
          mes: var_mes
        }
      },
      pedidos: {
        aguardando_preparacao: countStatus('aguardando_preparacao'),
        pronto_para_entrega: countStatus('pronto_para_entrega'),
        em_rota: countStatus('em_rota'),
        entregue_hoje: entregue_hoje || 0,
        finalizados_hoje: finalizados_hoje || 0,
        entregue_periodo: entregue_periodo || 0,
        finalizados_periodo: finalizados_periodo || 0,
        pendentes_total: pedidosPendentes?.length || 0
      },
      clientes: {
        novos_hoje: novosHoje || 0,
        novos_periodo: novosPeriodo || 0,
        ativos_mes: statsClientes?.filter(c => c.total_compras > 0).length || 0,
        recorrentes: statsClientes?.filter(c => c.status_cliente === 'recorrente').length || 0,
        inativos: statsClientes?.filter(c => c.status_cliente === 'inativo').length || 0
      },
      vendedores: {
        ranking: ranking || []
      },
      estoque: {
        itens_baixo_estoque,
        top_produtos: top_produtos || [],
        itens_parados
      },
      logistica: {
        taxa_sucesso_entrega: 100,
        pedidos_atrasados: 0,
        tempo_medio_preparacao_minutos: 0
      }
    };
  }
};

function calculateVariation(current: number, previous: number): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
