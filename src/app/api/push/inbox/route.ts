import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

type MarkReadBody = {
  id?: unknown;
  all?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getAmbassadorClient() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .maybeSingle();

  return profile?.role === 'embaixador' && profile.ativo ? supabase : null;
}

export async function GET() {
  const supabase = await getAmbassadorClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('ambassador_notifications')
    .select(
      'id, notification_type, title, body, amount, target_url, sound_type, read_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Erro ao carregar inbox do embaixador:', error.code);
    return NextResponse.json(
      { error: 'Não foi possível carregar as notificações.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    notifications: data || [],
    unreadCount: (data || []).filter((notification) => !notification.read_at).length,
  });
}

export async function PATCH(request: Request) {
  const supabase = await getAmbassadorClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  let input: MarkReadBody;
  try {
    input = await request.json() as MarkReadBody;
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const markAll = input.all === true;
  const id = typeof input.id === 'string' ? input.id : '';
  if (!markAll && !UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: 'Informe a notificação que foi lida.' },
      { status: 400 },
    );
  }

  let query = supabase
    .from('ambassador_notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (!markAll) query = query.eq('id', id);
  const { error } = await query;

  if (error) {
    console.error('Erro ao marcar notificação como lida:', error.code);
    return NextResponse.json(
      { error: 'Não foi possível atualizar a notificação.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ updated: true });
}
