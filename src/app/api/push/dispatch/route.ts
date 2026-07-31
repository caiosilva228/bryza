import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getWebPush } from '@/lib/push/server';

export const runtime = 'nodejs';

type NotificationRecord = {
  id?: unknown;
  ambassador_id?: unknown;
  dispatch_token?: unknown;
};

type WebhookPayload = {
  type?: unknown;
  table?: unknown;
  schema?: unknown;
  record?: NotificationRecord;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function describePushError(error: unknown) {
  const pushError = error as {
    name?: string;
    message?: string;
    code?: string;
    statusCode?: number;
    cause?: { code?: string; message?: string };
  };

  return [
    pushError.statusCode ? `http_${pushError.statusCode}` : null,
    pushError.code || pushError.cause?.code || null,
    pushError.name || null,
    pushError.message || pushError.cause?.message || null,
  ]
    .filter(Boolean)
    .join(':')
    .slice(0, 500) || 'push_error';
}

export async function POST(request: Request) {
  let payload: WebhookPayload;
  try {
    payload = await request.json() as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const id = typeof payload.record?.id === 'string' ? payload.record.id : '';
  const token = typeof payload.record?.dispatch_token === 'string'
    ? payload.record.dispatch_token
    : '';

  if (
    payload.type !== 'INSERT'
    || payload.table !== 'ambassador_notifications'
    || payload.schema !== 'public'
    || !UUID_PATTERN.test(id)
    || !UUID_PATTERN.test(token)
  ) {
    return NextResponse.json({ error: 'Webhook inválido.' }, { status: 400 });
  }

  const admin = createAdminClient();
  let claimedNotification = false;
  try {
    const push = getWebPush();
    const { data: notification, error: notificationError } = await admin
      .from('ambassador_notifications')
      .select('id, ambassador_id, title, body, amount, target_url, dispatch_status, dispatch_attempts, created_at')
      .eq('id', id)
      .eq('dispatch_token', token)
      .maybeSingle();

    if (notificationError || !notification) {
      return NextResponse.json({ error: 'Notificação não encontrada.' }, { status: 404 });
    }

    if (notification.dispatch_status === 'sent') {
      return NextResponse.json({ delivered: true, idempotent: true });
    }
    if (
      notification.dispatch_status === 'processing'
      || Number(notification.dispatch_attempts) >= 5
    ) {
      return NextResponse.json({ accepted: true, alreadyProcessing: true });
    }

    const { data: claimed } = await admin
      .from('ambassador_notifications')
      .update({
        dispatch_status: 'processing',
        dispatch_attempts: Number(notification.dispatch_attempts) + 1,
        last_error: null,
      })
      .eq('id', notification.id)
      .in('dispatch_status', ['pending', 'failed'])
      .select('id')
      .maybeSingle();

    if (!claimed) {
      return NextResponse.json({ accepted: true, alreadyProcessing: true });
    }
    claimedNotification = true;

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('ambassador_id', notification.ambassador_id);

    if (subscriptionsError) throw new Error(subscriptionsError.message);

    const message = JSON.stringify({
      id: notification.id,
      type: 'commission_released',
      title: notification.title,
      body: notification.body,
      amount: Number(notification.amount),
      url: notification.target_url,
      createdAt: notification.created_at,
    });

    const expiredIds: string[] = [];
    const errors: string[] = [];
    let delivered = 0;

    await Promise.all((subscriptions || []).map(async (subscription) => {
      try {
        await push.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth_key,
          },
        }, message, {
          TTL: 60 * 60,
          urgency: 'high',
          topic: `c-${notification.id.replaceAll('-', '').slice(0, 30)}`,
        });
        delivered += 1;
      } catch (error) {
        const statusCode = (
          error as { statusCode?: number }
        )?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(subscription.id);
          return;
        }
        const pushError = describePushError(error);
        errors.push(pushError);
        console.error('Falha no provedor Web Push:', {
          subscriptionId: subscription.id,
          error: pushError,
        });
      }
    }));

    if (expiredIds.length) {
      await admin.from('push_subscriptions').delete().in('id', expiredIds);
    }

    const failed = errors.length > 0 && delivered === 0;
    await admin
      .from('ambassador_notifications')
      .update({
        dispatch_status: failed ? 'failed' : 'sent',
        dispatched_at: failed ? null : new Date().toISOString(),
        last_error: errors.length ? errors.join(',').slice(0, 500) : null,
      })
      .eq('id', notification.id);

    return NextResponse.json({
      delivered: !failed,
      devices: delivered,
      removedSubscriptions: expiredIds.length,
    }, { status: failed ? 502 : 200 });
  } catch (error) {
    console.error('Erro ao entregar Web Push de comissão:', error);
    if (claimedNotification) {
      await admin
        .from('ambassador_notifications')
        .update({
          dispatch_status: 'failed',
          last_error: 'dispatch_error',
        })
        .eq('id', id)
        .eq('dispatch_status', 'processing');
    }
    return NextResponse.json({ error: 'Falha ao entregar notificação.' }, { status: 500 });
  }
}
