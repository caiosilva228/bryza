import { MainLayout } from '@/components/layout/MainLayout';
import { createClient } from '@/utils/supabase/server';
import {
  markFounderCustomersEligible,
  resolveIdentityReview,
  saveFounderCampaign,
} from './actions';

interface IdentityReview {
  review_id: string;
  status: string;
  conflict_types: string[];
  operation_scope: string;
  candidate_count: number;
  created_at: string;
  resolved_at?: string | null;
  resolution_code?: string | null;
}

interface EntryCampaign {
  id: string;
  code: string;
  name: string;
  status: 'draft' | 'active' | 'inactive';
  starts_at: string;
  ends_at: string;
  waive_purchase_minimum: boolean;
  eligibility_label: string;
  terms_version: string;
  reason: string;
  source: string;
}

interface InvitationOperations {
  eligible_count: number;
  founder_eligible_count: number;
  pending_invitation_count: number;
  accepted_invitation_count: number;
  campaigns: EntryCampaign[];
}

function datetimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default async function IdentityReviewsPage() {
  const supabase = await createClient();
  const [reviewsResponse, operationsResponse] = await Promise.all([
    supabase.rpc('fn_admin_list_identity_reviews'),
    supabase.rpc('fn_admin_get_invitation_operations'),
  ]);
  if (reviewsResponse.error) {
    throw new Error('Não foi possível carregar as revisões de identidade.');
  }
  if (operationsResponse.error) {
    throw new Error('Não foi possível carregar as operações do programa.');
  }
  const reviews = (reviewsResponse.data || []) as IdentityReview[];
  const operations = operationsResponse.data as InvitationOperations;
  const campaigns = operations.campaigns || [];
  const defaultStart = datetimeLocal(new Date().toISOString());
  const defaultEndDate = new Date(defaultStart);
  defaultEndDate.setDate(defaultEndDate.getDate() + 90);
  const defaultEnd = datetimeLocal(defaultEndDate.toISOString());

  return (
    <MainLayout>
      <div className="page-wrapper">
        <div className="page-header">
          <div className="page-header-text">
            <h1>Revisões de identidade</h1>
            <p>Conflitos nunca são unificados automaticamente. Resolva somente com evidências verificáveis.</p>
          </div>
        </div>
        <section style={{ marginBottom: '24px', background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: 0 }}>Elegibilidade e campanha de clientes fundadores</h2>
              <p style={{ color: 'var(--color-on-surface-variant)', maxWidth: '760px' }}>
                Marcar elegibilidade não cria usuário, não ativa embaixador e não concede comissão.
                Casos com conflito de identidade permanecem em revisão.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(90px, 1fr))', gap: '10px' }}>
              {[
                ['Elegíveis', operations.eligible_count],
                ['Fundadores', operations.founder_eligible_count],
                ['Convites pendentes', operations.pending_invitation_count],
                ['Aceites', operations.accepted_invitation_count],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ padding: '10px', borderRadius: '10px', background: 'var(--color-surface-container-low)', textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: '20px' }}>{value}</strong>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          </div>

          <form action={markFounderCustomersEligible} style={{ marginTop: '18px', display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: '6px', minWidth: '280px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>Campanha associada (opcional)</span>
              <select name="campaign_id" defaultValue="">
                <option value="">Sem campanha associada</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} — {campaign.status}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary">
              Marcar clientes atuais como “Cliente fundador”
            </button>
          </form>

          <div style={{ display: 'grid', gap: '14px', marginTop: '22px' }}>
            {[...campaigns, null].map((campaign, index) => (
              <form
                action={saveFounderCampaign}
                key={campaign?.id || 'new-campaign'}
                style={{ padding: '16px', border: '1px solid var(--color-outline-variant)', borderRadius: '12px', display: 'grid', gap: '12px' }}
              >
                <input type="hidden" name="campaign_id" value={campaign?.id || ''} />
                <strong>{campaign ? campaign.name : 'Nova campanha configurável'}</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr .7fr', gap: '10px' }}>
                  <label style={{ display: 'grid', gap: '5px' }}>
                    <span>Código</span>
                    <input name="code" required minLength={3} maxLength={80} defaultValue={campaign?.code || `clientes-fundadores-${new Date().getFullYear()}-${index + 1}`} />
                  </label>
                  <label style={{ display: 'grid', gap: '5px' }}>
                    <span>Nome</span>
                    <input name="name" required minLength={3} maxLength={120} defaultValue={campaign?.name || 'Clientes fundadores'} />
                  </label>
                  <label style={{ display: 'grid', gap: '5px' }}>
                    <span>Status</span>
                    <select name="status" defaultValue={campaign?.status || 'draft'}>
                      <option value="draft">Rascunho</option>
                      <option value="active">Ativa</option>
                      <option value="inactive">Inativa</option>
                    </select>
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <label style={{ display: 'grid', gap: '5px' }}>
                    <span>Início</span>
                    <input name="starts_at" type="datetime-local" required defaultValue={campaign ? datetimeLocal(campaign.starts_at) : defaultStart} />
                  </label>
                  <label style={{ display: 'grid', gap: '5px' }}>
                    <span>Término</span>
                    <input name="ends_at" type="datetime-local" required defaultValue={campaign ? datetimeLocal(campaign.ends_at) : defaultEnd} />
                  </label>
                  <label style={{ display: 'grid', gap: '5px' }}>
                    <span>Versão dos termos</span>
                    <input name="terms_version" required maxLength={80} defaultValue={campaign?.terms_version || 'programa-embaixadores-v1'} />
                  </label>
                </div>
                <label style={{ display: 'grid', gap: '5px' }}>
                  <span>Rótulo de elegibilidade</span>
                  <input name="eligibility_label" required maxLength={120} defaultValue={campaign?.eligibility_label || 'Elegível para convite — Cliente fundador'} />
                </label>
                <label style={{ display: 'grid', gap: '5px' }}>
                  <span>Motivo auditável</span>
                  <input name="reason" required minLength={5} maxLength={500} defaultValue={campaign?.reason || 'Condição temporária de entrada para clientes existentes.'} />
                </label>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input name="waive_purchase_minimum" type="checkbox" defaultChecked={campaign?.waive_purchase_minimum ?? true} />
                  Entrada sem a compra mínima durante a vigência
                </label>
                <button type="submit" className="btn-primary" style={{ justifySelf: 'start' }}>
                  {campaign ? 'Salvar campanha' : 'Criar campanha'}
                </button>
              </form>
            ))}
          </div>
        </section>

        <h2 style={{ margin: '0 0 14px' }}>Revisões de identidade</h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          {reviews.map((review) => (
            <section key={review.review_id} style={{ background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <strong>{review.operation_scope}</strong>
                  <p style={{ margin: '6px 0', color: 'var(--color-on-surface-variant)' }}>
                    {review.conflict_types.join(', ')} · {review.candidate_count} identidades candidatas
                  </p>
                  <small>{new Date(review.created_at).toLocaleString('pt-BR')}</small>
                </div>
                <span style={{ fontWeight: 800, color: review.status === 'open' ? '#b45309' : '#047857' }}>
                  {review.status === 'open' ? 'ABERTA' : `RESOLVIDA · ${review.resolution_code}`}
                </span>
              </div>
              {review.status === 'open' && (
                <form action={resolveIdentityReview} style={{ marginTop: '18px', display: 'grid', gridTemplateColumns: 'minmax(190px, .5fr) 1fr auto', gap: '10px' }}>
                  <input type="hidden" name="review_id" value={review.review_id} />
                  <select name="resolution_code" required defaultValue="">
                    <option value="" disabled>Selecione a conclusão</option>
                    <option value="confirmed_same_person">Mesma pessoa, confirmado</option>
                    <option value="confirmed_distinct_people">Pessoas distintas</option>
                    <option value="corrected_source_data">Dado de origem corrigido</option>
                    <option value="insufficient_evidence">Evidência insuficiente</option>
                    <option value="rejected">Solicitação rejeitada</option>
                  </select>
                  <input name="notes" required minLength={5} maxLength={1000} placeholder="Evidências e observações da decisão" />
                  <button type="submit" className="btn-primary">Registrar decisão</button>
                </form>
              )}
            </section>
          ))}
          {reviews.length === 0 && <p>Nenhuma revisão registrada.</p>}
        </div>
      </div>
    </MainLayout>
  );
}
