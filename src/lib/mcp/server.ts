import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { assertToolRole } from './access.ts';
import { recordMcpAudit } from './audit.ts';
import {
  prepareRegisterDeliveryProblem,
  prepareUpdateOrderStatus,
  prepareUpdateRouteStatus,
  executeConfirmedAction,
} from './actions.ts';
import {
  getMyAmbassadorSummary,
  getOperationalSummary,
  getOrder,
  getRoute,
  listOrders,
  listRoutes,
  listStock,
} from './data.ts';
import {
  executeConfirmedActionSchema,
  getOrderSchema,
  getRouteSchema,
  listOrdersSchema,
  listRoutesSchema,
  listStockSchema,
  operationalSummarySchema,
  prepareRegisterDeliveryProblemSchema,
  prepareUpdateOrderStatusSchema,
  prepareUpdateRouteStatusSchema,
} from './schemas.ts';
import { McpToolError, type McpAuthContext } from './types.ts';

export const MCP_TOOL_NAMES = [
  'get_operational_summary',
  'list_orders',
  'get_order',
  'list_stock',
  'list_routes',
  'get_route',
  'get_my_ambassador_summary',
  'prepare_update_order_status',
  'prepare_update_route_status',
  'prepare_register_delivery_problem',
  'execute_confirmed_action',
] as const;

function output(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  };
}

function errorOutput(error: unknown) {
  const safeError = error instanceof McpToolError
    ? error
    : new McpToolError('database_error', 'Não foi possível concluir a operação.', 500);
  return {
    isError: true,
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ error: safeError.message, code: safeError.code }),
    }],
  };
}

function auditEntityId(value?: string | null): string | null {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

async function executeTool<T>(
  context: McpAuthContext,
  requestId: string,
  toolName: string,
  handler: () => Promise<T>,
  entity?: { type?: string | null; id?: string | null },
) {
  const startedAt = performance.now();
  try {
    const result = await handler();
    await recordMcpAudit(context, {
      requestId,
      toolName,
      entityType: entity?.type,
      entityId: auditEntityId(entity?.id),
      result: 'success',
      latencyMs: performance.now() - startedAt,
    });
    return output(result);
  } catch (error) {
    const safeError = error instanceof McpToolError
      ? error
      : new McpToolError('database_error', 'Não foi possível concluir a operação.', 500);
    await recordMcpAudit(context, {
      requestId,
      toolName,
      entityType: entity?.type,
      entityId: auditEntityId(entity?.id),
      result: safeError.code === 'forbidden' || safeError.code === 'invalid_input' || safeError.code === 'confirmation_invalid'
        ? 'denied'
        : 'error',
      denialCode: safeError.code,
      latencyMs: performance.now() - startedAt,
    });
    return errorOutput(safeError);
  }
}

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new McpToolError('invalid_input', 'Os parâmetros da ferramenta são inválidos.', 400);
  }
  return result.data;
}

export function buildMcpServer(context: McpAuthContext, requestId: string): McpServer {
  const server = new McpServer(
    { name: 'bryza-mcp', version: '1.0.0' },
    {
      instructions: 'Servidor operacional Bryza. Use somente os campos retornados e nunca tente acessar clientes, pagamentos, credenciais ou SQL.',
    },
  );

  server.registerTool('get_operational_summary', {
    title: 'Resumo operacional',
    description: 'Retorna contagens operacionais permitidas e um resumo de estoque, sem pagamentos ou dados pessoais.',
    inputSchema: {
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    },
  }, async (args) => executeTool(context, requestId, 'get_operational_summary', async () => {
    assertToolRole(context, 'get_operational_summary');
    return getOperationalSummary(context, parseInput(operationalSummarySchema, args));
  }));

  server.registerTool('list_orders', {
    title: 'Listar pedidos',
    description: 'Lista pedidos visíveis para o papel atual, com paginação máxima de 50 e sem dados de pagamento.',
    inputSchema: {
      page: z.number().int().min(1).max(1000).default(1),
      page_size: z.number().int().min(1).max(50).default(50),
      status: z.enum(['aguardando_preparacao', 'pronto_para_entrega', 'em_rota', 'entregue', 'finalizado', 'cancelado']).optional(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    },
  }, async (args) => executeTool(context, requestId, 'list_orders', async () => {
    assertToolRole(context, 'list_orders');
    return listOrders(context, parseInput(listOrdersSchema, args));
  }));

  server.registerTool('get_order', {
    title: 'Consultar pedido',
    description: 'Consulta um pedido visível para o papel atual. Endereço é retornado somente para logística.',
    inputSchema: { order_id: z.string().uuid() },
  }, async (args) => executeTool(context, requestId, 'get_order', async () => {
    assertToolRole(context, 'get_order');
    const input = parseInput(getOrderSchema, args);
    return getOrder(context, input.order_id);
  }, { type: 'pedido', id: (args as { order_id?: string }).order_id }));

  server.registerTool('list_stock', {
    title: 'Listar estoque',
    description: 'Lista apenas dados operacionais de estoque, sem custo, preço ou dados de fornecedores.',
    inputSchema: {
      page: z.number().int().min(1).max(1000).default(1),
      page_size: z.number().int().min(1).max(50).default(50),
      only_low_stock: z.boolean().default(false),
    },
  }, async (args) => executeTool(context, requestId, 'list_stock', async () => {
    assertToolRole(context, 'list_stock');
    return listStock(context, parseInput(listStockSchema, args));
  }));

  server.registerTool('list_routes', {
    title: 'Listar rotas',
    description: 'Lista rotas e o estado operacional de seus pedidos, sem remuneração de motoristas.',
    inputSchema: {
      page: z.number().int().min(1).max(1000).default(1),
      page_size: z.number().int().min(1).max(50).default(50),
      status: z.enum(['Planejada', 'Separando Produtos', 'Pronta para Sair', 'Em Andamento', 'Finalizada', 'Finalizada com Pendências', 'Cancelada']).optional(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    },
  }, async (args) => executeTool(context, requestId, 'list_routes', async () => {
    assertToolRole(context, 'list_routes');
    return listRoutes(context, parseInput(listRoutesSchema, args));
  }));

  server.registerTool('get_route', {
    title: 'Consultar rota',
    description: 'Consulta uma rota e seus estados de entrega, sem dados financeiros ou pessoais desnecessários.',
    inputSchema: { route_id: z.string().uuid() },
  }, async (args) => executeTool(context, requestId, 'get_route', async () => {
    assertToolRole(context, 'get_route');
    const input = parseInput(getRouteSchema, args);
    return getRoute(context, input.route_id);
  }, { type: 'rota', id: (args as { route_id?: string }).route_id }));

  server.registerTool('get_my_ambassador_summary', {
    title: 'Meu resumo de embaixador',
    description: 'Disponível somente ao embaixador autenticado e limitado ao próprio painel e comissões permitidas.',
    inputSchema: {},
  }, async (args) => executeTool(context, requestId, 'get_my_ambassador_summary', async () => {
    assertToolRole(context, 'get_my_ambassador_summary');
    return getMyAmbassadorSummary(context);
  }));

  server.registerTool('prepare_update_order_status', {
    title: 'Preparar atualização de pedido',
    description: 'Gera uma prévia e uma confirmação de uso único. Não altera o pedido.',
    inputSchema: {
      order_id: z.string().uuid(),
      next_status: z.enum(['aguardando_preparacao', 'pronto_para_entrega', 'em_rota', 'entregue', 'finalizado', 'cancelado']),
    },
  }, async (args) => executeTool(context, requestId, 'prepare_update_order_status', async () => {
    assertToolRole(context, 'prepare_update_order_status');
    return prepareUpdateOrderStatus(context, parseInput(prepareUpdateOrderStatusSchema, args));
  }, { type: 'pedido', id: (args as { order_id?: string }).order_id }));

  server.registerTool('prepare_update_route_status', {
    title: 'Preparar atualização de rota',
    description: 'Gera uma prévia e uma confirmação de uso único. Não altera a rota.',
    inputSchema: {
      route_id: z.string().uuid(),
      next_status: z.enum(['Planejada', 'Separando Produtos', 'Pronta para Sair', 'Em Andamento', 'Finalizada', 'Finalizada com Pendências', 'Cancelada']),
    },
  }, async (args) => executeTool(context, requestId, 'prepare_update_route_status', async () => {
    assertToolRole(context, 'prepare_update_route_status');
    return prepareUpdateRouteStatus(context, parseInput(prepareUpdateRouteStatusSchema, args));
  }, { type: 'rota', id: (args as { route_id?: string }).route_id }));

  server.registerTool('prepare_register_delivery_problem', {
    title: 'Preparar problema de entrega',
    description: 'Gera uma prévia e uma confirmação de uso único para registrar um problema logístico.',
    inputSchema: {
      order_id: z.string().uuid(),
      problem_type: z.enum(['cliente_nao_estava', 'endereco_errado', 'cliente_recusou', 'sem_dinheiro', 'pediu_reagendamento', 'produto_avariado', 'outro']),
      notes: z.string().trim().min(1).max(500),
      next_action: z.enum(['keep', 'back_to_ready', 'cancel']),
    },
  }, async (args) => executeTool(context, requestId, 'prepare_register_delivery_problem', async () => {
    assertToolRole(context, 'prepare_register_delivery_problem');
    return prepareRegisterDeliveryProblem(context, parseInput(prepareRegisterDeliveryProblemSchema, args));
  }, { type: 'pedido', id: (args as { order_id?: string }).order_id }));

  server.registerTool('execute_confirmed_action', {
    title: 'Executar ação confirmada',
    description: 'Consome uma confirmação aprovada pelo usuário e executa uma única ação operacional.',
    inputSchema: {
      confirmation_id: z.string().uuid(),
      confirmation_token: z.string().regex(/^[a-f0-9]{64}$/i),
      tool_name: z.enum(['prepare_update_order_status', 'prepare_update_route_status', 'prepare_register_delivery_problem']),
      entity_id: z.string().uuid(),
      payload_hash: z.string().regex(/^[a-f0-9]{64}$/i),
    },
  }, async (args) => executeTool(context, requestId, 'execute_confirmed_action', async () => {
    assertToolRole(context, 'execute_confirmed_action');
    return executeConfirmedAction(context, parseInput(executeConfirmedActionSchema, args));
  }, { id: (args as { entity_id?: string }).entity_id }));

  return server;
}
