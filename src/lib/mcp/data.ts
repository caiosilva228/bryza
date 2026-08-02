import { getMcpConfig } from './config.ts';
import { McpToolError, type McpAuthContext, type SafeOrder, type SafeRoute } from './types.ts';
import type {
  ListOrdersInput,
  ListRoutesInput,
  ListStockInput,
  OperationalSummaryInput,
} from './schemas.ts';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new McpToolError('invalid_input', 'Período de datas inválido.');
  }
  return date;
}

function dateBounds(startDate?: string, endDate?: string): { start?: string; end?: string } {
  if (!startDate && !endDate) return {};
  const maxDays = getMcpConfig().maxDateRangeDays;
  const dayMs = 24 * 60 * 60 * 1000;
  let startDay = parseDateOnly(startDate || endDate!);
  let endDay = parseDateOnly(endDate || startDate!);

  if (!startDate) startDay = new Date(endDay.getTime() - (maxDays - 1) * dayMs);
  if (!endDate) endDay = new Date(startDay.getTime() + (maxDays - 1) * dayMs);
  if (endDay < startDay) throw new McpToolError('invalid_input', 'Período de datas inválido.');

  const calendarDays = Math.floor((endDay.getTime() - startDay.getTime()) / dayMs) + 1;
  if (calendarDays > maxDays) {
    throw new McpToolError('invalid_input', `O período máximo é de ${maxDays} dias.`);
  }

  const end = new Date(endDay.getTime() + dayMs - 1);
  return { start: startDay.toISOString(), end: end.toISOString() };
}

function pageWindow(page: number, pageSize: number) {
  const size = Math.min(Math.max(pageSize, 1), getMcpConfig().maxPageSize);
  const from = (Math.max(page, 1) - 1) * size;
  return { from, to: from + size - 1, page, pageSize: size };
}

function safeCustomerAddress(row: Record<string, unknown>) {
  const customer = asRecord(row.cliente);
  return {
    neighborhood: asNullableString(customer.bairro),
    city: asNullableString(customer.cidade),
    state: asNullableString(customer.estado),
    address: asNullableString(customer.endereco),
    number: asNullableString(customer.numero),
  };
}

function sanitizeOrder(rowValue: unknown, context: McpAuthContext, includeItems = false): SafeOrder {
  const row = asRecord(rowValue);
  const result: SafeOrder = {
    id: asNullableString(row.id) || '',
    orderNumber: asNullableString(row.numero_pedido),
    status: asNullableString(row.status_pedido),
    createdAt: asNullableString(row.created_at),
    updatedAt: asNullableString(row.updated_at),
  };

  // Valor comercial só é útil para admin/vendedor e nunca acompanha forma/status de pagamento.
  if (context.role === 'admin' || context.role === 'vendedor') {
    result.total = asNumber(row.valor_total);
  }
  if (context.role === 'logistica') {
    result.delivery = safeCustomerAddress(row);
  }
  if (includeItems && Array.isArray(row.itens)) {
    result.items = row.itens.map((itemValue: unknown) => {
      const item = asRecord(itemValue);
      const product = asRecord(item.produto);
      return {
        id: asNullableString(item.id) || '',
        productId: asNullableString(item.produto_id) || '',
        productName: asNullableString(product.nome_produto),
        quantity: asNumber(item.quantidade) || 0,
      };
    });
  }
  return result;
}

function sanitizeRoute(rowValue: unknown): SafeRoute {
  const row = asRecord(rowValue);
  const rawOrders = Array.isArray(row.delivery_route_orders) ? row.delivery_route_orders : [];
  return {
    id: asNullableString(row.id) || '',
    name: asNullableString(row.name),
    date: asNullableString(row.date),
    status: asNullableString(row.status),
    city: asNullableString(row.city),
    neighborhoods: Array.isArray(row.neighborhoods)
      ? row.neighborhoods.filter((item): item is string => typeof item === 'string').slice(0, 50)
      : null,
    driverName: asNullableString(row.driver_name),
    departureTime: asNullableString(row.departure_time),
    createdAt: asNullableString(row.created_at),
    updatedAt: asNullableString(row.updated_at),
    orders: rawOrders.map((orderValue: unknown) => {
      const order = asRecord(orderValue);
      return {
        id: asNullableString(order.id) || '',
        orderId: asNullableString(order.order_id) || '',
        status: asNullableString(order.status),
        sequence: asNumber(order.sequence),
      };
    }),
  };
}

export async function getOperationalSummary(context: McpAuthContext, input: OperationalSummaryInput) {
  const bounds = dateBounds(input.start_date, input.end_date);
  const statuses = ['aguardando_preparacao', 'pronto_para_entrega', 'em_rota', 'entregue', 'finalizado', 'cancelado'];
  const orderCounts = await Promise.all(statuses.map(async (status) => {
    let query = context.supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('status_pedido', status);
    if (context.role === 'vendedor') query = query.eq('vendedor_id', context.userId);
    if (bounds.start) query = query.gte('created_at', bounds.start);
    if (bounds.end) query = query.lte('created_at', bounds.end);
    const { count, error } = await query;
    if (error) throw new McpToolError('database_error', 'Não foi possível carregar o resumo operacional.', 500);
    return [status, count || 0] as const;
  }));

  let activeProducts: number | null = null;
  let lowStock: number | null = null;
  if (context.role !== 'vendedor') {
    const { data: products, error: productsError } = await context.supabase
      .from('produtos')
      .select('estoque_atual, estoque_minimo')
      .eq('ativo', true)
      .range(0, 999);
    if (productsError) throw new McpToolError('database_error', 'Não foi possível carregar o resumo de estoque.', 500);
    activeProducts = products?.length || 0;
    lowStock = (products || []).filter((item: unknown) => {
      const row = asRecord(item);
      const current = asNumber(row.estoque_atual);
      const minimum = asNumber(row.estoque_minimo);
      return current !== null && minimum !== null && current <= minimum;
    }).length;
  }

  return {
    period: { start: bounds.start || null, end: bounds.end || null },
    ordersByStatus: Object.fromEntries(orderCounts),
    activeProducts,
    lowStockProducts: lowStock,
  };
}

export async function listOrders(context: McpAuthContext, input: ListOrdersInput) {
  const bounds = dateBounds(input.start_date, input.end_date);
  const window = pageWindow(input.page, input.page_size);
  const select = context.role === 'logistica'
    ? 'id,numero_pedido,status_pedido,created_at,updated_at,cliente:clientes(bairro,cidade,estado,endereco,numero)'
    : 'id,numero_pedido,valor_total,status_pedido,created_at,updated_at';
  let query = context.supabase.from('pedidos').select(select, { count: 'exact' }).order('created_at', { ascending: false });
  if (input.status) query = query.eq('status_pedido', input.status);
  if (bounds.start) query = query.gte('created_at', bounds.start);
  if (bounds.end) query = query.lte('created_at', bounds.end);
  if (context.role === 'vendedor') query = query.eq('vendedor_id', context.userId);
  const { data, count, error } = await query.range(window.from, window.to);
  if (error) throw new McpToolError('database_error', 'Não foi possível listar os pedidos.', 500);
  return {
    items: (data || []).map((row: unknown) => sanitizeOrder(row, context)),
    total: count || 0,
    page: window.page,
    pageSize: window.pageSize,
  };
}

export async function getOrder(context: McpAuthContext, orderId: string) {
  const select = context.role === 'logistica'
    ? 'id,numero_pedido,status_pedido,created_at,updated_at,cliente:clientes(bairro,cidade,estado,endereco,numero),itens:pedido_itens(id,produto_id,quantidade,produto:produtos(nome_produto))'
    : 'id,numero_pedido,valor_total,status_pedido,created_at,updated_at,itens:pedido_itens(id,produto_id,quantidade,produto:produtos(nome_produto))';
  let query = context.supabase.from('pedidos').select(select).eq('id', orderId);
  if (context.role === 'vendedor') query = query.eq('vendedor_id', context.userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new McpToolError('database_error', 'Não foi possível consultar o pedido.', 500);
  if (!data) throw new McpToolError('not_found', 'Pedido não encontrado.', 404);
  return sanitizeOrder(data, context, true);
}

export async function listStock(context: McpAuthContext, input: ListStockInput) {
  const window = pageWindow(input.page, input.page_size);
  const { data, error } = await context.supabase
    .from('produtos')
    .select('id,nome_produto,categoria,unidade,estoque_atual,estoque_minimo,estoque_reservado,ativo')
    .eq('ativo', true)
    .order('estoque_atual', { ascending: true })
    .range(0, 999);
  if (error) throw new McpToolError('database_error', 'Não foi possível listar o estoque.', 500);
  const filtered = (data || []).filter((item: unknown) => {
    if (!input.only_low_stock) return true;
    const row = asRecord(item);
    const current = asNumber(row.estoque_atual);
    const minimum = asNumber(row.estoque_minimo);
    return current !== null && minimum !== null && current <= minimum;
  });
  const items = filtered.slice(window.from, window.to + 1).map((item: unknown) => {
    const row = asRecord(item);
    return {
      id: asNullableString(row.id),
      name: asNullableString(row.nome_produto),
      category: asNullableString(row.categoria),
      unit: asNullableString(row.unidade),
      currentStock: asNumber(row.estoque_atual),
      minimumStock: asNumber(row.estoque_minimo),
      reservedStock: asNumber(row.estoque_reservado),
      active: row.ativo === true,
    };
  });
  return { items, total: filtered.length, page: window.page, pageSize: window.pageSize };
}

export async function listRoutes(context: McpAuthContext, input: ListRoutesInput) {
  const bounds = dateBounds(input.start_date, input.end_date);
  const window = pageWindow(input.page, input.page_size);
  let query = context.supabase
    .from('delivery_routes')
    .select('id,name,date,status,driver_name,city,neighborhoods,departure_time,created_at,updated_at,delivery_route_orders(id,order_id,status,sequence)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (input.status) query = query.eq('status', input.status);
  if (bounds.start) query = query.gte('date', bounds.start.slice(0, 10));
  if (bounds.end) query = query.lte('date', bounds.end.slice(0, 10));
  const { data, count, error } = await query.range(window.from, window.to);
  if (error) throw new McpToolError('database_error', 'Não foi possível listar as rotas.', 500);
  return {
    items: (data || []).map((row: unknown) => sanitizeRoute(row)),
    total: count || 0,
    page: window.page,
    pageSize: window.pageSize,
  };
}

export async function getRoute(context: McpAuthContext, routeId: string) {
  const { data, error } = await context.supabase
    .from('delivery_routes')
    .select('id,name,date,status,driver_name,city,neighborhoods,departure_time,created_at,updated_at,delivery_route_orders(id,order_id,status,sequence)')
    .eq('id', routeId)
    .maybeSingle();
  if (error) throw new McpToolError('database_error', 'Não foi possível consultar a rota.', 500);
  if (!data) throw new McpToolError('not_found', 'Rota não encontrada.', 404);
  return sanitizeRoute(data);
}

const ambassadorSummaryKeys = new Set([
  'indicacoes_total',
  'indicacoes_ativas',
  'pedidos_total',
  'pedidos_entregues',
  'pedidos_finalizados',
  'comissoes_total',
  'comissoes_liberadas',
  'comissoes_pendentes',
  'comissoes_pagas',
  'vendas_mes_qtd',
  'rede_total',
  'rede_ativos',
  'rede_inativos',
]);

export async function getMyAmbassadorSummary(context: McpAuthContext) {
  const { data, error } = await context.supabase.rpc('fn_get_embaixador_dashboard_metrics');
  if (error) throw new McpToolError('database_error', 'Não foi possível carregar o painel do embaixador.', 500);
  const raw = asRecord(data);
  const safe: Record<string, unknown> = {};
  for (const key of ambassadorSummaryKeys) {
    if (key in raw) safe[key] = raw[key];
  }
  if (Array.isArray(raw.grafico_mensal)) {
    safe.grafico_mensal = raw.grafico_mensal.map((itemValue: unknown) => {
      const item = asRecord(itemValue);
      return {
        mes: asNullableString(item.mes),
        vendas_qtd: asNumber(item.vendas_qtd),
        comissao_valor: asNumber(item.comissao_valor),
      };
    });
  }
  return safe;
}
