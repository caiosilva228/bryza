import type {
  CustomerAccountSummary,
  CustomerOrderDetail,
  CustomerOrderSummary,
  OrderStatus,
  PaymentChoice,
  PaymentStatus,
} from './types';
import type {
  CustomerAccountOrderDetail as DalOrderDetail,
  CustomerAccountOrderList as DalOrderList,
  CustomerAccountOrderListItem as DalOrderListItem,
  CustomerAccountSummary as DalAccountSummary,
} from '@/lib/customer-account';

export type AccountSummaryPayload = DalAccountSummary;
export type OrderListPayload = DalOrderList;
export type RawOrderSummary = DalOrderListItem;
export type OrderDetailPayload = DalOrderDetail;

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function canPayOnline(input: {
  canPayNow: boolean;
  paymentStatus: string;
  paymentTiming: string;
  fulfillmentStatus: string;
}) {
  if (input.canPayNow) return true;
  const paymentStatus = input.paymentStatus.toLowerCase();
  const paymentTiming = input.paymentTiming.toLowerCase();
  const fulfillmentStatus = input.fulfillmentStatus.toLowerCase();
  return ['agora', 'na_entrega', 'entrega'].includes(paymentTiming)
    && ['nao_iniciado', 'nao iniciado', 'pendente', 'processando', 'em_analise', 'rejeitado', 'recusado', 'expirado'].includes(paymentStatus)
    && !['cancelado', 'entregue', 'finalizado', 'convertido'].includes(fulfillmentStatus);
}

export function normalizeOrderStatus(value: string): OrderStatus {
  const normalized = value.toLowerCase();

  if (['entregue', 'finalizado', 'delivered', 'completed'].includes(normalized)) {
    return 'entregue';
  }
  if (['saiu_para_entrega', 'em_rota', 'out_for_delivery'].includes(normalized)) {
    return 'saiu_para_entrega';
  }
  if (['em_separacao', 'em_preparo', 'preparando', 'preparing'].includes(normalized)) {
    return 'em_separacao';
  }
  if (['confirmado', 'confirmed', 'agendado'].includes(normalized)) {
    return 'confirmado';
  }
  if (['cancelado', 'cancelled', 'canceled'].includes(normalized)) {
    return 'cancelado';
  }
  if (['problema_na_entrega', 'delivery_issue', 'falha_entrega'].includes(normalized)) {
    return 'problema_na_entrega';
  }
  return 'recebido';
}

export function normalizePaymentStatus(value: string): PaymentStatus {
  const normalized = value.toLowerCase();

  if (['pago', 'aprovado', 'approved', 'paid'].includes(normalized)) return 'aprovado';
  if (['pendente', 'pending', 'in_process', 'processando', 'em_analise', 'in_mediation', 'aguardando'].includes(normalized)) return 'pendente';
  if (['rejeitado', 'rejected', 'failed'].includes(normalized)) return 'rejeitado';
  if (['expirado', 'expired', 'cancelled', 'canceled'].includes(normalized)) return 'expirado';
  if (['reembolsado', 'refunded'].includes(normalized)) return 'reembolsado';
  if (['chargeback', 'charged_back'].includes(normalized)) return 'chargeback';
  return 'nao_iniciado';
}

export function normalizePaymentChoice(value: string): PaymentChoice {
  return ['agora', 'pay_now', 'online'].includes(value.toLowerCase())
    ? 'agora'
    : 'na_entrega';
}

export function toOrderSummary(raw: RawOrderSummary): CustomerOrderSummary {
  return {
    id: `${raw.entity_type}:${raw.entity_id}`,
    orderNumber: String(raw.number),
    createdAt: raw.created_at,
    scheduledFor: raw.scheduled_for,
    itemCount: 0,
    total: numberValue(raw.total),
    orderStatus: normalizeOrderStatus(raw.fulfillment_status),
    paymentStatus: normalizePaymentStatus(raw.payment_status),
    paymentChoice: normalizePaymentChoice(raw.payment_timing),
    canPayNow: canPayOnline({
      canPayNow: raw.can_pay_now,
      paymentStatus: raw.payment_status,
      paymentTiming: raw.payment_timing,
      fulfillmentStatus: raw.fulfillment_status,
    }),
    canRepeat: false,
  };
}

export function toAccountSummary(
  summary: AccountSummaryPayload,
  recentOrders: RawOrderSummary[],
): CustomerAccountSummary {
  return {
    customerName: summary.account.full_name,
    activeOrders: summary.counts.open_schedules,
    pendingPayments: summary.counts.pending_payments,
    deliveredOrders: summary.counts.orders,
    recentOrders: recentOrders.map(toOrderSummary),
  };
}

export function toOrderDetail(payload: OrderDetailPayload): CustomerOrderDetail {
  const order = payload.order;
  const normalizedStatus = normalizeOrderStatus(order.fulfillment_status);
  const stages: Array<{
    status: OrderStatus;
    label: string;
    description: string;
    occurredAt?: string | null;
  }> = [
    {
      status: 'recebido',
      label: 'Pedido recebido',
      description: 'Recebemos os dados da sua compra.',
      occurredAt: order.created_at,
    },
    {
      status: 'confirmado',
      label: 'Pedido confirmado',
      description: 'O pedido foi confirmado para preparação.',
    },
    {
      status: 'em_separacao',
      label: 'Em separação',
      description: 'Os produtos estão sendo preparados.',
    },
    {
      status: 'saiu_para_entrega',
      label: 'Saiu para entrega',
      description: 'A entrega está a caminho.',
      occurredAt: order.delivery.started_at,
    },
    {
      status: 'entregue',
      label: 'Pedido entregue',
      description: 'Entrega concluída.',
      occurredAt: order.delivery.delivered_at ?? order.delivery.finalized_at,
    },
  ];
  const orderIndex = stages.findIndex((stage) => stage.status === normalizedStatus);
  const safeIndex = orderIndex < 0 ? 0 : orderIndex;
  const items = payload.items.map((item, index) => ({
    id: `${order.entity_id}-${index}`,
    name: item.product_name || 'Produto Bryza',
    quantity: item.quantity,
    unitPrice: numberValue(item.unit_price),
    total: numberValue(item.subtotal),
  }));
  const itemSubtotal = items.reduce((total, item) => total + item.total, 0);
  const orderTotal = numberValue(order.total);

  return {
    id: `${order.entity_type}:${order.entity_id}`,
    orderNumber: String(order.number),
    createdAt: order.created_at,
    scheduledFor: order.scheduled_for ?? null,
    orderStatus: normalizedStatus,
    paymentStatus: normalizePaymentStatus(order.payment.status),
    paymentChoice: normalizePaymentChoice(order.payment.timing),
    canPayNow: canPayOnline({
      canPayNow: order.can_pay_now,
      paymentStatus: order.payment.status,
      paymentTiming: order.payment.timing,
      fulfillmentStatus: order.fulfillment_status,
    }),
    canRepeat: false,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    items,
    subtotal: itemSubtotal,
    deliveryFee: Math.max(0, orderTotal - itemSubtotal),
    discount: payload.items.reduce(
      (total, item) => total + numberValue(item.discount),
      0,
    ),
    total: orderTotal,
    address: order.delivery.address
      ? {
          street: order.delivery.address,
          neighborhood: order.delivery.neighborhood,
          city: order.delivery.city,
          state: order.delivery.state,
          zipCode: order.delivery.postal_code,
        }
      : null,
    timeline: normalizedStatus === 'cancelado' || normalizedStatus === 'problema_na_entrega'
      ? [
          {
            id: 'received',
            label: 'Pedido recebido',
            description: 'Recebemos os dados da sua compra.',
            occurredAt: order.created_at,
            completed: true,
          },
          {
            id: normalizedStatus,
            label: normalizedStatus === 'cancelado' ? 'Pedido cancelado' : 'Problema na entrega',
            description: normalizedStatus === 'cancelado'
              ? 'Este pedido não seguirá para entrega.'
              : 'A equipe está verificando o ocorrido.',
            occurredAt: order.updated_at,
            completed: true,
            current: true,
          },
        ]
      : stages.map((stage, index) => ({
          id: stage.status,
          label: stage.label,
          description: stage.description,
          occurredAt: stage.occurredAt ?? null,
          completed: index <= safeIndex,
          current: index === safeIndex,
        })),
  };
}
