import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

type SubscriptionPayload = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

async function getAmbassador() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const admin = createAdminClient();
  const { data: ambassador } = await admin
    .from('ambassadors')
    .select('id, user_id, status')
    .eq('user_id', user.id)
    .eq('status', 'ativo')
    .maybeSingle();

  return ambassador ? { admin, ambassador, user } : null;
}

function parseSubscription(body: SubscriptionPayload) {
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : '';
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth.trim() : '';

  if (
    !endpoint.startsWith('https://')
    || endpoint.length > 2048
    || p256dh.length < 20
    || p256dh.length > 512
    || auth.length < 8
    || auth.length > 512
  ) {
    return null;
  }

  return { endpoint, p256dh, auth };
}

export async function GET() {
  const context = await getAmbassador();
  if (!context) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return NextResponse.json(
      { error: 'Notificações ainda não foram configuradas.' },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ambassadorId: context.ambassador.id,
    publicKey,
  });
}

export async function POST(request: Request) {
  const context = await getAmbassador();
  if (!context) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  let body: SubscriptionPayload;
  try {
    body = await request.json() as SubscriptionPayload;
  } catch {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 });
  }

  const subscription = parseSubscription(body);
  if (!subscription) {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 });
  }

  const { error } = await context.admin
    .from('push_subscriptions')
    .upsert({
      ambassador_id: context.ambassador.id,
      user_id: context.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth_key: subscription.auth,
      user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });

  if (error) {
    console.error('Erro ao salvar assinatura Web Push:', error.code);
    return NextResponse.json(
      { error: 'Não foi possível ativar as notificações.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ subscribed: true });
}

export async function DELETE(request: Request) {
  const context = await getAmbassador();
  if (!context) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  let body: { endpoint?: unknown };
  try {
    body = await request.json() as { endpoint?: unknown };
  } catch {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 });
  }

  if (typeof body.endpoint !== 'string' || !body.endpoint.startsWith('https://')) {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 });
  }

  const { error } = await context.admin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', context.user.id)
    .eq('endpoint', body.endpoint);

  if (error) {
    return NextResponse.json(
      { error: 'Não foi possível desativar as notificações.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ subscribed: false });
}
