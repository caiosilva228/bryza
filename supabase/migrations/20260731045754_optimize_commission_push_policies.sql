BEGIN;

CREATE INDEX push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

DROP POLICY "Embaixador ve os proprios dispositivos"
  ON public.push_subscriptions;
CREATE POLICY "Embaixador ve os proprios dispositivos"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND ambassador_id = (SELECT public.fn_amb_get_id())
  );

DROP POLICY "Embaixador ve as proprias notificacoes"
  ON public.ambassador_notifications;
CREATE POLICY "Embaixador ve as proprias notificacoes"
  ON public.ambassador_notifications
  FOR SELECT
  TO authenticated
  USING (ambassador_id = (SELECT public.fn_amb_get_id()));

COMMIT;
