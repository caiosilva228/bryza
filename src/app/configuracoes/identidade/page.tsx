import { MainLayout } from '@/components/layout/MainLayout';
import { createClient } from '@/utils/supabase/server';
import { resolveIdentityReview } from './actions';

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

export default async function IdentityReviewsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_admin_list_identity_reviews');
  if (error) throw new Error('Não foi possível carregar as revisões de identidade.');
  const reviews = (data || []) as IdentityReview[];

  return (
    <MainLayout>
      <div className="page-wrapper">
        <div className="page-header">
          <div className="page-header-text">
            <h1>Revisões de identidade</h1>
            <p>Conflitos nunca são unificados automaticamente. Resolva somente com evidências verificáveis.</p>
          </div>
        </div>
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
