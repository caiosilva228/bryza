import { createClient } from '@/utils/supabase/server';
import { AdminDashboardData } from '@/models/types';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, parseISO } from 'date-fns';

/**
 * Serviço central de métricas para o Dashboard Administrativo.
 * Focado em performance e visão operacional em tempo real.
 */
export const DashboardService = {
  /**
   * Obtém todas as métricas do dashboard para uma data de referência.
   * Por padrão, a data de referência é "Hoje".
   */
  async getAdminStats(referenceDate: string = new Date().toISOString()): Promise<AdminDashboardData> {
    const supabase = await createClient();
    const date = parseISO(referenceDate);
    
    // Intervalos para Hoje
    const dayStart = startOfDay(date).toISOString();
    const dayEnd = endOfDay(date).toISOString();
    
    // Intervalos para Ontem (para variação)
    const yesterdayStart = startOfDay(subDays(date, 1)).toISOString();
    const yesterdayEnd = endOfDay(subDays(date, 1)).toISOString();

    // Intervalos para a Semana (Segunda a Domingo conforme pedido)
    // weekStartsOn: 1 (Segunda-feira)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }).toISOString();
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 }).toISOString();
    
    const lastWeekStart = startOfWeek(subDays(date, 7), { weekStartsOn: 1 }).toISOString();
    const lastWeekEnd = endOfWeek(subDays(date, 7), { weekStartsOn: 1 }).toISOString();

    // Intervalos para o Mês
    const monthStart = startOfMonth(date).toISOString();
    const monthEnd = endOfMonth(date).toISOString();
    
    const lastMonthStart = startOfMonth(subMonths(date, 1)).toISOString();
    const lastMonthEnd = endOfMonth(subMonths(date, 1)).toISOString();

    // 1. FINANCEIRO (Busca via RPC para performance)
    const [
      { data: fatDiaData },
      { data: fatOntemData },
      { data: fatSemanaData },
      { data: fatSemanaPassadaData },
      { data: fatMesData },
      { data: fatMesPassadoData }
    ] = await Promise.all([
      supabase.rpc('get_faturamento_periodo', { p_inicio: dayStart, p_fim: dayEnd }),
      supabase.rpc('get_faturamento_periodo', { p_inicio: yesterdayStart, p_fim: yesterdayEnd }),
      supabase.rpc('get_faturamento_periodo', { p_inicio: weekStart, p_fim: weekEnd }),
      supabase.rpc('get_faturamento_periodo', { p_inicio: lastWeekStart, p_fim: lastWeekEnd }),
      supabase.rpc('get_faturamento_periodo', { p_inicio: monthStart, p_fim: monthEnd }),
      supabase.rpc('get_faturamento_periodo', { p_inicio: lastMonthStart, p_fim: lastMonthEnd }),
    ]);

    const faturamento_dia = Number(fatDiaData) || 0;
    const faturamento_semana = Number(fatSemanaData) || 0;
    const faturamento_mes = Number(fatMesData) || 0;
    
    const var_dia = calculateVariation(faturamento_dia, Number(fatOntemData) || 0);
    const var_semana = calculateVariation(faturamento_semana, Number(fatSemanaPassadaData) || 0);
    const var_mes = calculateVariation(faturamento_mes, Number(fatMesPassadoData) || 0);

    // Ticket Médio (Vendas do mês)
    const { count: totalVendasMes } = await supabase
      .from('vendas')
      .select('*', { count: 'exact', head: true })
      .gte('data_venda', monthStart)
      .lte('data_venda', monthEnd)
      .not('status_venda', 'eq', 'cancelado');

    const ticket_medio = totalVendasMes ? (faturamento_mes / totalVendasMes) : 0;

    // 2. PEDIDOS (Status operacional e eventos do dia)
    // 2.1 Pedidos Pendentes (Snapshot atual - não filtrado por data do dia)
    const { data: pedidosPendentes } = await supabase
      .from('pedidos')
      .select('status_pedido')
      .not('status_pedido', 'in', '("finalizado","cancelado")');
    
    const countStatus = (status: string) => pedidosPendentes?.filter(p => p.status_pedido === status).length || 0;
    
    // 2.2 Eventos do Dia (Filtrados pelo intervalo selecionado)
    // Entregues Hoje: usamos updated_at na tabela pedidos
    const { count: entregue_hoje } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('status_pedido', 'entregue')
      .gte('updated_at', dayStart)
      .lte('updated_at', dayEnd);

    // Finalizados Hoje: usamos a tabela de vendas (garante sincronia com faturamento)
    const { count: finalizados_hoje } = await supabase
      .from('vendas')
      .select('*', { count: 'exact', head: true })
      .gte('data_venda', dayStart)
      .lte('data_venda', dayEnd);

    // 3. CLIENTES
    const { count: novosHoje } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .gte('data_cadastro', dayStart)
      .lte('data_cadastro', dayEnd);

    const { data: statsClientes } = await supabase
      .from('clientes')
      .select('status_cliente, total_compras');

    // 4. VENDEDORES (Ranking via RPC)
    const { data: ranking } = await supabase.rpc('get_ranking_vendedores', { 
      p_inicio: monthStart, 
      p_fim: monthEnd 
    });

    // 5. ESTOQUE
    const { data: produtosEstoque } = await supabase
      .from('produtos')
      .select('id, nome_produto, estoque_atual, estoque_minimo');
    
    const itens_baixo_estoque = produtosEstoque?.filter(p => p.estoque_atual <= p.estoque_minimo).length || 0;

    // Top Produtos via RPC
    const { data: top_produtos } = await supabase.rpc('get_top_produtos', {
      p_inicio: monthStart,
      p_fim: monthEnd
    });

    // Itens parados (> 60 dias sem venda)
    const sessentaDiasAtras = subDays(date, 60).toISOString();
    
    // Otimizando busca de vendidos para evitar sobrecarga
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
        pendentes_total: pedidosPendentes?.length || 0
      },
      clientes: {
        novos_hoje: novosHoje || 0,
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
        taxa_sucesso_entrega: 100, // Ajustar conforme dados reais de entregas vs falhas
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
