import type { McpAuthContext } from './types.ts';

type AuditResult = 'success' | 'denied' | 'error';

export async function recordMcpAudit(
  context: McpAuthContext,
  input: {
    requestId: string;
    toolName: string;
    entityType?: string | null;
    entityId?: string | null;
    result: AuditResult;
    latencyMs: number;
    denialCode?: string | null;
  },
): Promise<void> {
  const { error } = await context.supabase.rpc('fn_mcp_record_audit', {
    p_request_id: input.requestId,
    p_tool_name: input.toolName,
    p_entity_type: input.entityType || null,
    p_entity_id: input.entityId || null,
    p_result: input.result,
    p_latency_ms: Math.max(0, Math.round(input.latencyMs)),
    p_denial_code: input.denialCode || null,
  });

  if (error) {
    // A falha de auditoria não deve vazar detalhes para o cliente nem derrubar uma
    // resposta já calculada. O monitoramento de banco deve alertar este caso.
    console.error('MCP audit write failed', { requestId: input.requestId, code: error.code });
  }
}
