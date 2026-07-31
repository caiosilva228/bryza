import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

type Audience = 'all' | 'specific';
type SoundType = 'none' | 'money';

type CreateNotificationBody = {
  audience?: unknown;
  ambassadorId?: unknown;
  title?: unknown;
  body?: unknown;
  targetUrl?: unknown;
  soundType?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getAdminContext() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: 'unauthorized' as const };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.ativo || profile.role !== 'admin') {
    return { error: 'forbidden' as const };
  }

  return {
    admin: createAdminClient(),
    user,
  };
}

function errorResponse(error: 'unauthorized' | 'forbidden') {
  return NextResponse.json(
    { error: error === 'unauthorized' ? 'Não autorizado.' : 'Acesso negado.' },
    { status: error === 'unauthorized' ? 401 : 403 },
  );
}

export async function GET() {
  const context = await getAdminContext();
  if ('error' in context && context.error) return errorResponse(context.error);

  const [
    { data: ambassadors, error: ambassadorsError },
    { data: subscriptions, error: subscriptionsError },
    { data: campaigns, error: campaignsError },
  ] = await Promise.all([
    context.admin
      .from('ambassadors')
      .select('id, full_name, display_name, email, username')
      .eq('status', 'ativo')
      .order('full_name'),
    context.admin
      .from('push_subscriptions')
      .select('ambassador_id'),
    context.admin
      .from('admin_notification_campaigns')
      .select(
        'id, audience, target_ambassador_id, title, body, target_url, sound_type, recipient_count, status, sent_at, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  if (ambassadorsError || subscriptionsError || campaignsError) {
    console.error('Erro ao carregar central de notificações:', {
      ambassadors: ambassadorsError?.code,
      subscriptions: subscriptionsError?.code,
      campaigns: campaignsError?.code,
    });
    return NextResponse.json(
      { error: 'Não foi possível carregar a central de notificações.' },
      { status: 500 },
    );
  }

  const deviceCountByAmbassador = new Map<string, number>();
  for (const subscription of subscriptions || []) {
    const ambassadorId = subscription.ambassador_id;
    if (!ambassadorId) continue;
    deviceCountByAmbassador.set(
      ambassadorId,
      (deviceCountByAmbassador.get(ambassadorId) || 0) + 1,
    );
  }

  const campaignIds = (campaigns || []).map((campaign) => campaign.id);
  const { data: deliveries, error: deliveriesError } = campaignIds.length
    ? await context.admin
      .from('ambassador_notifications')
      .select('campaign_id, dispatch_status, delivered_devices, read_at')
      .in('campaign_id', campaignIds)
    : { data: [], error: null };

  if (deliveriesError) {
    return NextResponse.json(
      { error: 'Não foi possível carregar o histórico de entregas.' },
      { status: 500 },
    );
  }

  const deliveryStats = new Map<string, {
    queued: number;
    sent: number;
    failed: number;
    read: number;
  }>();
  for (const delivery of deliveries || []) {
    if (!delivery.campaign_id) continue;
    const current = deliveryStats.get(delivery.campaign_id) || {
      queued: 0,
      sent: 0,
      failed: 0,
      read: 0,
    };
    if (delivery.dispatch_status === 'sent') {
      current.sent += Number(delivery.delivered_devices) || 0;
    }
    else if (delivery.dispatch_status === 'failed') current.failed += 1;
    else current.queued += 1;
    if (delivery.read_at) current.read += 1;
    deliveryStats.set(delivery.campaign_id, current);
  }

  return NextResponse.json({
    recipients: (ambassadors || []).map((ambassador) => ({
      id: ambassador.id,
      name: ambassador.display_name || ambassador.full_name,
      email: ambassador.email,
      username: ambassador.username,
      deviceCount: deviceCountByAmbassador.get(ambassador.id) || 0,
    })),
    campaigns: (campaigns || []).map((campaign) => ({
      ...campaign,
      deliveries: deliveryStats.get(campaign.id) || {
        queued: 0,
        sent: 0,
        failed: 0,
        read: 0,
      },
    })),
  });
}

export async function POST(request: Request) {
  const context = await getAdminContext();
  if ('error' in context && context.error) return errorResponse(context.error);

  let input: CreateNotificationBody;
  try {
    input = await request.json() as CreateNotificationBody;
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const audience = input.audience === 'all' || input.audience === 'specific'
    ? input.audience as Audience
    : null;
  const ambassadorId = typeof input.ambassadorId === 'string'
    ? input.ambassadorId
    : '';
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  const targetUrl = typeof input.targetUrl === 'string'
    ? input.targetUrl.trim()
    : '/embaixador/dashboard';
  const soundType = input.soundType === 'money' ? 'money' : 'none' as SoundType;

  if (
    !audience
    || title.length < 1
    || title.length > 80
    || body.length < 1
    || body.length > 300
    || targetUrl.length < 1
    || targetUrl.length > 300
    || !targetUrl.startsWith('/')
    || targetUrl.startsWith('//')
    || (audience === 'specific' && !UUID_PATTERN.test(ambassadorId))
  ) {
    return NextResponse.json(
      { error: 'Revise o público, o título, a mensagem e o link.' },
      { status: 400 },
    );
  }

  let recipientsQuery = context.admin
    .from('ambassadors')
    .select('id')
    .eq('status', 'ativo');
  if (audience === 'specific') {
    recipientsQuery = recipientsQuery.eq('id', ambassadorId);
  }

  const { data: recipients, error: recipientsError } = await recipientsQuery;
  if (recipientsError) {
    return NextResponse.json(
      { error: 'Não foi possível carregar os destinatários.' },
      { status: 500 },
    );
  }
  if (!recipients?.length) {
    return NextResponse.json(
      { error: 'Nenhum embaixador ativo foi encontrado para este envio.' },
      { status: 404 },
    );
  }

  const { data: campaign, error: campaignError } = await context.admin
    .from('admin_notification_campaigns')
    .insert({
      created_by: context.user.id,
      audience,
      target_ambassador_id: audience === 'specific' ? ambassadorId : null,
      title,
      body,
      target_url: targetUrl,
      sound_type: soundType,
      recipient_count: recipients.length,
      status: 'queued',
    })
    .select('id')
    .single();

  if (campaignError || !campaign) {
    console.error('Erro ao criar campanha de notificação:', campaignError?.code);
    return NextResponse.json(
      { error: 'Não foi possível criar a notificação.' },
      { status: 500 },
    );
  }

  const { error: notificationsError } = await context.admin
    .from('ambassador_notifications')
    .insert(recipients.map((recipient) => ({
      ambassador_id: recipient.id,
      campaign_id: campaign.id,
      notification_type: 'admin_message',
      title,
      body,
      target_url: targetUrl,
      sound_type: soundType,
    })));

  if (notificationsError) {
    await context.admin
      .from('admin_notification_campaigns')
      .update({ status: 'failed' })
      .eq('id', campaign.id);
    console.error('Erro ao criar inbox dos destinatários:', notificationsError.code);
    return NextResponse.json(
      { error: 'Não foi possível distribuir a notificação.' },
      { status: 500 },
    );
  }

  const sentAt = new Date().toISOString();
  await Promise.all([
    context.admin
      .from('admin_notification_campaigns')
      .update({ status: 'sent', sent_at: sentAt })
      .eq('id', campaign.id),
    context.admin
      .from('audit_logs')
      .insert({
        actor_id: context.user.id,
        actor_role: 'admin',
        action: 'admin_notification_sent',
        entity_type: 'admin_notification_campaign',
        entity_id: campaign.id,
        new_data: {
          audience,
          target_ambassador_id: audience === 'specific' ? ambassadorId : null,
          title,
          body,
          target_url: targetUrl,
          sound_type: soundType,
          recipient_count: recipients.length,
        },
        user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
      }),
  ]);

  return NextResponse.json({
    queued: true,
    campaignId: campaign.id,
    recipients: recipients.length,
  });
}
