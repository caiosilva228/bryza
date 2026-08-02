import assert from 'node:assert/strict';
import test from 'node:test';
import { extractBearerToken } from './auth.ts';
import { assertOperationalOrderStatus, assertToolRole } from './access.ts';
import { sha256Hex, stableStringify } from './crypto.ts';
import { isAllowedMcpOrigin } from './http.ts';
import {
  executeConfirmedActionSchema,
  listOrdersSchema,
  prepareRegisterDeliveryProblemSchema,
} from './schemas.ts';
import type { McpAuthContext } from './types.ts';

test('MCP aceita apenas Bearer bem formado e nunca devolve o token', () => {
  const token = 'header.payload.signature';
  assert.equal(extractBearerToken(new Request('https://admin.bryza.com.br/api/mcp', {
    headers: { Authorization: `Bearer ${token}` },
  })), token);
  assert.throws(() => extractBearerToken(new Request('https://admin.bryza.com.br/api/mcp')));
});

test('Origin é comparação exata, sem curingas', () => {
  const old = process.env.MCP_ALLOWED_ORIGINS;
  process.env.MCP_ALLOWED_ORIGINS = 'https://admin.bryza.com.br,https://staging-admin.bryza.com.br';
  assert.equal(isAllowedMcpOrigin('https://admin.bryza.com.br'), true);
  assert.equal(isAllowedMcpOrigin('https://admin.bryza.com.br.evil.example'), false);
  assert.equal(isAllowedMcpOrigin(null), true);
  if (old === undefined) delete process.env.MCP_ALLOWED_ORIGINS;
  else process.env.MCP_ALLOWED_ORIGINS = old;
});

test('schemas rejeitam paginação excessiva e notas com dados sensíveis', () => {
  assert.equal(listOrdersSchema.safeParse({ page: 1, page_size: 51 }).success, false);
  assert.equal(prepareRegisterDeliveryProblemSchema.safeParse({
    order_id: '00000000-0000-4000-8000-000000000001',
    problem_type: 'outro',
    notes: 'CPF 12345678901',
    next_action: 'keep',
  }).success, false);
});

test('execução exige confirmação de uso único no contrato', () => {
  assert.equal(executeConfirmedActionSchema.safeParse({
    confirmation_id: '00000000-0000-4000-8000-000000000001',
    confirmation_token: 'a'.repeat(64),
    tool_name: 'prepare_update_order_status',
    entity_id: '00000000-0000-4000-8000-000000000002',
    payload_hash: 'b'.repeat(64),
  }).success, true);
  assert.equal(executeConfirmedActionSchema.safeParse({
    confirmation_id: '00000000-0000-4000-8000-000000000001',
    confirmation_token: 'a'.repeat(64),
    tool_name: 'prepare_update_order_status',
    entity_id: '00000000-0000-4000-8000-000000000002',
    payload_hash: 'changed',
  }).success, false);
});

test('hash canônico é determinístico e não contém o payload', async () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
  const digest = await sha256Hex(stableStringify({ order_id: 'id', next_status: 'entregue' }));
  assert.match(digest, /^[a-f0-9]{64}$/);
});

test('papéis não podem usar ferramentas de outro domínio', () => {
  const context = { role: 'vendedor' } as McpAuthContext;
  assert.doesNotThrow(() => assertToolRole(context, 'list_orders'));
  assert.throws(() => assertToolRole(context, 'list_routes'));
  assert.throws(() => assertOperationalOrderStatus('finalizado'));
});
