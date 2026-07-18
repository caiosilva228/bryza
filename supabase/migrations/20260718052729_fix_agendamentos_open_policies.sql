-- Remove policies legadas permissivas, inclusive nomes truncados a 63 bytes pelo Postgres.
BEGIN;

DO $$
DECLARE v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, p.polname AS policy_name
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('agendamentos', 'agendamento_itens')
      AND (
        COALESCE(pg_get_expr(p.polqual, p.polrelid), '') IN ('true', '(true)')
        OR COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '') IN ('true', '(true)')
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', v_policy.policy_name, v_policy.schema_name, v_policy.table_name);
  END LOOP;
END;
$$;

COMMIT;
