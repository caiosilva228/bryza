import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ profile: null }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile) {
      return NextResponse.json({ profile: null }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (err: any) {
    console.error('Erro na API /api/auth/profile:', err);
    return NextResponse.json({ profile: null }, { status: 500 });
  }
}
