-- EMERGENCY ROLLBACK — DO NOT RUN AS PART OF THE NORMAL MIGRATION FLOW.
-- This removes only objects introduced by
-- 20260724224722_phase1_canonical_identity_foundations.sql.
-- Run in one maintenance transaction after confirming no Phase 2 data exists.

BEGIN;

DROP FUNCTION IF EXISTS public.fn_phase1_my_identity_summary();
DROP FUNCTION IF EXISTS public.fn_phase1_idempotency_complete(uuid, text, bytea, jsonb);
DROP FUNCTION IF EXISTS public.fn_phase1_idempotency_begin(uuid, text, uuid, text, bytea, integer);
DROP FUNCTION IF EXISTS public.fn_phase1_open_identity_review(
  bytea, text[], text, uuid[], text, uuid
);
DROP FUNCTION IF EXISTS public.fn_phase1_identity_fingerprint(text, text, smallint);

ALTER TABLE public.ambassadors DROP CONSTRAINT IF EXISTS ambassadors_person_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_person_id_fkey;
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_person_id_fkey;

DROP INDEX IF EXISTS public.idx_ambassadors_person_id;
DROP INDEX IF EXISTS public.idx_profiles_person_id;
DROP INDEX IF EXISTS public.idx_clientes_person_id;

ALTER TABLE public.ambassadors DROP COLUMN IF EXISTS person_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS person_id;
ALTER TABLE public.clientes DROP COLUMN IF EXISTS person_id;

DROP TABLE IF EXISTS private.phase1_audit_events;
DROP TABLE IF EXISTS private.customer_commercial_assignments;
DROP TABLE IF EXISTS private.ambassador_qualifications;
DROP TABLE IF EXISTS private.ambassador_program_exceptions;
DROP TABLE IF EXISTS private.ambassador_program_acceptances;
DROP TABLE IF EXISTS private.ambassador_program_invitations;
DROP TABLE IF EXISTS private.operation_idempotency;
DROP TABLE IF EXISTS private.identity_conflict_reviews;
DROP TABLE IF EXISTS private.person_accounts;
DROP TABLE IF EXISTS private.person_identity_fingerprints;
DROP TABLE IF EXISTS private.persons;

DROP FUNCTION IF EXISTS private.archive_phase1_idempotency(timestamptz);
DROP FUNCTION IF EXISTS private.prevent_phase1_history_delete();
DROP FUNCTION IF EXISTS private.require_phase1_admin();

DO $$
DECLARE
  v_secret_id uuid;
BEGIN
  SELECT id INTO v_secret_id
  FROM vault.secrets
  WHERE name = 'bryza_identity_hmac_v1'
  LIMIT 1;

  IF v_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
END
$$;

DROP SCHEMA IF EXISTS private;

COMMIT;
