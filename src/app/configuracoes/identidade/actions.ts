'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

export async function resolveIdentityReview(formData: FormData) {
  const reviewId = String(formData.get('review_id') || '');
  const resolutionCode = String(formData.get('resolution_code') || '');
  const notes = String(formData.get('notes') || '');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_admin_resolve_identity_review', {
    p_review_id: reviewId,
    p_resolution_code: resolutionCode,
    p_resolution_notes: notes,
  });
  if (error) throw new Error(error.message);

  const result = data as { status?: string };
  if (result.status !== 'resolved') {
    throw new Error('A revisão não está mais aberta.');
  }
  revalidatePath('/configuracoes/identidade');
}

export async function saveFounderCampaign(formData: FormData) {
  const campaignId = String(formData.get('campaign_id') || '') || null;
  const code = String(formData.get('code') || '').trim().toLowerCase();
  const name = String(formData.get('name') || '').trim();
  const status = String(formData.get('status') || 'draft');
  const startsAt = String(formData.get('starts_at') || '');
  const endsAt = String(formData.get('ends_at') || '');
  const eligibilityLabel = String(formData.get('eligibility_label') || '').trim();
  const termsVersion = String(formData.get('terms_version') || '').trim();
  const reason = String(formData.get('reason') || '').trim();

  if (
    code.length < 3
    || name.length < 3
    || !startsAt
    || !endsAt
    || eligibilityLabel.length < 3
    || termsVersion.length < 1
    || reason.length < 5
  ) {
    throw new Error('Preencha todos os dados obrigatórios da campanha.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_admin_save_founder_campaign', {
    p_campaign_id: campaignId,
    p_code: code,
    p_name: name,
    p_status: status,
    p_starts_at: new Date(startsAt).toISOString(),
    p_ends_at: new Date(endsAt).toISOString(),
    p_waive_purchase_minimum: formData.get('waive_purchase_minimum') === 'on',
    p_eligibility_label: eligibilityLabel,
    p_terms_version: termsVersion,
    p_reason: reason,
    p_source: 'admin_identity_operations',
  });

  if (error) throw new Error(error.message);
  const result = data as { status?: string };
  if (result.status === 'active_campaign_exists') {
    throw new Error('Já existe outra campanha ativa. Inative-a antes de ativar esta.');
  }
  if (result.status !== 'saved') {
    throw new Error('A campanha não pôde ser salva.');
  }

  revalidatePath('/configuracoes/identidade');
}

export async function markFounderCustomersEligible(formData: FormData) {
  const campaignId = String(formData.get('campaign_id') || '') || null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    'fn_admin_mark_founder_customers_eligible',
    { p_campaign_id: campaignId }
  );

  if (error) throw new Error(error.message);
  const result = data as { status?: string };
  if (result.status !== 'completed') {
    throw new Error('A marcação de elegibilidade não pôde ser concluída.');
  }

  revalidatePath('/configuracoes/identidade');
  revalidatePath('/clientes');
}
