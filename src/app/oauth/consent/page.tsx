import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getMcpConfig } from '@/lib/mcp/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ authorization_id?: string }>;

function message(title: string, body: string) {
  return (
    <main style={{ maxWidth: 680, margin: '4rem auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{title}</h1>
      <p>{body}</p>
    </main>
  );
}

export default async function ConsentPage({ searchParams }: { searchParams: SearchParams }) {
  if (!getMcpConfig().enabled) return message('MCP indisponível', 'A autorização de agentes está desativada neste ambiente.');
  const authorizationId = (await searchParams).authorization_id;
  if (!authorizationId || !/^[A-Za-z0-9_-]{8,240}$/.test(authorizationId)) {
    return message('Solicitação inválida', 'A solicitação OAuth não possui um identificador válido.');
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    redirect(`/login?redirect=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo, must_change_password')
    .eq('id', claimsData.claims.sub)
    .maybeSingle();
  if (!profile?.ativo || profile.must_change_password || !['admin', 'vendedor', 'logistica', 'embaixador'].includes(profile.role)) {
    return message('Acesso não permitido', 'Esta conta não pode autorizar um agente MCP.');
  }

  if (profile.role === 'embaixador') {
    const { data: ambassador } = await supabase
      .from('ambassadors')
      .select('status')
      .eq('user_id', claimsData.claims.sub)
      .maybeSingle();
    if (ambassador?.status !== 'ativo') return message('Acesso não permitido', 'O perfil de embaixador não está ativo.');
  }

  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !details) return message('Solicitação inválida', 'Não foi possível validar a solicitação OAuth.');
  if (!('authorization_id' in details)) redirect(details.redirect_url);

  const config = getMcpConfig();
  const { data: approvedAgent, error: agentError } = await supabase.rpc('fn_mcp_get_agent_details', {
    p_client_id: details.client.id,
    p_resource_url: config.resourceUrl,
  });
  if (agentError || !approvedAgent || (approvedAgent as { allowed?: boolean }).allowed !== true) {
    return message('Agente não aprovado', 'Este cliente de IA não está aprovado para o ambiente Bryza atual.');
  }

  const scopes = details.scope.split(/\s+/).filter(Boolean);
  return (
    <main style={{ maxWidth: 680, margin: '4rem auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Autorizar {details.client.name}</h1>
      <p>Este agente de IA solicita acesso operacional ao Bryza em nome da sua conta.</p>

      <section>
        <h2>Cliente</h2>
        <p>{details.client.name}</p>
        <p style={{ wordBreak: 'break-all' }}>{details.client.uri}</p>
      </section>

      <section>
        <h2>O que poderá ser acessado</h2>
        <ul>
          <li>Pedidos e rotas permitidos pelo seu papel e pelo RLS.</li>
          <li>Resumo operacional e estoque somente para papéis habilitados.</li>
          <li>Para embaixadores: apenas o próprio painel e indicadores permitidos.</li>
          <li>CPF, Pix, pagamentos, credenciais, clientes finais e segredos ficam fora do MCP.</li>
        </ul>
      </section>

      <section>
        <h2>Ações possíveis</h2>
        <p>Atualizações de status e problemas de entrega exigem uma nova confirmação explícita na tela do Bryza e são de uso único.</p>
      </section>

      <section>
        <h2>Escopos OAuth solicitados</h2>
        {scopes.length > 0 ? <ul>{scopes.map((scope) => <li key={scope}>{scope}</li>)}</ul> : <p>Nenhum escopo OIDC adicional.</p>}
      </section>

      <p>Você pode negar agora ou revogar este acesso depois nas configurações da conta.</p>
      <p><a href="/oauth/grants">Gerenciar e revogar acessos OAuth já autorizados</a></p>
      <form action="/api/oauth/decision" method="POST" style={{ display: 'flex', gap: '1rem' }}>
        <input type="hidden" name="authorization_id" value={authorizationId} />
        <button type="submit" name="decision" value="approve">Aprovar</button>
        <button type="submit" name="decision" value="deny">Negar</button>
      </form>
    </main>
  );
}
