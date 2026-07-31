BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE CHECK (char_length(endpoint) BETWEEN 20 AND 2048),
  p256dh TEXT NOT NULL CHECK (char_length(p256dh) BETWEEN 20 AND 512),
  auth_key TEXT NOT NULL CHECK (char_length(auth_key) BETWEEN 8 AND 512),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX push_subscriptions_ambassador_idx
  ON public.push_subscriptions (ambassador_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Embaixador ve os proprios dispositivos"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND ambassador_id = public.fn_amb_get_id()
  );

REVOKE ALL ON public.push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.push_subscriptions TO authenticated;

CREATE TABLE public.ambassador_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL DEFAULT 'commission_released'
    CHECK (notification_type IN ('commission_released')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  target_url TEXT NOT NULL DEFAULT '/embaixador/comissoes',
  dispatch_token UUID NOT NULL DEFAULT gen_random_uuid(),
  dispatch_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (dispatch_status IN ('pending', 'processing', 'sent', 'failed')),
  dispatch_attempts INTEGER NOT NULL DEFAULT 0 CHECK (dispatch_attempts >= 0),
  dispatched_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (commission_id, notification_type)
);

CREATE INDEX ambassador_notifications_recipient_idx
  ON public.ambassador_notifications (ambassador_id, created_at DESC);

ALTER TABLE public.ambassador_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Embaixador ve as proprias notificacoes"
  ON public.ambassador_notifications
  FOR SELECT
  TO authenticated
  USING (ambassador_id = public.fn_amb_get_id());

REVOKE ALL ON public.ambassador_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ambassador_notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_create_commission_release_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'liberada' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'liberada' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.ambassador_notifications (
    ambassador_id,
    commission_id,
    title,
    body,
    amount
  )
  VALUES (
    NEW.ambassador_id,
    NEW.id,
    'Nova comissão liberada!',
    'Sua comissão de R$ ' ||
      replace(to_char(NEW.commission_amount, 'FM999999990D00'), '.', ',') ||
      ' já está disponível.',
    NEW.commission_amount
  )
  ON CONFLICT (commission_id, notification_type) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_commission_release_notification()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_create_commission_release_notification
  ON public.commissions;
CREATE TRIGGER trg_create_commission_release_notification
AFTER INSERT OR UPDATE OF status
ON public.commissions
FOR EACH ROW
EXECUTE FUNCTION public.fn_create_commission_release_notification();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ambassador_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.ambassador_notifications;
  END IF;
END
$$;

-- pg_net is asynchronous, so commission processing is never held up by an
-- unavailable web server. The per-record dispatch token is checked by the
-- endpoint before any push is sent.
CREATE OR REPLACE FUNCTION public.fn_dispatch_commission_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ev.bryza.com.br/api/push/dispatch',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', NULL
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dispatch_commission_push()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_dispatch_commission_push
AFTER INSERT
ON public.ambassador_notifications
FOR EACH ROW
EXECUTE FUNCTION public.fn_dispatch_commission_push();

COMMIT;
