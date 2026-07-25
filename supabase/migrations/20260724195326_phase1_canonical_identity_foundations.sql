-- Remote migration 20260724195326. Bryza canonical identity foundations — Phase 1 only.
-- This migration is intentionally additive: no backfill, no legacy-field rewrite,
-- and no functional change to customers, orders, commissions, or ambassadors.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM vault.secrets
    WHERE name = 'bryza_identity_hmac_v1'
  ) THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'bryza_identity_hmac_v1',
      'Server-only HMAC key for Bryza canonical identity fingerprints (version 1)'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS private.persons (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 200),
  cpf_normalized text CHECK (cpf_normalized IS NULL OR cpf_normalized ~ '^[0-9]{11}$'),
  email_normalized text CHECK (
    email_normalized IS NULL
    OR (
      email_normalized = lower(btrim(email_normalized))
      AND length(email_normalized) BETWEEN 3 AND 254
      AND position('@' IN email_normalized) > 1
    )
  ),
  phone_normalized text CHECK (
    phone_normalized IS NULL OR phone_normalized ~ '^[0-9]{10,15}$'
  ),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  identity_version bigint NOT NULL DEFAULT 1 CHECK (identity_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK ((status = 'archived') = (archived_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS private.person_identity_fingerprints (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  person_id uuid NOT NULL
    REFERENCES private.persons(id) ON DELETE RESTRICT,
  identifier_type text NOT NULL
    CHECK (identifier_type IN ('cpf', 'email', 'phone')),
  fingerprint bytea NOT NULL CHECK (octet_length(fingerprint) = 32),
  key_version smallint NOT NULL DEFAULT 1 CHECK (key_version > 0),
  is_primary boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  CHECK ((NOT is_active) OR deactivated_at IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_person_identity_fingerprint_active
  ON private.person_identity_fingerprints(identifier_type, fingerprint)
  WHERE is_active;

CREATE UNIQUE INDEX IF NOT EXISTS uq_person_identity_primary_type_active
  ON private.person_identity_fingerprints(person_id, identifier_type)
  WHERE is_active AND is_primary;

CREATE INDEX IF NOT EXISTS idx_person_identity_person
  ON private.person_identity_fingerprints(person_id);

CREATE TABLE IF NOT EXISTS private.person_accounts (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE
    REFERENCES private.persons(id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL UNIQUE
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'disabled')),
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'disabled') = (disabled_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_person_accounts_auth_user
  ON private.person_accounts(auth_user_id);

CREATE TABLE IF NOT EXISTS private.identity_conflict_reviews (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  review_fingerprint bytea NOT NULL CHECK (octet_length(review_fingerprint) = 32),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  conflict_types text[] NOT NULL CHECK (cardinality(conflict_types) > 0),
  candidate_person_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  operation_scope text NOT NULL CHECK (length(operation_scope) BETWEEN 1 AND 100),
  source_entity_type text CHECK (
    source_entity_type IS NULL OR length(source_entity_type) BETWEEN 1 AND 80
  ),
  source_entity_id uuid,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  resolution_code text,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (
    (status = 'open' AND resolved_at IS NULL)
    OR (status <> 'open' AND resolved_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_identity_conflict_open_fingerprint
  ON private.identity_conflict_reviews(review_fingerprint)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_identity_conflict_status_created
  ON private.identity_conflict_reviews(status, created_at);

CREATE TABLE IF NOT EXISTS private.operation_idempotency (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  operation_scope text NOT NULL CHECK (length(operation_scope) BETWEEN 1 AND 100),
  idempotency_key uuid NOT NULL,
  customer_id uuid REFERENCES public.clientes(id) ON DELETE RESTRICT,
  operation_type text NOT NULL CHECK (length(operation_type) BETWEEN 1 AND 100),
  payload_hash bytea NOT NULL CHECK (octet_length(payload_hash) = 32),
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed', 'archived')),
  original_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  processed_at timestamptz,
  retention_until timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation_scope, idempotency_key),
  CHECK (jsonb_typeof(original_result) = 'object'),
  CHECK (
    original_result - ARRAY[
      'status', 'code', 'entity_id', 'review_id', 'operation_id'
    ] = '{}'::jsonb
  ),
  CHECK (
    NOT (original_result ? 'status')
    OR original_result->>'status' ~ '^[a-z0-9_:-]{1,64}$'
  ),
  CHECK (
    NOT (original_result ? 'code')
    OR original_result->>'code' ~ '^[a-z0-9_:-]{1,80}$'
  ),
  CHECK (
    NOT (original_result ? 'entity_id')
    OR original_result->>'entity_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CHECK (
    NOT (original_result ? 'review_id')
    OR original_result->>'review_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CHECK (
    NOT (original_result ? 'operation_id')
    OR original_result->>'operation_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_operation_idempotency_retention
  ON private.operation_idempotency(status, retention_until);

CREATE INDEX IF NOT EXISTS idx_operation_idempotency_processing_lease
  ON private.operation_idempotency(lease_expires_at)
  WHERE status = 'processing';

CREATE TABLE IF NOT EXISTS private.ambassador_program_invitations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES private.persons(id) ON DELETE RESTRICT,
  token_fingerprint bytea NOT NULL UNIQUE CHECK (octet_length(token_fingerprint) = 32),
  key_version smallint NOT NULL DEFAULT 1 CHECK (key_version > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  program_terms_version text NOT NULL CHECK (length(program_terms_version) BETWEEN 1 AND 50),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  invited_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > invited_at),
  CHECK ((status = 'accepted') = (accepted_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_ambassador_invitations_person_status
  ON private.ambassador_program_invitations(person_id, status);

CREATE TABLE IF NOT EXISTS private.ambassador_program_acceptances (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  invitation_id uuid NOT NULL UNIQUE
    REFERENCES private.ambassador_program_invitations(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES private.persons(id) ON DELETE RESTRICT,
  terms_version text NOT NULL CHECK (length(terms_version) BETWEEN 1 AND 50),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  accepted_by_auth_user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  evidence_fingerprint bytea CHECK (
    evidence_fingerprint IS NULL OR octet_length(evidence_fingerprint) = 32
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private.ambassador_program_exceptions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  person_id uuid REFERENCES private.persons(id) ON DELETE RESTRICT,
  ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  rule_code text NOT NULL CHECK (length(rule_code) BETWEEN 1 AND 100),
  effect_type text NOT NULL
    CHECK (effect_type IN ('allow', 'deny', 'override_numeric', 'override_text')),
  numeric_value numeric,
  text_value text,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 1000),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (person_id IS NOT NULL OR ambassador_id IS NOT NULL),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_ambassador_exceptions_person_period
  ON private.ambassador_program_exceptions(person_id, valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_ambassador_exceptions_ambassador_period
  ON private.ambassador_program_exceptions(ambassador_id, valid_from, valid_until);

CREATE TABLE IF NOT EXISTS private.ambassador_qualifications (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  ambassador_id uuid NOT NULL
    REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  rule_code text NOT NULL CHECK (length(rule_code) BETWEEN 1 AND 100),
  status text NOT NULL
    CHECK (status IN ('pending', 'qualified', 'not_qualified', 'exception')),
  rule_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  exception_id uuid
    REFERENCES private.ambassador_program_exceptions(id) ON DELETE RESTRICT,
  evaluated_at timestamptz,
  evaluated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ambassador_id, period_start, period_end, rule_code),
  CHECK (period_end >= period_start),
  CHECK (jsonb_typeof(rule_snapshot) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_ambassador_qualifications_period_status
  ON private.ambassador_qualifications(period_start, period_end, status);

CREATE TABLE IF NOT EXISTS private.customer_commercial_assignments (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  commercial_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  source text NOT NULL CHECK (length(source) BETWEEN 1 AND 100),
  reason text,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_current_commercial_assignment
  ON private.customer_commercial_assignments(customer_id)
  WHERE valid_until IS NULL;

CREATE INDEX IF NOT EXISTS idx_commercial_assignments_profile_period
  ON private.customer_commercial_assignments(commercial_profile_id, valid_from, valid_until);

CREATE TABLE IF NOT EXISTS private.phase1_audit_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 1 AND 100),
  entity_type text NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 100),
  entity_id uuid,
  outcome_code text NOT NULL CHECK (outcome_code ~ '^[a-z0-9_:-]{1,80}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (
    metadata - ARRAY[
      'operation_scope', 'operation_type', 'conflict_types',
      'idempotency_key', 'attempt_count'
    ] = '{}'::jsonb
  )
);

CREATE INDEX IF NOT EXISTS idx_phase1_audit_created
  ON private.phase1_audit_events(created_at);

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS person_id uuid;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS person_id uuid;

ALTER TABLE public.ambassadors
  ADD COLUMN IF NOT EXISTS person_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_person_id_fkey'
      AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES private.persons(id) ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_person_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES private.persons(id) ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ambassadors_person_id_fkey'
      AND conrelid = 'public.ambassadors'::regclass
  ) THEN
    ALTER TABLE public.ambassadors
      ADD CONSTRAINT ambassadors_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES private.persons(id) ON DELETE RESTRICT
      NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_clientes_person_id
  ON public.clientes(person_id) WHERE person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_person_id
  ON public.profiles(person_id) WHERE person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ambassadors_person_id
  ON public.ambassadors(person_id) WHERE person_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.require_phase1_admin()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_actor
      AND p.role::text = 'admin'
      AND p.ativo
  ) THEN
    RAISE EXCEPTION 'admin_permission_required' USING ERRCODE = '42501';
  END IF;

  RETURN v_actor;
END;
$$;

REVOKE ALL ON FUNCTION private.require_phase1_admin() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_phase1_identity_fingerprint(
  p_identifier_type text,
  p_normalized_value text,
  p_key_version smallint DEFAULT 1
)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_type text := lower(btrim(p_identifier_type));
  v_value text;
  v_secret text;
BEGIN
  v_actor := private.require_phase1_admin();

  IF p_key_version <> 1 THEN
    RAISE EXCEPTION 'unsupported_identity_key_version' USING ERRCODE = '22023';
  END IF;

  IF v_type = 'cpf' THEN
    v_value := regexp_replace(coalesce(p_normalized_value, ''), '[^0-9]', '', 'g');
    IF v_value !~ '^[0-9]{11}$' THEN
      RAISE EXCEPTION 'invalid_normalized_cpf' USING ERRCODE = '22023';
    END IF;
  ELSIF v_type = 'phone' THEN
    v_value := regexp_replace(coalesce(p_normalized_value, ''), '[^0-9]', '', 'g');
    IF v_value !~ '^[0-9]{10,15}$' THEN
      RAISE EXCEPTION 'invalid_normalized_phone' USING ERRCODE = '22023';
    END IF;
  ELSIF v_type = 'email' THEN
    v_value := lower(btrim(coalesce(p_normalized_value, '')));
    IF length(v_value) NOT BETWEEN 3 AND 254 OR position('@' IN v_value) <= 1 THEN
      RAISE EXCEPTION 'invalid_normalized_email' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported_identifier_type' USING ERRCODE = '22023';
  END IF;

  SELECT decrypted_secret
  INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'bryza_identity_hmac_v1'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'identity_hmac_secret_unavailable' USING ERRCODE = '55000';
  END IF;

  RETURN extensions.hmac(
    convert_to(v_type || ':' || v_value, 'UTF8'),
    convert_to(v_secret, 'UTF8'),
    'sha256'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_phase1_identity_fingerprint(text, text, smallint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_phase1_identity_fingerprint(text, text, smallint)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_phase1_open_identity_review(
  p_review_fingerprint bytea,
  p_conflict_types text[],
  p_operation_scope text,
  p_candidate_person_ids uuid[] DEFAULT '{}'::uuid[],
  p_source_entity_type text DEFAULT NULL,
  p_source_entity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_review_id uuid;
BEGIN
  v_actor := private.require_phase1_admin();

  IF octet_length(p_review_fingerprint) <> 32
     OR cardinality(p_conflict_types) IS NULL
     OR cardinality(p_conflict_types) = 0
     OR length(btrim(p_operation_scope)) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid_identity_review_request' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.identity_conflict_reviews (
    review_fingerprint,
    conflict_types,
    candidate_person_ids,
    operation_scope,
    source_entity_type,
    source_entity_id,
    requested_by
  )
  VALUES (
    p_review_fingerprint,
    p_conflict_types,
    coalesce(p_candidate_person_ids, '{}'::uuid[]),
    btrim(p_operation_scope),
    nullif(btrim(p_source_entity_type), ''),
    p_source_entity_id,
    v_actor
  )
  ON CONFLICT (review_fingerprint) WHERE status = 'open'
  DO UPDATE SET
    updated_at = now(),
    conflict_types = (
      SELECT array_agg(DISTINCT value ORDER BY value)
      FROM unnest(
        private.identity_conflict_reviews.conflict_types || EXCLUDED.conflict_types
      ) AS value
    )
  RETURNING id INTO v_review_id;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  )
  VALUES (
    v_actor,
    'identity_conflict_review_requested',
    'identity_conflict_review',
    v_review_id,
    'manual_review_required',
    jsonb_build_object(
      'operation_scope', btrim(p_operation_scope),
      'conflict_types', to_jsonb(p_conflict_types)
    )
  );

  RETURN jsonb_build_object(
    'status', 'manual_review_required',
    'review_id', v_review_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_phase1_open_identity_review(
  bytea, text[], text, uuid[], text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_phase1_open_identity_review(
  bytea, text[], text, uuid[], text, uuid
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_phase1_idempotency_begin(
  p_idempotency_key uuid,
  p_operation_scope text,
  p_customer_id uuid,
  p_operation_type text,
  p_payload_hash bytea,
  p_lease_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_row private.operation_idempotency%ROWTYPE;
  v_inserted boolean := false;
BEGIN
  v_actor := private.require_phase1_admin();

  IF p_idempotency_key IS NULL
     OR octet_length(p_payload_hash) <> 32
     OR length(btrim(p_operation_scope)) NOT BETWEEN 1 AND 100
     OR length(btrim(p_operation_type)) NOT BETWEEN 1 AND 100
     OR p_lease_seconds NOT BETWEEN 30 AND 3600 THEN
    RAISE EXCEPTION 'invalid_idempotency_request' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.operation_idempotency (
    operation_scope,
    idempotency_key,
    customer_id,
    operation_type,
    payload_hash,
    actor_id,
    lease_expires_at
  )
  VALUES (
    btrim(p_operation_scope),
    p_idempotency_key,
    p_customer_id,
    btrim(p_operation_type),
    p_payload_hash,
    v_actor,
    now() + make_interval(secs => p_lease_seconds)
  )
  ON CONFLICT (operation_scope, idempotency_key) DO NOTHING
  RETURNING * INTO v_row;

  v_inserted := FOUND;

  IF NOT v_inserted THEN
    SELECT *
    INTO v_row
    FROM private.operation_idempotency
    WHERE operation_scope = btrim(p_operation_scope)
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;
  END IF;

  IF v_row.payload_hash IS DISTINCT FROM p_payload_hash
     OR v_row.customer_id IS DISTINCT FROM p_customer_id
     OR v_row.operation_type IS DISTINCT FROM btrim(p_operation_type) THEN
    INSERT INTO private.phase1_audit_events (
      actor_id, event_type, entity_type, entity_id, outcome_code, metadata
    )
    VALUES (
      v_actor,
      'idempotency_conflict',
      'operation_idempotency',
      v_row.id,
      'idempotency_conflict',
      jsonb_build_object(
        'operation_scope', btrim(p_operation_scope),
        'operation_type', btrim(p_operation_type),
        'idempotency_key', p_idempotency_key
      )
    );

    RETURN jsonb_build_object(
      'status', 'idempotency_conflict',
      'operation_id', v_row.id
    );
  END IF;

  IF v_row.status = 'completed' THEN
    RETURN jsonb_build_object(
      'status', 'replayed',
      'operation_id', v_row.id,
      'result', v_row.original_result
    );
  END IF;

  IF NOT v_inserted
     AND v_row.status = 'processing'
     AND v_row.lease_expires_at > now() THEN
    RETURN jsonb_build_object(
      'status', 'processing',
      'operation_id', v_row.id
    );
  END IF;

  IF NOT v_inserted THEN
    UPDATE private.operation_idempotency
    SET status = 'processing',
        actor_id = v_actor,
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        attempt_count = attempt_count + 1,
        updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_inserted THEN 'acquired' ELSE 'recovered' END,
    'operation_id', v_row.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_phase1_idempotency_begin(
  uuid, text, uuid, text, bytea, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_phase1_idempotency_begin(
  uuid, text, uuid, text, bytea, integer
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_phase1_idempotency_complete(
  p_idempotency_key uuid,
  p_operation_scope text,
  p_payload_hash bytea,
  p_result jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_row private.operation_idempotency%ROWTYPE;
  v_safe_result jsonb := '{}'::jsonb;
  v_value text;
BEGIN
  v_actor := private.require_phase1_admin();

  SELECT *
  INTO v_row
  FROM private.operation_idempotency
  WHERE operation_scope = btrim(p_operation_scope)
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'idempotency_not_found');
  END IF;

  IF v_row.payload_hash IS DISTINCT FROM p_payload_hash THEN
    INSERT INTO private.phase1_audit_events (
      actor_id, event_type, entity_type, entity_id, outcome_code, metadata
    )
    VALUES (
      v_actor,
      'idempotency_conflict',
      'operation_idempotency',
      v_row.id,
      'idempotency_conflict',
      jsonb_build_object(
        'operation_scope', btrim(p_operation_scope),
        'operation_type', v_row.operation_type,
        'idempotency_key', p_idempotency_key
      )
    );
    RETURN jsonb_build_object(
      'status', 'idempotency_conflict',
      'operation_id', v_row.id
    );
  END IF;

  v_value := lower(coalesce(p_result->>'status', 'completed'));
  IF v_value IN ('completed', 'manual_review_required', 'accepted', 'created', 'updated') THEN
    v_safe_result := v_safe_result || jsonb_build_object('status', v_value);
  ELSE
    v_safe_result := v_safe_result || jsonb_build_object('status', 'completed');
  END IF;

  v_value := lower(coalesce(p_result->>'code', ''));
  IF v_value ~ '^[a-z0-9_:-]{1,80}$' THEN
    v_safe_result := v_safe_result || jsonb_build_object('code', v_value);
  END IF;

  FOREACH v_value IN ARRAY ARRAY['entity_id', 'review_id', 'operation_id']
  LOOP
    IF coalesce(p_result->>v_value, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      v_safe_result := v_safe_result || jsonb_build_object(v_value, p_result->>v_value);
    END IF;
  END LOOP;

  UPDATE private.operation_idempotency
  SET status = 'completed',
      original_result = v_safe_result,
      processed_at = now(),
      lease_expires_at = NULL,
      updated_at = now()
  WHERE id = v_row.id;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  )
  VALUES (
    v_actor,
    'idempotency_completed',
    'operation_idempotency',
    v_row.id,
    'completed',
    jsonb_build_object(
      'operation_scope', btrim(p_operation_scope),
      'operation_type', v_row.operation_type,
      'idempotency_key', p_idempotency_key,
      'attempt_count', v_row.attempt_count
    )
  );

  RETURN jsonb_build_object(
    'status', 'completed',
    'operation_id', v_row.id,
    'result', v_safe_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_phase1_idempotency_complete(
  uuid, text, bytea, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_phase1_idempotency_complete(
  uuid, text, bytea, jsonb
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_phase1_my_identity_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_person private.persons%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT p.*
  INTO v_person
  FROM private.person_accounts pa
  JOIN private.persons p ON p.id = pa.person_id
  WHERE pa.auth_user_id = v_actor
    AND pa.status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'identity_not_linked');
  END IF;

  RETURN jsonb_build_object(
    'status', 'linked',
    'person_id', v_person.id,
    'full_name', v_person.full_name,
    'email_masked',
      CASE
        WHEN v_person.email_normalized IS NULL THEN NULL
        ELSE left(v_person.email_normalized, 1) || '***@' ||
             split_part(v_person.email_normalized, '@', 2)
      END,
    'phone_masked',
      CASE
        WHEN v_person.phone_normalized IS NULL THEN NULL
        ELSE repeat('*', greatest(length(v_person.phone_normalized) - 4, 0)) ||
             right(v_person.phone_normalized, 4)
      END,
    'identity_status', v_person.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_phase1_my_identity_summary()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_phase1_my_identity_summary()
  TO authenticated;

CREATE OR REPLACE FUNCTION private.archive_phase1_idempotency(
  p_completed_before timestamptz
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_count bigint;
BEGIN
  UPDATE private.operation_idempotency
  SET status = 'archived',
      original_result = jsonb_strip_nulls(
        jsonb_build_object(
          'status', original_result->>'status',
          'code', original_result->>'code'
        )
      ),
      archived_at = now(),
      updated_at = now()
  WHERE status = 'completed'
    AND processed_at < p_completed_before
    AND retention_until <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION private.archive_phase1_idempotency(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.archive_phase1_idempotency(timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION private.prevent_phase1_history_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'destructive_delete_forbidden:%', TG_TABLE_NAME
    USING ERRCODE = '23000';
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_phase1_history_delete()
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_table text;
  v_trigger text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'persons',
    'person_identity_fingerprints',
    'person_accounts',
    'identity_conflict_reviews',
    'operation_idempotency',
    'ambassador_program_invitations',
    'ambassador_program_acceptances',
    'ambassador_program_exceptions',
    'ambassador_qualifications',
    'customer_commercial_assignments',
    'phase1_audit_events'
  ]
  LOOP
    v_trigger := 'trg_no_delete_' || v_table;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = v_trigger
        AND tgrelid = format('private.%I', v_table)::regclass
        AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE DELETE ON private.%I '
        'FOR EACH ROW EXECUTE FUNCTION private.prevent_phase1_history_delete()',
        v_trigger,
        v_table
      );
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'persons',
    'person_identity_fingerprints',
    'person_accounts',
    'identity_conflict_reviews',
    'operation_idempotency',
    'ambassador_program_invitations',
    'ambassador_program_acceptances',
    'ambassador_program_exceptions',
    'ambassador_qualifications',
    'customer_commercial_assignments',
    'phase1_audit_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format(
      'REVOKE ALL ON TABLE private.%I FROM PUBLIC, anon, authenticated',
      v_table
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE ON TABLE private.%I TO service_role',
      v_table
    );
  END LOOP;
END
$$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA private TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

COMMENT ON SCHEMA private IS
  'Server-only schema. Not exposed through the Data API; direct anon/authenticated access is revoked.';
COMMENT ON COLUMN public.clientes.person_id IS
  'Phase 1 nullable link to canonical identity. No backfill and no current-flow dependency.';
COMMENT ON COLUMN public.profiles.person_id IS
  'Phase 1 nullable link to canonical identity. No backfill and no current-login dependency.';
COMMENT ON COLUMN public.ambassadors.person_id IS
  'Phase 1 nullable link to canonical identity. No backfill and no current-portal dependency.';
COMMENT ON TABLE private.customer_commercial_assignments IS
  'Commercial responsibility history. It is distinct from commissionable ambassador attribution.';
COMMENT ON TABLE private.operation_idempotency IS
  'Scoped idempotency records. original_result is restricted to a minimal non-PII whitelist.';
