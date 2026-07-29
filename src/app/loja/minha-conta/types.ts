export type OrderStatus =
  | 'recebido'
  | 'confirmado'
  | 'em_separacao'
  | 'saiu_para_entrega'
  | 'entregue'
  | 'cancelado'
  | 'problema_na_entrega';

export type PaymentStatus =
  | 'nao_iniciado'
  | 'pendente'
  | 'aprovado'
  | 'rejeitado'
  | 'expirado'
  | 'reembolsado'
  | 'chargeback';

export type PaymentChoice = 'agora' | 'na_entrega';

export type CustomerOrderSummary = {
  id: string;
  orderNumber: string;
  createdAt: string;
  scheduledFor?: string | null;
  itemCount: number;
  total: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentChoice: PaymentChoice;
  canPayNow?: boolean;
  canRepeat?: boolean;
};

export type CustomerAccountSummary = {
  customerName: string;
  activeOrders: number;
  pendingPayments: number;
  deliveredOrders: number;
  recentOrders: CustomerOrderSummary[];
};

export type CustomerOrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type CustomerOrderTimelineEvent = {
  id: string;
  label: string;
  description?: string | null;
  occurredAt?: string | null;
  completed: boolean;
  current?: boolean;
};

export type CustomerOrderDetail = CustomerOrderSummary & {
  items: CustomerOrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  address?: {
    street: string;
    number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  } | null;
  timeline: CustomerOrderTimelineEvent[];
  notes?: string | null;
};
