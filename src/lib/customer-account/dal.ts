import 'server-only';

import { createClient } from '@/utils/supabase/server';
import type {
  CustomerAccountEntityType,
  CustomerAccountOrderDetail,
  CustomerAccountOrderList,
  CustomerAccountOrderCursor,
  CustomerAccountSummary,
} from './types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CustomerAccountUnauthorizedError extends Error {
  constructor() {
    super('customer_account_unauthorized');
    this.name = 'CustomerAccountUnauthorizedError';
  }
}

export class CustomerAccountNotLinkedError extends Error {
  constructor() {
    super('customer_account_not_linked');
    this.name = 'CustomerAccountNotLinkedError';
  }
}

export class CustomerAccountDataError extends Error {
  constructor(message = 'customer_account_data_error') {
    super(message);
    this.name = 'CustomerAccountDataError';
  }
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new CustomerAccountUnauthorizedError();
  }

  return supabase;
}

function rpcError(error: { message?: string } | null) {
  const message = error?.message || '';
  if (message.includes('customer_account_unauthorized')) {
    return new CustomerAccountUnauthorizedError();
  }
  if (message.includes('customer_account_not_linked')) {
    return new CustomerAccountNotLinkedError();
  }
  return new CustomerAccountDataError();
}

export async function getCustomerAccountSummary():
Promise<CustomerAccountSummary> {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc('fn_customer_account_summary');

  if (error || !data) throw rpcError(error);
  return data as CustomerAccountSummary;
}

export async function listCustomerAccountOrders(input: {
  limit?: number;
  cursor?: CustomerAccountOrderCursor | null;
  status?: string | null;
} = {}): Promise<CustomerAccountOrderList> {
  const limit = input.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new CustomerAccountDataError('invalid_customer_order_limit');
  }
  if (input.cursor && !UUID_PATTERN.test(input.cursor.id)) {
    throw new CustomerAccountDataError('invalid_customer_order_cursor');
  }
  if (
    input.cursor
    && Number.isNaN(new Date(input.cursor.created_at).getTime())
  ) {
    throw new CustomerAccountDataError('invalid_customer_order_cursor');
  }

  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc('fn_customer_list_orders', {
    p_limit: limit,
    p_cursor_created_at: input.cursor?.created_at || null,
    p_cursor_id: input.cursor?.id || null,
    p_status: input.status?.trim() || null,
  });

  if (error || !data) throw rpcError(error);
  return data as CustomerAccountOrderList;
}

export async function getCustomerAccountOrderDetail(
  entityType: CustomerAccountEntityType,
  entityId: string,
): Promise<CustomerAccountOrderDetail> {
  if (
    !['pedido', 'agendamento'].includes(entityType)
    || !UUID_PATTERN.test(entityId)
  ) {
    throw new CustomerAccountDataError('invalid_customer_order_identity');
  }

  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc('fn_customer_order_detail', {
    p_entity_type: entityType,
    p_entity_id: entityId,
  });

  if (error || !data) throw rpcError(error);
  return data as CustomerAccountOrderDetail;
}
