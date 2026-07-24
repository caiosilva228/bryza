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
