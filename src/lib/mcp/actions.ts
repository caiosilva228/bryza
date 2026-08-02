import { getMcpConfig } from './config.ts';
import {
  assertOperationalOrderStatus,
  assertOperationalRouteStatus,
  assertWritesEnabled,
} from './access.ts';
import { McpToolError, type McpAuthContext } from './types.ts';
import type {
  ExecuteConfirmedActionInput,
  PrepareRegisterDeliveryProblemInput,
  PrepareUpdateOrderStatusInput,
  PrepareUpdateRouteStatusInput,
} from './schemas.ts';

type PreparedActionInput =
  | PrepareUpdateOrderStatusInput
  | PrepareUpdateRouteStatusInput
  | PrepareRegisterDeliveryProblemInput;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function confirmationUrl(id: string): string {
  const url = new URL('/mcp/confirm', getMcpConfig().resourceUrl);
  url.searchParams.set('confirmation_id', id);
  return url.toString();
}

async function createConfirmation(
  context: McpAuthContext,
  input: {
    toolName: string;
    entityType: 'pedido' | 'rota';
    entityId: string;
    payload: PreparedActionInput;
    preview: Record<string, unknown>;
  },
) {
  const { data, error } = await context.supabase.rpc('fn_mcp_create_confirmation', {
    p_tool_name: input.toolName,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_payload: input.payload,
    p_preview: input.preview,
    p_client_id: context.clientId,
    p_resource_url: getMcpConfig().resourceUrl,
    p_ttl_seconds: getMcpConfig().confirmationTtlSeconds,
  });
  if (error || !data) {
    throw new McpToolError('database_error', 'Não foi possível preparar a confirmação.', 500);
  }
  const result = asObject(data);
  const id = typeof result.confirmation_id === 'string' ? result.confirmation_id : null;
  const token = typeof result.confirmation_token === 'string' ? result.confirmation_token : null;
  const payloadHash = typeof result.payload_hash === 'string' ? result.payload_hash : null;
  const expiresAt = typeof result.expires_at === 'string' ? result.expires_at : null;
  if (!id || !token || !payloadHash || !expiresAt) {
    throw new McpToolError('database_error', 'Confirmação retornada em formato inválido.', 500);
  }
  return {
    confirmationId: id,
    confirmationToken: token,
    confirmationUrl: confirmationUrl(id),
    payloadHash,
    expiresAt,
    preview: input.preview,
  };
}

export async function prepareUpdateOrderStatus(
  context: McpAuthContext,
  input: PrepareUpdateOrderStatusInput,
) {
  assertWritesEnabled();
  assertOperationalOrderStatus(input.next_status);
  const { data: order, error } = await context.supabase
    .from('pedidos')
    .select('id,numero_pedido,status_pedido')
    .eq('id', input.order_id)
    .maybeSingle();
  if (error) throw new McpToolError('database_error', 'Não foi possível validar o pedido.', 500);
  if (!order) throw new McpToolError('not_found', 'Pedido não encontrado.', 404);

  return createConfirmation(context, {
    toolName: 'prepare_update_order_status',
    entityType: 'pedido',
    entityId: input.order_id,
    payload: input,
    preview: {
      action: 'Atualizar status operacional do pedido',
      entity: { type: 'pedido', id: input.order_id, number: order.numero_pedido || null },
      changes: { from: order.status_pedido || null, to: input.next_status },
      warning: 'A regra de transição existente no banco será aplicada no momento da execução.',
    },
  });
}

export async function prepareUpdateRouteStatus(
  context: McpAuthContext,
  input: PrepareUpdateRouteStatusInput,
) {
  assertWritesEnabled();
  assertOperationalRouteStatus(input.next_status);
  const { data: route, error } = await context.supabase
    .from('delivery_routes')
    .select('id,name,status')
    .eq('id', input.route_id)
    .maybeSingle();
  if (error) throw new McpToolError('database_error', 'Não foi possível validar a rota.', 500);
  if (!route) throw new McpToolError('not_found', 'Rota não encontrada.', 404);

  return createConfirmation(context, {
    toolName: 'prepare_update_route_status',
    entityType: 'rota',
    entityId: input.route_id,
    payload: input,
    preview: {
      action: 'Atualizar status operacional da rota',
      entity: { type: 'rota', id: input.route_id, name: route.name || null },
      changes: { from: route.status || null, to: input.next_status },
      warning: 'A permissão da logística e as regras do banco serão aplicadas no momento da execução.',
    },
  });
}

export async function prepareRegisterDeliveryProblem(
  context: McpAuthContext,
  input: PrepareRegisterDeliveryProblemInput,
) {
  assertWritesEnabled();
  const { data: order, error } = await context.supabase
    .from('pedidos')
    .select('id,numero_pedido,status_pedido')
    .eq('id', input.order_id)
    .maybeSingle();
  if (error) throw new McpToolError('database_error', 'Não foi possível validar o pedido.', 500);
  if (!order) throw new McpToolError('not_found', 'Pedido não encontrado.', 404);

  return createConfirmation(context, {
    toolName: 'prepare_register_delivery_problem',
    entityType: 'pedido',
    entityId: input.order_id,
    payload: input,
    preview: {
      action: 'Registrar problema de entrega',
      entity: { type: 'pedido', id: input.order_id, number: order.numero_pedido || null },
      currentStatus: order.status_pedido || null,
      problemType: input.problem_type,
      nextAction: input.next_action,
      notesPreview: input.notes.length > 120 ? `${input.notes.slice(0, 117)}...` : input.notes,
    },
  });
}

export async function executeConfirmedAction(
  context: McpAuthContext,
  input: ExecuteConfirmedActionInput,
) {
  assertWritesEnabled();
  // A carga original é mantida somente na tabela privada da confirmação. O endpoint
  // recebe apenas o hash e o token de uso único; o RPC valida e executa a carga
  // armazenada de forma atômica.
  const { data, error } = await context.supabase.rpc('fn_mcp_execute_confirmed_action', {
    p_confirmation_id: input.confirmation_id,
    p_confirmation_token: input.confirmation_token,
    p_tool_name: input.tool_name,
    p_entity_id: input.entity_id,
    p_payload_hash: input.payload_hash,
  });

  if (error) {
    throw new McpToolError('confirmation_invalid', 'Confirmação inválida, expirada, alterada ou já utilizada.', 409);
  }
  return {
    status: 'executed',
    result: data || null,
  };
}
