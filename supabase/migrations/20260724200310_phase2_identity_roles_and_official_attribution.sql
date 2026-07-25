-- Remote migration 20260724200310. Phase 2: business/access roles, official commissionable attribution,
-- and canonical customer write service.
-- Additive compatibility stage: direct legacy writes are not blocked until the
-- application has been migrated to the transactional services.

CREATE TABLE IF NOT EXISTS private.person_business_roles (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES private.persons(id) ON DELETE RESTRICT,
  role_type text NOT NULL CHECK (role_type IN ('customer', 'ambassador')),
  source_entity_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'inactive', 'archived')),
  activated_at timestamptz,
  inactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_type, source_entity_id),
  UNIQUE (person_id, role_type)
);

CREATE INDEX IF NOT EXISTS idx_person_business_roles_person_status
  ON private.person_business_roles(person_id, status);

CREATE TABLE IF NOT EXISTS private.person_access_permissions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES private.persons(id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  permission_type text NOT NULL
    CHECK (permission_type IN ('admin', 'seller', 'logistics', 'driver', 'ambassador_portal')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_user_id, permission_type),
  CHECK ((status = 'active') = (revoked_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_person_access_person_status
  ON private.person_access_permissions(person_id, status);

CREATE TABLE IF NOT EXISTS private.customer_ambassador_assignments (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'revoked', 'archived')),
  is_validated boolean NOT NULL DEFAULT false,
  is_commissionable boolean NOT NULL DEFAULT false,
  source text NOT NULL CHECK (
    source IN (
      'admin_selection',
      'manual_order_selection',
      'smart_link',
      'manual_code',
      'verified_migration',
      'administrative_review'
    )
  ),
  evidence_code text NOT NULL CHECK (length(evidence_code) BETWEEN 3 AND 100),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  ended_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 1000),
  idempotency_record_id uuid
    REFERENCES private.operation_idempotency(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'active' AND valid_until IS NULL AND ended_by IS NULL)
    OR (status <> 'active' AND valid_until IS NOT NULL)
  ),
  CHECK (NOT is_commissionable OR (is_validated AND status = 'active'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_active_ambassador_assignment
  ON private.customer_ambassador_assignments(customer_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_customer_assignment_ambassador_period
  ON private.customer_ambassador_assignments(ambassador_id, valid_from, valid_until);

CREATE TABLE IF NOT EXISTS private.legacy_referral_link_archive (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  legacy_ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  legacy_referral_attribution_id uuid
    REFERENCES public.referral_attributions(id) ON DELETE RESTRICT,
  legacy_source text NOT NULL,
  classification text NOT NULL DEFAULT 'unverified_commercial_migration'
    CHECK (classification IN (
      'unverified_commercial_migration',
      'verified_referral',
      'rejected_referral'
    )),
  is_commissionable boolean NOT NULL DEFAULT false,
  captured_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_notes text,
  UNIQUE (customer_id, legacy_source)
);

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS commissionable_ambassador_id uuid,
  ADD COLUMN IF NOT EXISTS current_referral_assignment_id uuid,
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_commissionable_ambassador_id_fkey'
      AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_commissionable_ambassador_id_fkey
      FOREIGN KEY (commissionable_ambassador_id)
      REFERENCES public.ambassadors(id) ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_current_referral_assignment_id_fkey'
      AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_current_referral_assignment_id_fkey
      FOREIGN KEY (current_referral_assignment_id)
      REFERENCES private.customer_ambassador_assignments(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_lifecycle_status_check'
      AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_lifecycle_status_check
      CHECK (lifecycle_status IN ('active', 'inactive', 'archived')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_archived_by_fkey'
      AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_archived_by_fkey
      FOREIGN KEY (archived_by) REFERENCES auth.users(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_clientes_commissionable_ambassador
  ON public.clientes(commissionable_ambassador_id)
  WHERE commissionable_ambassador_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_lifecycle_active
  ON public.clientes(data_cadastro DESC)
  WHERE lifecycle_status = 'active';

ALTER TABLE public.ambassadors
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ambassadors_lifecycle_status_check'
      AND conrelid = 'public.ambassadors'::regclass
  ) THEN
    ALTER TABLE public.ambassadors
      ADD CONSTRAINT ambassadors_lifecycle_status_check
      CHECK (lifecycle_status IN ('active', 'inactive', 'archived')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ambassadors_archived_by_fkey'
      AND conrelid = 'public.ambassadors'::regclass
  ) THEN
    ALTER TABLE public.ambassadors
      ADD CONSTRAINT ambassadors_archived_by_fkey
      FOREIGN KEY (archived_by) REFERENCES auth.users(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION private.require_phase2_actor(
  p_allowed_roles text[]
)
RETURNS TABLE(actor_id uuid, actor_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT p.role::text
  INTO v_role
  FROM public.profiles p
  WHERE p.id = v_actor AND p.ativo;

  IF v_role IS NULL OR NOT (v_role = ANY(p_allowed_roles)) THEN
    RAISE EXCEPTION 'permission_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT v_actor, v_role;
END;
$$;

REVOKE ALL ON FUNCTION private.require_phase2_actor(text[])
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.identity_hmac_internal(
  p_identifier_type text,
  p_normalized_value text,
  p_key_version smallint DEFAULT 1
)
RETURNS bytea
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_secret text;
BEGIN
  IF p_key_version <> 1 OR p_normalized_value IS NULL OR p_normalized_value = '' THEN
    RAISE EXCEPTION 'invalid_identity_fingerprint_input' USING ERRCODE = '22023';
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
    convert_to(p_identifier_type || ':' || p_normalized_value, 'UTF8'),
    convert_to(v_secret, 'UTF8'),
    'sha256'
  );
END;
$$;

REVOKE ALL ON FUNCTION private.identity_hmac_internal(text, text, smallint)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.persist_identity_review_internal(
  p_actor uuid,
  p_review_fingerprint bytea,
  p_conflict_types text[],
  p_operation_scope text,
  p_candidate_person_ids uuid[],
  p_source_entity_type text,
  p_source_entity_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_review_id uuid;
BEGIN
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
    p_operation_scope,
    p_source_entity_type,
    p_source_entity_id,
    p_actor
  )
  ON CONFLICT (review_fingerprint) WHERE status = 'open'
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_review_id;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  )
  VALUES (
    p_actor,
    'identity_conflict_review_requested',
    'identity_conflict_review',
    v_review_id,
    'manual_review_required',
    jsonb_build_object(
      'operation_scope', p_operation_scope,
      'conflict_types', to_jsonb(p_conflict_types)
    )
  );

  RETURN v_review_id;
END;
$$;

REVOKE ALL ON FUNCTION private.persist_identity_review_internal(
  uuid, bytea, text[], text, uuid[], text, uuid
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_assign_customer_ambassador(
  p_customer_id uuid,
  p_ambassador_id uuid,
  p_source text,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_customer public.clientes%ROWTYPE;
  v_ambassador public.ambassadors%ROWTYPE;
  v_current private.customer_ambassador_assignments%ROWTYPE;
  v_assignment_id uuid;
  v_payload_hash bytea;
  v_idempotency private.operation_idempotency%ROWTYPE;
BEGIN
  SELECT actor_id, actor_role
  INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  IF p_customer_id IS NULL
     OR p_ambassador_id IS NULL
     OR p_idempotency_key IS NULL
     OR p_source NOT IN (
       'admin_selection', 'manual_order_selection',
       'verified_migration', 'administrative_review'
     )
     OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'invalid_assignment_request' USING ERRCODE = '22023';
  END IF;

  v_payload_hash := extensions.digest(
    convert_to(
      jsonb_build_object(
        'customer_id', p_customer_id,
        'ambassador_id', p_ambassador_id,
        'source', p_source,
        'reason', btrim(p_reason)
      )::text,
      'UTF8'
    ),
    'sha256'
  );

  INSERT INTO private.operation_idempotency (
    operation_scope, idempotency_key, customer_id, operation_type,
    payload_hash, actor_id, lease_expires_at
  )
  VALUES (
    'customer_ambassador_assignment', p_idempotency_key, p_customer_id,
    'assign_customer_ambassador', v_payload_hash, v_actor,
    now() + interval '5 minutes'
  )
  ON CONFLICT (operation_scope, idempotency_key) DO NOTHING;

  SELECT *
  INTO v_idempotency
  FROM private.operation_idempotency
  WHERE operation_scope = 'customer_ambassador_assignment'
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF v_idempotency.payload_hash IS DISTINCT FROM v_payload_hash
     OR v_idempotency.customer_id IS DISTINCT FROM p_customer_id THEN
    INSERT INTO private.phase1_audit_events (
      actor_id, event_type, entity_type, entity_id, outcome_code, metadata
    )
    VALUES (
      v_actor, 'idempotency_conflict', 'operation_idempotency',
      v_idempotency.id, 'idempotency_conflict',
      jsonb_build_object(
        'operation_scope', 'customer_ambassador_assignment',
        'operation_type', 'assign_customer_ambassador',
        'idempotency_key', p_idempotency_key
      )
    );
    RETURN jsonb_build_object(
      'status', 'idempotency_conflict',
      'operation_id', v_idempotency.id
    );
  END IF;

  IF v_idempotency.status = 'completed' THEN
    RETURN v_idempotency.original_result || jsonb_build_object('replayed', true);
  END IF;

  SELECT *
  INTO v_customer
  FROM public.clientes
  WHERE id = p_customer_id
  FOR UPDATE;

  IF v_customer.id IS NULL OR v_customer.lifecycle_status <> 'active' THEN
    RAISE EXCEPTION 'customer_not_found_or_inactive' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_ambassador
  FROM public.ambassadors
  WHERE id = p_ambassador_id
    AND status = 'ativo'
    AND lifecycle_status = 'active'
  FOR SHARE;

  IF v_ambassador.id IS NULL THEN
    RAISE EXCEPTION 'ambassador_not_found_or_inactive' USING ERRCODE = 'P0002';
  END IF;

  IF (
    v_customer.person_id IS NOT NULL
    AND v_ambassador.person_id IS NOT NULL
    AND v_customer.person_id = v_ambassador.person_id
  ) OR (
    v_customer.cpf IS NOT NULL
    AND regexp_replace(v_customer.cpf, '[^0-9]', '', 'g') <> ''
    AND regexp_replace(v_customer.cpf, '[^0-9]', '', 'g')
      = regexp_replace(coalesce(v_ambassador.cpf, ''), '[^0-9]', '', 'g')
  ) THEN
    INSERT INTO private.phase1_audit_events (
      actor_id, event_type, entity_type, entity_id, outcome_code, metadata
    )
    VALUES (
      v_actor, 'customer_ambassador_assignment_rejected', 'customer',
      p_customer_id, 'self_referral_forbidden',
      jsonb_build_object(
        'operation_scope', 'customer_ambassador_assignment',
        'operation_type', 'assign_customer_ambassador',
        'idempotency_key', p_idempotency_key
      )
    );

    UPDATE private.operation_idempotency
    SET status = 'completed',
        original_result = jsonb_build_object(
          'status', 'rejected',
          'code', 'self_referral_forbidden'
        ),
        processed_at = now(),
        lease_expires_at = NULL,
        updated_at = now()
    WHERE id = v_idempotency.id;

    RETURN jsonb_build_object(
      'status', 'rejected',
      'code', 'self_referral_forbidden'
    );
  END IF;

  SELECT *
  INTO v_current
  FROM private.customer_ambassador_assignments
  WHERE customer_id = p_customer_id AND status = 'active'
  FOR UPDATE;

  IF v_current.id IS NOT NULL AND v_current.ambassador_id = p_ambassador_id THEN
    UPDATE private.operation_idempotency
    SET status = 'completed',
        original_result = jsonb_build_object(
          'status', 'assigned',
          'entity_id', v_current.id
        ),
        processed_at = now(),
        lease_expires_at = NULL,
        updated_at = now()
    WHERE id = v_idempotency.id;

    RETURN jsonb_build_object(
      'status', 'assigned',
      'assignment_id', v_current.id,
      'reused', true
    );
  END IF;

  IF v_current.id IS NOT NULL THEN
    IF length(btrim(p_reason)) < 5 THEN
      RAISE EXCEPTION 'reassignment_reason_too_short' USING ERRCODE = '22023';
    END IF;

    UPDATE private.customer_ambassador_assignments
    SET status = 'ended',
        valid_until = now(),
        ended_by = v_actor,
        updated_at = now()
    WHERE id = v_current.id;
  END IF;

  INSERT INTO private.customer_ambassador_assignments (
    customer_id, ambassador_id, status, is_validated, is_commissionable,
    source, evidence_code, assigned_by, reason, idempotency_record_id
  )
  VALUES (
    p_customer_id, p_ambassador_id, 'active', true, true,
    p_source, 'individual_admin_validation', v_actor, btrim(p_reason),
    v_idempotency.id
  )
  RETURNING id INTO v_assignment_id;

  PERFORM set_config('bryza.canonical_referral_write', 'true', true);

  UPDATE public.clientes
  SET commissionable_ambassador_id = p_ambassador_id,
      current_referral_assignment_id = v_assignment_id,
      ambassador_id = p_ambassador_id,
      referral_code = v_ambassador.referral_code,
      referral_source = p_source,
      referral_attributed_at = now(),
      referral_locked_at = now()
  WHERE id = p_customer_id;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  )
  VALUES (
    v_actor,
    CASE WHEN v_current.id IS NULL
      THEN 'customer_ambassador_assigned'
      ELSE 'customer_ambassador_reassigned'
    END,
    'customer_ambassador_assignment',
    v_assignment_id,
    'assigned',
    jsonb_build_object(
      'operation_scope', 'customer_ambassador_assignment',
      'operation_type', 'assign_customer_ambassador',
      'idempotency_key', p_idempotency_key
    )
  );

  UPDATE private.operation_idempotency
  SET status = 'completed',
      original_result = jsonb_build_object(
        'status', 'assigned',
        'entity_id', v_assignment_id
      ),
      processed_at = now(),
      lease_expires_at = NULL,
      updated_at = now()
  WHERE id = v_idempotency.id;

  RETURN jsonb_build_object(
    'status', 'assigned',
    'assignment_id', v_assignment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_assign_customer_ambassador(
  uuid, uuid, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_assign_customer_ambassador(
  uuid, uuid, text, text, uuid
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_get_customer_referral_summary(
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_result jsonb;
BEGIN
  SELECT actor_id, actor_role
  INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin', 'vendedor']);

  SELECT jsonb_build_object(
    'status', 'ok',
    'assignment_id', ca.id,
    'ambassador_id', a.id,
    'ambassador_name', a.full_name,
    'referral_code', a.referral_code,
    'source', ca.source,
    'assigned_at', ca.valid_from,
    'assignment_status', ca.status,
    'is_validated', ca.is_validated,
    'is_commissionable', ca.is_commissionable,
    'customer_is_ambassador', own_a.id IS NOT NULL,
    'customer_ambassador_id', own_a.id,
    'customer_ambassador_status', own_a.status
  )
  INTO v_result
  FROM public.clientes c
  LEFT JOIN private.customer_ambassador_assignments ca
    ON ca.id = c.current_referral_assignment_id
   AND ca.status = 'active'
  LEFT JOIN public.ambassadors a ON a.id = ca.ambassador_id
  LEFT JOIN public.ambassadors own_a
    ON own_a.person_id = c.person_id
   AND own_a.lifecycle_status = 'active'
  WHERE c.id = p_customer_id
    AND (
      v_role = 'admin'
      OR c.vendedor_responsavel_id = v_actor
    );

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_customer_referral_summary(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_customer_referral_summary(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_search_active_ambassadors(
  p_query text
)
RETURNS TABLE(
  id uuid,
  full_name text,
  display_name text,
  username text,
  referral_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_query text := btrim(coalesce(p_query, ''));
BEGIN
  SELECT actor_id, actor_role
  INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  RETURN QUERY
  SELECT a.id, a.full_name, a.display_name, a.username, a.referral_code
  FROM public.ambassadors a
  WHERE a.status = 'ativo'
    AND a.lifecycle_status = 'active'
    AND (
      v_query = ''
      OR a.full_name ILIKE '%' || v_query || '%'
      OR coalesce(a.display_name, '') ILIKE '%' || v_query || '%'
      OR a.referral_code ILIKE '%' || v_query || '%'
      OR a.username ILIKE '%' || v_query || '%'
    )
  ORDER BY a.full_name
  LIMIT 30;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_search_active_ambassadors(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_search_active_ambassadors(text)
  TO authenticated;

DO $$
DECLARE
  v_table text;
  v_trigger text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'person_business_roles',
    'person_access_permissions',
    'customer_ambassador_assignments',
    'legacy_referral_link_archive'
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

    v_trigger := 'trg_no_delete_' || v_table;
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = v_trigger
        AND tgrelid = format('private.%I', v_table)::regclass
        AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE DELETE ON private.%I '
        'FOR EACH ROW EXECUTE FUNCTION private.prevent_phase1_history_delete()',
        v_trigger, v_table
      );
    END IF;
  END LOOP;
END
$$;

COMMENT ON COLUMN public.clientes.commissionable_ambassador_id IS
  'Read-through pointer to the validated active assignment. Legacy ambassador_id is never an autonomous commission source.';
COMMENT ON TABLE private.customer_ambassador_assignments IS
  'Official historical source for validated, commissionable customer referral assignments.';
COMMENT ON TABLE private.person_business_roles IS
  'Business roles (customer/ambassador), separate from authenticated access permissions.';
COMMENT ON TABLE private.person_access_permissions IS
  'Access permissions, separate from customer/ambassador business roles and compatible with the legacy profiles.role field.';

CREATE OR REPLACE FUNCTION public.fn_upsert_customer_canonical(
  p_customer_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_cpf text,
  p_cep text,
  p_address text,
  p_number text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_origin text,
  p_customer_status text,
  p_commercial_profile_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_ambassador_id uuid,
  p_assignment_reason text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_customer public.clientes%ROWTYPE;
  v_person_id uuid;
  v_existing_customer_id uuid;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g'), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_phone_fp bytea;
  v_cpf_fp bytea;
  v_email_fp bytea;
  v_candidate_ids uuid[];
  v_candidate_count integer := 0;
  v_cpf_candidate uuid;
  v_review_fp bytea;
  v_review_id uuid;
  v_operation_id uuid;
  v_payload_hash bytea;
  v_stored private.operation_idempotency%ROWTYPE;
  v_result jsonb;
  v_created boolean := false;
  v_assignment_result jsonb;
  v_old_commercial_profile_id uuid;
BEGIN
  SELECT actor_id, actor_role
  INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin', 'vendedor']);

  IF p_idempotency_key IS NULL
     OR length(btrim(coalesce(p_full_name, ''))) NOT BETWEEN 2 AND 200
     OR v_phone !~ '^[0-9]{10,15}$'
     OR (v_cpf IS NOT NULL AND v_cpf !~ '^[0-9]{11}$')
     OR (v_email IS NOT NULL AND (
       length(v_email) NOT BETWEEN 3 AND 254 OR position('@' IN v_email) <= 1
     ))
     OR p_customer_status NOT IN ('lead', 'cliente', 'recorrente', 'inativo')
     OR length(btrim(coalesce(p_origin, ''))) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid_customer_payload' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'vendedor' THEN
    IF p_ambassador_id IS NOT NULL THEN
      RAISE EXCEPTION 'seller_cannot_assign_ambassador' USING ERRCODE = '42501';
    END IF;
    p_commercial_profile_id := v_actor;
  END IF;

  IF p_commercial_profile_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_commercial_profile_id
      AND p.ativo
      AND p.role::text IN ('admin', 'vendedor')
  ) THEN
    RAISE EXCEPTION 'invalid_commercial_profile' USING ERRCODE = '22023';
  END IF;

  v_payload_hash := extensions.digest(
    convert_to(
      jsonb_build_object(
        'customer_id', p_customer_id,
        'full_name', btrim(p_full_name),
        'phone', v_phone,
        'email', v_email,
        'cpf', v_cpf,
        'cep', p_cep,
        'address', p_address,
        'number', p_number,
        'neighborhood', p_neighborhood,
        'city', p_city,
        'state', upper(btrim(coalesce(p_state, ''))),
        'origin', p_origin,
        'customer_status', p_customer_status,
        'commercial_profile_id', p_commercial_profile_id,
        'latitude', p_latitude,
        'longitude', p_longitude,
        'ambassador_id', p_ambassador_id,
        'assignment_reason', p_assignment_reason
      )::text,
      'UTF8'
    ),
    'sha256'
  );

  INSERT INTO private.operation_idempotency (
    operation_scope, idempotency_key, customer_id, operation_type,
    payload_hash, actor_id, lease_expires_at
  )
  VALUES (
    'canonical_customer_write', p_idempotency_key, p_customer_id,
    CASE WHEN p_customer_id IS NULL THEN 'create_customer' ELSE 'update_customer' END,
    v_payload_hash, v_actor, now() + interval '5 minutes'
  )
  ON CONFLICT (operation_scope, idempotency_key) DO NOTHING;

  SELECT *
  INTO v_stored
  FROM private.operation_idempotency
  WHERE operation_scope = 'canonical_customer_write'
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  v_operation_id := v_stored.id;

  IF v_stored.payload_hash IS DISTINCT FROM v_payload_hash
     OR v_stored.customer_id IS DISTINCT FROM p_customer_id THEN
    INSERT INTO private.phase1_audit_events (
      actor_id, event_type, entity_type, entity_id, outcome_code, metadata
    )
    VALUES (
      v_actor, 'idempotency_conflict', 'operation_idempotency',
      v_stored.id, 'idempotency_conflict',
      jsonb_build_object(
        'operation_scope', 'canonical_customer_write',
        'operation_type', CASE WHEN p_customer_id IS NULL
          THEN 'create_customer' ELSE 'update_customer' END,
        'idempotency_key', p_idempotency_key
      )
    );
    RETURN jsonb_build_object(
      'status', 'idempotency_conflict',
      'operation_id', v_stored.id
    );
  END IF;

  IF v_stored.status = 'completed' THEN
    RETURN v_stored.original_result || jsonb_build_object('replayed', true);
  END IF;

  IF p_customer_id IS NOT NULL THEN
    SELECT * INTO v_customer
    FROM public.clientes
    WHERE id = p_customer_id
    FOR UPDATE;

    IF v_customer.id IS NULL OR v_customer.lifecycle_status = 'archived' THEN
      RAISE EXCEPTION 'customer_not_found_or_archived' USING ERRCODE = 'P0002';
    END IF;

    IF v_role = 'vendedor' AND v_customer.vendedor_responsavel_id <> v_actor THEN
      RAISE EXCEPTION 'seller_customer_access_denied' USING ERRCODE = '42501';
    END IF;

    v_person_id := v_customer.person_id;
    v_old_commercial_profile_id := v_customer.vendedor_responsavel_id;
  END IF;

  v_phone_fp := private.identity_hmac_internal('phone', v_phone, 1);
  IF v_cpf IS NOT NULL THEN
    v_cpf_fp := private.identity_hmac_internal('cpf', v_cpf, 1);
  END IF;
  IF v_email IS NOT NULL THEN
    v_email_fp := private.identity_hmac_internal('email', v_email, 1);
  END IF;

  SELECT coalesce(array_agg(DISTINCT person_id ORDER BY person_id), '{}'::uuid[])
  INTO v_candidate_ids
  FROM private.person_identity_fingerprints
  WHERE is_active
    AND (
      (identifier_type = 'phone' AND fingerprint = v_phone_fp)
      OR (v_cpf_fp IS NOT NULL AND identifier_type = 'cpf' AND fingerprint = v_cpf_fp)
      OR (v_email_fp IS NOT NULL AND identifier_type = 'email' AND fingerprint = v_email_fp)
    );

  v_candidate_count := cardinality(v_candidate_ids);

  IF v_cpf_fp IS NOT NULL THEN
    SELECT person_id INTO v_cpf_candidate
    FROM private.person_identity_fingerprints
    WHERE identifier_type = 'cpf'
      AND fingerprint = v_cpf_fp
      AND is_active
    LIMIT 1;
  END IF;

  IF v_candidate_count > 1
     OR (
       v_person_id IS NOT NULL
       AND v_candidate_count > 0
       AND NOT (v_person_id = ANY(v_candidate_ids))
     )
     OR (
       p_customer_id IS NULL
       AND v_candidate_count = 1
       AND v_cpf_candidate IS NULL
     ) THEN
    v_review_fp := private.identity_hmac_internal(
      'review',
      encode(v_phone_fp, 'hex') || ':' ||
      coalesce(encode(v_cpf_fp, 'hex'), '') || ':' ||
      coalesce(encode(v_email_fp, 'hex'), ''),
      1
    );

    v_review_id := private.persist_identity_review_internal(
      v_actor,
      v_review_fp,
      ARRAY[
        CASE WHEN v_candidate_count > 1
          THEN 'identifiers_point_to_different_people'
          ELSE 'unverified_identifier_matches_existing_person'
        END
      ],
      'canonical_customer_write',
      v_candidate_ids,
      'customer',
      p_customer_id
    );

    v_result := jsonb_build_object(
      'status', 'manual_review_required',
      'review_id', v_review_id
    );

    UPDATE private.operation_idempotency
    SET status = 'completed',
        original_result = v_result,
        processed_at = now(),
        lease_expires_at = NULL,
        updated_at = now()
    WHERE id = v_operation_id;

    RETURN v_result;
  END IF;

  IF v_person_id IS NULL AND v_candidate_count = 1 THEN
    v_person_id := v_candidate_ids[1];
  END IF;

  IF p_customer_id IS NULL AND v_person_id IS NOT NULL THEN
    SELECT source_entity_id
    INTO v_existing_customer_id
    FROM private.person_business_roles
    WHERE person_id = v_person_id
      AND role_type = 'customer'
      AND status <> 'archived'
    LIMIT 1;

    IF v_existing_customer_id IS NOT NULL THEN
      v_result := jsonb_build_object(
        'status', 'existing_customer',
        'entity_id', v_existing_customer_id
      );

      UPDATE private.operation_idempotency
      SET status = 'completed',
          original_result = v_result,
          processed_at = now(),
          lease_expires_at = NULL,
          updated_at = now()
      WHERE id = v_operation_id;

      RETURN v_result;
    END IF;
  END IF;

  IF v_person_id IS NULL THEN
    INSERT INTO private.persons (
      full_name, cpf_normalized, email_normalized, phone_normalized
    )
    VALUES (
      btrim(p_full_name), v_cpf, v_email, v_phone
    )
    RETURNING id INTO v_person_id;
  ELSE
    UPDATE private.persons
    SET full_name = btrim(p_full_name),
        cpf_normalized = v_cpf,
        email_normalized = v_email,
        phone_normalized = v_phone,
        identity_version = identity_version + 1,
        updated_at = now()
    WHERE id = v_person_id;
  END IF;

  UPDATE private.person_identity_fingerprints
  SET is_active = false,
      deactivated_at = now()
  WHERE person_id = v_person_id
    AND is_active
    AND (
      (identifier_type = 'phone' AND fingerprint <> v_phone_fp)
      OR (identifier_type = 'cpf' AND (
        v_cpf_fp IS NULL OR fingerprint <> v_cpf_fp
      ))
      OR (identifier_type = 'email' AND (
        v_email_fp IS NULL OR fingerprint <> v_email_fp
      ))
    );

  INSERT INTO private.person_identity_fingerprints (
    person_id, identifier_type, fingerprint, key_version, is_primary, is_active
  )
  VALUES (v_person_id, 'phone', v_phone_fp, 1, true, true)
  ON CONFLICT (identifier_type, fingerprint) WHERE is_active
  DO NOTHING;

  IF v_cpf_fp IS NOT NULL THEN
    INSERT INTO private.person_identity_fingerprints (
      person_id, identifier_type, fingerprint, key_version, is_primary, is_active
    )
    VALUES (v_person_id, 'cpf', v_cpf_fp, 1, true, true)
    ON CONFLICT (identifier_type, fingerprint) WHERE is_active
    DO NOTHING;
  END IF;

  IF v_email_fp IS NOT NULL THEN
    INSERT INTO private.person_identity_fingerprints (
      person_id, identifier_type, fingerprint, key_version, is_primary, is_active
    )
    VALUES (v_person_id, 'email', v_email_fp, 1, true, true)
    ON CONFLICT (identifier_type, fingerprint) WHERE is_active
    DO NOTHING;
  END IF;

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);

  IF p_customer_id IS NULL THEN
    INSERT INTO public.clientes (
      nome, telefone, cpf, cep, endereco, numero, bairro, cidade, estado,
      origem, status_cliente, vendedor_responsavel_id, latitude, longitude,
      person_id, lifecycle_status
    )
    VALUES (
      upper(btrim(p_full_name)), p_phone, v_cpf, coalesce(p_cep, ''),
      coalesce(p_address, ''), coalesce(p_number, ''), coalesce(p_neighborhood, ''),
      coalesce(p_city, ''), upper(btrim(coalesce(p_state, ''))),
      p_origin, p_customer_status::public.status_cliente,
      p_commercial_profile_id, p_latitude, p_longitude,
      v_person_id, 'active'
    )
    RETURNING * INTO v_customer;
    p_customer_id := v_customer.id;
    v_created := true;
  ELSE
    UPDATE public.clientes
    SET nome = upper(btrim(p_full_name)),
        telefone = p_phone,
        cpf = v_cpf,
        cep = coalesce(p_cep, ''),
        endereco = coalesce(p_address, ''),
        numero = coalesce(p_number, ''),
        bairro = coalesce(p_neighborhood, ''),
        cidade = coalesce(p_city, ''),
        estado = upper(btrim(coalesce(p_state, ''))),
        origem = p_origin,
        status_cliente = p_customer_status::public.status_cliente,
        vendedor_responsavel_id = p_commercial_profile_id,
        latitude = p_latitude,
        longitude = p_longitude,
        person_id = v_person_id
    WHERE id = p_customer_id
    RETURNING * INTO v_customer;
  END IF;

  INSERT INTO private.person_business_roles (
    person_id, role_type, source_entity_id, status, activated_at
  )
  VALUES (
    v_person_id, 'customer', p_customer_id, 'active', now()
  )
  ON CONFLICT (role_type, source_entity_id)
  DO UPDATE SET
    person_id = EXCLUDED.person_id,
    status = 'active',
    activated_at = coalesce(
      private.person_business_roles.activated_at,
      EXCLUDED.activated_at
    ),
    inactivated_at = NULL,
    updated_at = now();

  IF v_created OR v_old_commercial_profile_id IS DISTINCT FROM p_commercial_profile_id THEN
    UPDATE private.customer_commercial_assignments
    SET valid_until = now()
    WHERE customer_id = p_customer_id AND valid_until IS NULL;

    INSERT INTO private.customer_commercial_assignments (
      customer_id, commercial_profile_id, source, reason, assigned_by
    )
    VALUES (
      p_customer_id,
      p_commercial_profile_id,
      CASE WHEN v_created THEN 'canonical_customer_create' ELSE 'canonical_customer_update' END,
      CASE WHEN v_created THEN 'Responsável comercial no cadastro'
        ELSE 'Alteração auditada do responsável comercial' END,
      v_actor
    );
  END IF;

  IF p_ambassador_id IS NOT NULL THEN
    v_assignment_result := public.fn_assign_customer_ambassador(
      p_customer_id,
      p_ambassador_id,
      'admin_selection',
      coalesce(nullif(btrim(p_assignment_reason), ''), 'Indicação validada no cadastro'),
      extensions.gen_random_uuid()
    );

    IF v_assignment_result->>'status' NOT IN ('assigned') THEN
      RAISE EXCEPTION 'ambassador_assignment_failed:%', v_assignment_result->>'status'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'status', CASE WHEN v_created THEN 'created' ELSE 'updated' END,
    'entity_id', p_customer_id
  );

  UPDATE private.operation_idempotency
  SET customer_id = p_customer_id,
      status = 'completed',
      original_result = v_result,
      processed_at = now(),
      lease_expires_at = NULL,
      updated_at = now()
  WHERE id = v_operation_id;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  )
  VALUES (
    v_actor,
    CASE WHEN v_created THEN 'canonical_customer_created' ELSE 'canonical_customer_updated' END,
    'customer',
    p_customer_id,
    CASE WHEN v_created THEN 'created' ELSE 'updated' END,
    jsonb_build_object(
      'operation_scope', 'canonical_customer_write',
      'operation_type', CASE WHEN v_created THEN 'create_customer' ELSE 'update_customer' END,
      'idempotency_key', p_idempotency_key
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_upsert_customer_canonical(
  uuid, text, text, text, text, text, text, text, text, text, text,
  text, text, uuid, double precision, double precision, uuid, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_upsert_customer_canonical(
  uuid, text, text, text, text, text, text, text, text, text, text,
  text, text, uuid, double precision, double precision, uuid, text, uuid
) TO authenticated;
