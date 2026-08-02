import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getMcpConfig } from '@/lib/mcp/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ confirmation_id?: string; status?: string }>;

function pageMessage(title: string, body: string) {
  return (
    <main style={{ maxWidth: 680, margin: '4rem auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{title}</h1>
      <p>{body}</p>
    </main>
  );
}

export default async function McpConfirmationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  if (!getMcpConfig().enabled) return pageMessage('MCP indisponivel', 'As confirmacoes de agentes estao desativadas neste ambiente.');
  if (params.status === 'approved') return pageMessage('Ação confirmada', 'A confirmação foi registrada. O agente poderá executar esta ação uma única vez antes do vencimento.');

  if (!params.confirmation_id || !/^[0-9a-f-]{36}$/i.test(params.confirmation_id)) {
    return pageMessage('Confirmação inválida', 'O identificador da confirmação não é válido.');
  }
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    redirect(`/login?redirect=${encodeURIComponent(`/mcp/confirm?confirmation_id=${params.confirmation_id}`)}`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo, must_change_password')
    .eq('id', claimsData.claims.sub)
    .maybeSingle();
  if (!profile?.ativo || profile.must_change_password || !['admin', 'logistica'].includes(profile.role)) {
    return pageMessage('Acesso não permitido', 'Somente usuários de administração ou logística podem confirmar ações operacionais.');
  }

  const { data: confirmation, error } = await supabase.rpc('fn_mcp_get_confirmation', {
    p_confirmation_id: params.confirmation_id,
  });
  if (error || !confirmation) return pageMessage('Confirmação indisponível', 'A confirmação não existe, expirou ou pertence a outro usuário.');

  const details = confirmation as {
    tool_name?: string;
    entity_type?: string;
    entity_id?: string;
    preview?: unknown;
    expires_at?: string;
    status?: string;
  };

  return (
    <main style={{ maxWidth: 680, margin: '4rem auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Confirmar ação do agente</h1>
      <p>Revise a prévia. Nada será alterado até você confirmar.</p>
      <dl>
        <dt>Ferramenta</dt><dd>{details.tool_name || 'Ação operacional'}</dd>
        <dt>Entidade</dt><dd>{details.entity_type || '—'} / {details.entity_id || '—'}</dd>
        <dt>Expira em</dt><dd>{details.expires_at || '—'}</dd>
      </dl>
      <h2>Prévia</h2>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: '1rem', borderRadius: 8 }}>
        {JSON.stringify(details.preview || {}, null, 2)}
      </pre>
      <form action="/api/mcp/confirm" method="POST" style={{ display: 'flex', gap: '1rem' }}>
        <input type="hidden" name="confirmation_id" value={params.confirmation_id} />
        <button type="submit">Confirmar</button>
        <a href="/">Cancelar</a>
      </form>
    </main>
  );
}
