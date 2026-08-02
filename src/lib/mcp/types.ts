import type { SupabaseClient } from '@supabase/supabase-js';
import type { JWTPayload } from 'jose';
import type { McpRole } from './config.ts';

export type McpSupabaseClient = SupabaseClient<any, 'public', any>;

export type McpAuthContext = {
  userId: string;
  role: McpRole;
  clientId: string;
  agentName: string;
  supabase: McpSupabaseClient;
  claims: JWTPayload & Record<string, unknown>;
};

export type McpToolErrorCode =
  | 'invalid_input'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'writes_disabled'
  | 'confirmation_invalid'
  | 'business_rule'
  | 'database_error';

export class McpToolError extends Error {
  readonly code: McpToolErrorCode;
  readonly status: number;

  constructor(code: McpToolErrorCode, message: string, status = 400) {
    super(message);
    this.name = 'McpToolError';
    this.code = code;
    this.status = status;
  }
}

export type SafeOrder = {
  id: string;
  orderNumber: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  total?: number | null;
  delivery?: {
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    address: string | null;
    number: string | null;
  };
  items?: Array<{
    id: string;
    productId: string;
    productName: string | null;
    quantity: number;
  }>;
};

export type SafeRoute = {
  id: string;
  name: string | null;
  date: string | null;
  status: string | null;
  city: string | null;
  neighborhoods: string[] | null;
  driverName: string | null;
  departureTime: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  orders: Array<{
    id: string;
    orderId: string;
    status: string | null;
    sequence: number | null;
  }>;
};
