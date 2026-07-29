export type CustomerAccountEntityType = 'pedido' | 'agendamento';

export type CustomerAccountSummary = {
  status: 'ok';
  account: {
    customer_code: string;
    full_name: string;
    phone_last4: string | null;
    email_hint: string | null;
    cpf_last2: string | null;
    city: string | null;
    state: string | null;
  };
  counts: {
    orders: number;
    open_schedules: number;
    pending_payments: number;
  };
  last_activity_at: string | null;
};

export type CustomerAccountOrderListItem = {
  entity_type: CustomerAccountEntityType;
  entity_id: string;
  number: string;
  created_at: string;
  updated_at: string;
  scheduled_for: string | null;
  fulfillment_status: string;
  payment_status: string;
  payment_timing: string;
  total: number;
  can_pay_now: boolean;
};

export type CustomerAccountOrderCursor = {
  created_at: string;
  id: string;
};

export type CustomerAccountOrderList = {
  status: 'ok';
  items: CustomerAccountOrderListItem[];
  has_more: boolean;
  next_cursor: CustomerAccountOrderCursor | null;
};

export type CustomerAccountOrderDetail = {
  status: 'ok';
  order: {
    entity_type: CustomerAccountEntityType;
    entity_id: string;
    number: string;
    created_at: string;
    updated_at: string;
    scheduled_for?: string | null;
    fulfillment_status: string;
    payment: {
      status: string;
      timing: string;
      source: string | null;
      method: string | null;
      paid_at: string | null;
      amount_received: number | null;
    };
    delivery: {
      address: string;
      neighborhood: string;
      city: string;
      state: string;
      postal_code: string | null;
      started_at?: string | null;
      delivered_at?: string | null;
      finalized_at?: string | null;
    };
    total: number;
    can_pay_now: boolean;
  };
  items: Array<{
    product_name: string | null;
    image_url: string | null;
    quantity: number;
    unit_price: number;
    discount: number | null;
    subtotal: number;
  }>;
};
