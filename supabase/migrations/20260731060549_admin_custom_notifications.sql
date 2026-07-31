BEGIN;

CREATE TABLE public.admin_notification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  audience TEXT NOT NULL
    CHECK (audience IN ('all', 'specific')),
  target_ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  title TEXT NOT NULL
    CHECK (char_length(trim(title)) BETWEEN 1 AND 80),
  body TEXT NOT NULL
    CHECK (char_length(trim(body)) BETWEEN 1 AND 300),
  target_url TEXT NOT NULL DEFAULT '/embaixador/dashboard'
    CHECK (
      char_length(target_url) BETWEEN 1 AND 300
      AND target_url LIKE '/%'
      AND target_url NOT LIKE '//%'
    ),
  sound_type TEXT NOT NULL DEFAULT 'none'
    CHECK (sound_type IN ('none', 'money')),
  recipient_count INTEGER NOT NULL DEFAULT 0
    CHECK (recipient_count >= 0),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (audience = 'all' AND target_ambassador_id IS NULL)
    OR
    (audience = 'specific' AND target_ambassador_id IS NOT NULL)
  )
);

CREATE INDEX admin_notification_campaigns_created_at_idx
  ON public.admin_notification_campaigns (created_at DESC);

CREATE INDEX admin_notification_campaigns_created_by_idx
  ON public.admin_notification_campaigns (created_by);

CREATE INDEX admin_notification_campaigns_target_idx
  ON public.admin_notification_campaigns (target_ambassador_id)
  WHERE target_ambassador_id IS NOT NULL;

ALTER TABLE public.admin_notification_campaigns ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_notification_campaigns
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.ambassador_notifications
  ALTER COLUMN commission_id DROP NOT NULL,
  ALTER COLUMN amount DROP NOT NULL,
  ADD COLUMN campaign_id UUID
    REFERENCES public.admin_notification_campaigns(id) ON DELETE CASCADE,
  ADD COLUMN sound_type TEXT NOT NULL DEFAULT 'money',
  ADD COLUMN delivered_devices INTEGER NOT NULL DEFAULT 0
    CHECK (delivered_devices >= 0),
  ADD COLUMN removed_subscriptions INTEGER NOT NULL DEFAULT 0
    CHECK (removed_subscriptions >= 0),
  ADD COLUMN read_at TIMESTAMPTZ;

ALTER TABLE public.ambassador_notifications
  DROP CONSTRAINT IF EXISTS ambassador_notifications_notification_type_check,
  DROP CONSTRAINT IF EXISTS ambassador_notifications_amount_check;

ALTER TABLE public.ambassador_notifications
  ADD CONSTRAINT ambassador_notifications_notification_type_check
    CHECK (notification_type IN ('commission_released', 'admin_message')),
  ADD CONSTRAINT ambassador_notifications_amount_check
    CHECK (amount IS NULL OR amount >= 0),
  ADD CONSTRAINT ambassador_notifications_sound_type_check
    CHECK (sound_type IN ('none', 'money')),
  ADD CONSTRAINT ambassador_notifications_source_check
    CHECK (
      (
        notification_type = 'commission_released'
        AND commission_id IS NOT NULL
        AND amount IS NOT NULL
        AND campaign_id IS NULL
      )
      OR
      (
        notification_type = 'admin_message'
        AND commission_id IS NULL
        AND amount IS NULL
        AND campaign_id IS NOT NULL
      )
    );

CREATE INDEX ambassador_notifications_unread_idx
  ON public.ambassador_notifications (ambassador_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX ambassador_notifications_campaign_idx
  ON public.ambassador_notifications (campaign_id, dispatch_status)
  WHERE campaign_id IS NOT NULL;

CREATE POLICY "Embaixador marca as proprias notificacoes como lidas"
  ON public.ambassador_notifications
  FOR UPDATE
  TO authenticated
  USING (ambassador_id = public.fn_amb_get_id())
  WITH CHECK (ambassador_id = public.fn_amb_get_id());

GRANT UPDATE (read_at) ON public.ambassador_notifications TO authenticated;

COMMIT;
