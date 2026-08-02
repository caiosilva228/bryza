import { getMcpConfig } from './config.ts';
import { McpToolError, type McpAuthContext } from './types.ts';

const roleAccess: Record<string, readonly string[]> = {
  get_operational_summary: ['admin', 'vendedor', 'logistica'],
  list_orders: ['admin', 'vendedor', 'logistica'],
  get_order: ['admin', 'vendedor', 'logistica'],
  list_stock: ['admin', 'logistica'],
  list_routes: ['admin', 'logistica'],
  get_route: ['admin', 'logistica'],
  get_my_ambassador_summary: ['embaixador'],
  prepare_update_order_status: ['admin', 'logistica'],
  prepare_update_route_status: ['admin', 'logistica'],
  prepare_register_delivery_problem: ['admin', 'logistica'],
  execute_confirmed_action: ['admin', 'logistica'],
};

export function assertToolRole(context: McpAuthContext, toolName: string): void {
  const allowed = roleAccess[toolName] || [];
  if (!allowed.includes(context.role)) {
    throw new McpToolError('forbidden', 'Seu papel não possui acesso a esta ferramenta.', 403);
  }
}

export function assertWritesEnabled(): void {
  if (!getMcpConfig().writesEnabled) {
    throw new McpToolError('writes_disabled', 'As ações de escrita estão desativadas neste ambiente.', 403);
  }
}

export function assertOperationalOrderStatus(status: string): void {
  if (status === 'finalizado' || status === 'aguardando_preparacao') {
    throw new McpToolError('forbidden', 'Esta transição não está disponível para o MCP na v1.', 403);
  }
}

export function assertOperationalRouteStatus(status: string): void {
  if (status === 'Finalizada' || status === 'Planejada') {
    throw new McpToolError('forbidden', 'Esta transição não está disponível para o MCP na v1.', 403);
  }
}
