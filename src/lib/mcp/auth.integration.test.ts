import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { authenticateMcpRequest } from './auth.ts';
import { McpHttpError } from './http.ts';

const supabaseUrl = 'https://mcp-auth-test.supabase.co';
const resourceUrl = 'https://admin.bryza.com.br/api/mcp';
const issuer = `${supabaseUrl}/auth/v1`;
const userId = '00000000-0000-4000-8000-000000000001';
const clientId = 'mcp-test-client';

const keyMaterialPromise = (async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'mcp-test-key';
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  return { privateKey, jwk };
})();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

async function signedToken(
  privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'],
  claims: Record<string, unknown> = {},
) {
  return new SignJWT({
    client_id: clientId,
    mcp_agent: true,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'mcp-test-key' })
    .setIssuer(issuer)
    .setAudience(resourceUrl)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

function setMcpEnvironment() {
  const previous = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    MCP_RESOURCE_URL: process.env.MCP_RESOURCE_URL,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.MCP_RESOURCE_URL = resourceUrl;
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

async function withMockedSupabase(
  jwk: JWK,
  callback: () => Promise<void>,
) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(requestUrl(input));

    if (url.pathname === '/auth/v1/.well-known/jwks.json') {
      return jsonResponse({ keys: [jwk] });
    }
    if (url.pathname === '/auth/v1/user') {
      return jsonResponse({ user: { id: userId } });
    }
    if (url.pathname === '/rest/v1/rpc/fn_mcp_validate_agent') {
      return jsonResponse({
        allowed: true,
        display_name: 'MCP Test Client',
        resource_url: resourceUrl,
      });
    }
    if (url.pathname === '/rest/v1/profiles') {
      return jsonResponse([{ role: 'admin', ativo: true, must_change_password: false }]);
    }
    return jsonResponse({ message: `unexpected mocked URL: ${url.pathname}` }, 404);
  };

  try {
    await callback();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test('autentica JWT MCP com JWKS, agente aprovado e perfil ativo', { concurrency: false }, async () => {
  const restoreEnvironment = setMcpEnvironment();
  const { privateKey, jwk } = await keyMaterialPromise;

  try {
    await withMockedSupabase(jwk, async () => {
      const token = await signedToken(privateKey);
      const context = await authenticateMcpRequest(new Request(resourceUrl, {
        headers: { Authorization: `Bearer ${token}` },
      }));

      assert.equal(context.userId, userId);
      assert.equal(context.clientId, clientId);
      assert.equal(context.role, 'admin');
      assert.equal(context.agentName, 'MCP Test Client');
    });
  } finally {
    restoreEnvironment();
  }
});

test('rejeita token com audience MCP incorreta antes de consultar o banco', { concurrency: false }, async () => {
  const restoreEnvironment = setMcpEnvironment();
  const { privateKey, jwk } = await keyMaterialPromise;

  try {
    await withMockedSupabase(jwk, async () => {
      const token = await new SignJWT({ client_id: clientId, mcp_agent: true })
        .setProtectedHeader({ alg: 'RS256', kid: 'mcp-test-key' })
        .setIssuer(issuer)
        .setAudience('https://another-resource.example/api/mcp')
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);

      await assert.rejects(
        () => authenticateMcpRequest(new Request(resourceUrl, {
          headers: { Authorization: `Bearer ${token}` },
        })),
        (error: unknown) => {
          assert(error instanceof McpHttpError);
          assert.equal(error.status, 401);
          assert.equal(error.code, 'invalid_token');
          return true;
        },
      );
    });
  } finally {
    restoreEnvironment();
  }
});

test('rejeita token sem a marca de agente MCP aprovado', { concurrency: false }, async () => {
  const restoreEnvironment = setMcpEnvironment();
  const { privateKey, jwk } = await keyMaterialPromise;

  try {
    await withMockedSupabase(jwk, async () => {
      const token = await signedToken(privateKey, { mcp_agent: false });

      await assert.rejects(
        () => authenticateMcpRequest(new Request(resourceUrl, {
          headers: { Authorization: `Bearer ${token}` },
        })),
        (error: unknown) => {
          assert(error instanceof McpHttpError);
          assert.equal(error.status, 403);
          assert.equal(error.code, 'agent_not_approved');
          return true;
        },
      );
    });
  } finally {
    restoreEnvironment();
  }
});
