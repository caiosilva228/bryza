import assert from 'node:assert/strict';
import test from 'node:test';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { buildMcpServer, MCP_TOOL_NAMES } from './server.ts';
import type { McpAuthContext } from './types.ts';

const fakeContext = {
  userId: '00000000-0000-4000-8000-000000000001',
  role: 'admin',
  clientId: 'test-client',
  agentName: 'Test client',
  claims: {},
  supabase: {},
} as McpAuthContext;

function mcpRequest(message: unknown) {
  return new Request('https://admin.bryza.com.br/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
    },
    body: JSON.stringify(message),
  });
}

test('transport responds to initialize and tools/list with the v1 allowlist', async () => {
  async function dispatch(message: unknown) {
    const server = buildMcpServer(fakeContext, 'protocol-test');
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(mcpRequest(message));
    await transport.close();
    await server.close();
    return response;
  }

  const initializeResponse = await dispatch({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'protocol-test', version: '1.0.0' },
    },
  });
  assert.equal(initializeResponse.status, 200);
  const initializeBody = await initializeResponse.json() as { result?: { protocolVersion?: string } };
  assert.equal(initializeBody.result?.protocolVersion, '2025-06-18');

  const toolsResponse = await dispatch({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  });
  assert.equal(toolsResponse.status, 200);
  const toolsBody = await toolsResponse.json() as { result?: { tools?: Array<{ name: string }> } };
  assert.deepEqual(toolsBody.result?.tools?.map((tool) => tool.name), MCP_TOOL_NAMES);
});
