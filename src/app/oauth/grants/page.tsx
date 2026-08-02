import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ revoked?: string; error?: string }>;

function message(title: string, body: string) {
  return (
    <main style={{ maxWidth: 760, margin: '4rem auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{title}</h1>
      <p>{body}</p>
    </main>
  );
}

export default async function OAuthGrantsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect('/login?redirect=/oauth/grants');

  const { data: profile } = await supabase
    .from('profiles')
    .select('ativo, must_change_password')
    .eq('id', claimsData.claims.sub)
    .maybeSingle();
  if (!profile?.ativo || profile.must_change_password) {
    return message('Acesso não permitido', 'Esta conta não pode gerenciar autorizações OAuth.');
  }

  const { data: grants, error } = await supabase.auth.oauth.listGrants();
  if (error) return message('Acessos indisponíveis', 'Não foi possível carregar os acessos OAuth agora.');

  return (
    <main style={{ maxWidth: 760, margin: '4rem auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Acessos de agentes e aplicações</h1>
      <p>Revogue aqui o acesso de qualquer cliente OAuth autorizado nesta conta.</p>
      {params.revoked === '1' && <p role="status">Acesso revogado com sucesso.</p>}
      {params.error === '1' && <p role="alert">Não foi possível revogar este acesso.</p>}

      {!grants || grants.length === 0 ? (
        <p>Nenhum cliente OAuth autorizado.</p>
      ) : (
        <div>
          {grants.map((grant) => (
            <article key={grant.client.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', margin: '1rem 0' }}>
              <h2>{grant.client.name}</h2>
              <p style={{ wordBreak: 'break-all' }}>{grant.client.uri}</p>
              <p>Escopos: {grant.scopes.join(', ') || 'nenhum escopo adicional'}</p>
              <p>Autorizado em: {grant.granted_at}</p>
              <form action="/api/oauth/revoke" method="POST">
                <input type="hidden" name="client_id" value={grant.client.id} />
                <button type="submit">Revogar acesso</button>
              </form>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
