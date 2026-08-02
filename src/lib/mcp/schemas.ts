import { z } from 'zod';

const pageSchema = z.number().int().min(1).max(1000).default(1);
const pageSizeSchema = z.number().int().min(1).max(50).default(50);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato YYYY-MM-DD.');
const uuidSchema = z.string().uuid();

export const orderStatuses = [
  'aguardando_preparacao',
  'pronto_para_entrega',
  'em_rota',
  'entregue',
  'finalizado',
  'cancelado',
] as const;

export const operationalOrderStatuses = [
  'pronto_para_entrega',
  'em_rota',
  'entregue',
  'cancelado',
] as const;

export const routeStatuses = [
  'Planejada',
  'Separando Produtos',
  'Pronta para Sair',
  'Em Andamento',
  'Finalizada',
  'Finalizada com Pendências',
  'Cancelada',
] as const;

export const operationalRouteStatuses = [
  'Separando Produtos',
  'Pronta para Sair',
  'Em Andamento',
  'Finalizada com Pendências',
  'Cancelada',
] as const;

export const deliveryProblemTypes = [
  'cliente_nao_estava',
  'endereco_errado',
  'cliente_recusou',
  'sem_dinheiro',
  'pediu_reagendamento',
  'produto_avariado',
  'outro',
] as const;

export const deliveryNextActions = ['keep', 'back_to_ready', 'cancel'] as const;

export const operationalSummarySchema = z.object({
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
}).strict();

export const listOrdersSchema = z.object({
  page: pageSchema,
  page_size: pageSizeSchema,
  status: z.enum(orderStatuses).optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
}).strict();

export const getOrderSchema = z.object({ order_id: uuidSchema }).strict();

export const listStockSchema = z.object({
  page: pageSchema,
  page_size: pageSizeSchema,
  only_low_stock: z.boolean().default(false),
}).strict();

export const listRoutesSchema = z.object({
  page: pageSchema,
  page_size: pageSizeSchema,
  status: z.enum(routeStatuses).optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
}).strict();

export const getRouteSchema = z.object({ route_id: uuidSchema }).strict();

export const ambassadorSummarySchema = z.object({}).strict();

export const prepareUpdateOrderStatusSchema = z.object({
  order_id: uuidSchema,
  next_status: z.enum(orderStatuses),
}).strict();

export const prepareUpdateRouteStatusSchema = z.object({
  route_id: uuidSchema,
  next_status: z.enum(routeStatuses),
}).strict();

const deliveryNotesSchema = z.string().trim().min(1).max(500).refine(
  (value) => !/(cpf|pix|senha|password|token|secret|hmac)/i.test(value) && !/\d{10,}/.test(value),
  'A observação contém um dado sensível não permitido.',
);

export const prepareRegisterDeliveryProblemSchema = z.object({
  order_id: uuidSchema,
  problem_type: z.enum(deliveryProblemTypes),
  notes: deliveryNotesSchema,
  next_action: z.enum(deliveryNextActions),
}).strict();

export const actionToolNames = [
  'prepare_update_order_status',
  'prepare_update_route_status',
  'prepare_register_delivery_problem',
] as const;

export const executeConfirmedActionSchema = z.object({
  confirmation_id: uuidSchema,
  confirmation_token: z.string().regex(/^[a-f0-9]{64}$/i),
  tool_name: z.enum(actionToolNames),
  entity_id: uuidSchema,
  payload_hash: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

export type OperationalSummaryInput = z.infer<typeof operationalSummarySchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
export type ListStockInput = z.infer<typeof listStockSchema>;
export type ListRoutesInput = z.infer<typeof listRoutesSchema>;
export type PrepareUpdateOrderStatusInput = z.infer<typeof prepareUpdateOrderStatusSchema>;
export type PrepareUpdateRouteStatusInput = z.infer<typeof prepareUpdateRouteStatusSchema>;
export type PrepareRegisterDeliveryProblemInput = z.infer<typeof prepareRegisterDeliveryProblemSchema>;
export type ExecuteConfirmedActionInput = z.infer<typeof executeConfirmedActionSchema>;

