'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export async function signOutCustomer() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/loja');
}
