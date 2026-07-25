-- Operational completion for canonical customer/ambassador identity.
-- Additive only: no historical order rewrite and no legacy referral validation.

CREATE TABLE IF NOT EXISTS private.ambassador_entry_campaigns (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  code text NOT NULL UNIQUE
    CHECK (code ~ '^[a-z0-9][a-z0-9_-]{2,79}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 3 AND 120),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  waive_purchase_minimum boolean NOT NULL DEFAULT false,
  eligibility_label text NOT NULL
    CHECK (length(btrim(eligibility_label)) BETWEEN 3 AND 120),
  terms_version text NOT NULL
    CHECK (length(btrim(terms_version)) BETWEEN 1 AND 80),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 500),
  source text NOT NULL CHECK (length(btrim(source)) BETWEEN 3 AND 80),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  deactivated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (
    (status IN ('inactive', 'archived') AND deactivated_at IS NOT NULL)
    OR (status IN ('draft', 'active') AND deactivated_at IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ambassador_entry_campaign_single_active
  ON private.ambassador_entry_campaigns(status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ambassador_entry_campaign_period
  ON private.ambassador_entry_campaigns(starts_at, ends_at);

CREATE TABLE IF NOT EXISTS private.ambassador_invitation_eligibilities (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  person_id uuid NOT NULL
    REFERENCES private.persons(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL
    REFERENCES public.clientes(id) ON DELETE RESTRICT,
  campaign_id uuid
    REFERENCES private.ambassador_entry_campaigns(id) ON DELETE RESTRICT,
  eligibility_type text NOT NULL
    CHECK (eligibility_type IN ('founder_customer', 'individual_admin')),
  eligibility_label text NOT NULL
    CHECK (length(btrim(eligibility_label)) BETWEEN 3 AND 120),
  status text NOT NULL DEFAULT 'eligible'
    CHECK (status IN ('eligible', 'consumed', 'revoked')),
  source text NOT NULL CHECK (length(btrim(source)) BETWEEN 3 AND 80),
  evidence_code text NOT NULL
    CHECK (evidence_code ~ '^[a-z0-9_:-]{3,100}$'),
  marked_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  eligible_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'eligible' AND consumed_at IS NULL AND revoked_at IS NULL)
    OR (status = 'consumed' AND consumed_at IS NOT NULL AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ambassador_invitation_person_eligible
  ON private.ambassador_invitation_eligibilities(person_id)
  WHERE status = 'eligible';

CREATE INDEX IF NOT EXISTS idx_ambassador_invitation_eligibility_customer
  ON private.ambassador_invitation_eligibilities(customer_id, status);

ALTER TABLE private.ambassador_program_invitations
  ADD COLUMN IF NOT EXISTS eligibility_id uuid,
  ADD COLUMN IF NOT EXISTS campaign_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ambassador_program_invitations_eligibility_id_fkey'
      AND conrelid = 'private.ambassador_program_invitations'::regclass
  ) THEN
    ALTER TABLE private.ambassador_program_invitations
      ADD CONSTRAINT ambassador_program_invitations_eligibility_id_fkey
      FOREIGN KEY (eligibility_id)
      REFERENCES private.ambassador_invitation_eligibilities(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ambassador_program_invitations_campaign_id_fkey'
      AND conrelid = 'private.ambassador_program_invitations'::regclass
  ) THEN
    ALTER TABLE private.ambassador_program_invitations
      ADD CONSTRAINT ambassador_program_invitations_campaign_id_fkey
      FOREIGN KEY (campaign_id)
      REFERENCES private.ambassador_entry_campaigns(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END
$$;

ALTER TABLE private.ambassador_program_exceptions
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'administrative_exception';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ambassador_program_exceptions_campaign_id_fkey'
      AND conrelid = 'private.ambassador_program_exceptions'::regclass
  ) THEN
    ALTER TABLE private.ambassador_program_exceptions
      ADD CONSTRAINT ambassador_program_exceptions_campaign_id_fkey
      FOREIGN KEY (campaign_id)
      REFERENCES private.ambassador_entry_campaigns(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ambassador_campaign_qualification_exception
  ON private.ambassador_program_exceptions(
    ambassador_id, campaign_id, rule_code
  )
  WHERE campaign_id IS NOT NULL AND revoked_at IS NULL;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS ambassador_name_snapshot text,
  ADD COLUMN IF NOT EXISTS commission_levels_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS qualification_snapshot jsonb;

COMMENT ON COLUMN public.pedidos.ambassador_name_snapshot IS
  'Frozen display name of the officially assigned ambassador at order creation.';
COMMENT ON COLUMN public.pedidos.commission_levels_snapshot IS
  'Frozen enabled commission-plan levels at order creation.';
COMMENT ON COLUMN public.pedidos.qualification_snapshot IS
  'Frozen qualification status and rule evidence used at order creation.';

ALTER TABLE private.phase1_audit_events
  DROP CONSTRAINT IF EXISTS phase1_audit_events_metadata_check1;

ALTER TABLE private.phase1_audit_events
  ADD CONSTRAINT phase1_audit_events_metadata_check1
  CHECK (
    (
      metadata - ARRAY[
        'operation_scope',
        'operation_type',
        'conflict_types',
        'idempotency_key',
        'attempt_count',
        'actor_type',
        'customer_id',
        'auth_user_id',
        'ambassador_id',
        'invitation_id',
        'official_assignment_id',
        'terms_version',
        'expires_at',
        'valid_until',
        'resolution_code',
        'campaign_id',
        'eligibility_id',
        'eligible_count',
        'skipped_conflict_count',
        'skipped_without_identity_count',
        'skipped_ambassador_count'
      ]
    ) = '{}'::jsonb
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.fn_admin_save_founder_campaign(
  p_campaign_id uuid,
  p_code text,
  p_name text,
  p_status text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_waive_purchase_minimum boolean,
  p_eligibility_label text,
  p_terms_version text,
  p_reason text,
  p_source text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_campaign_id uuid;
BEGIN
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  IF p_code !~ '^[a-z0-9][a-z0-9_-]{2,79}$'
     OR length(btrim(coalesce(p_name, ''))) < 3
     OR p_status NOT IN ('draft', 'active', 'inactive')
     OR p_starts_at IS NULL
     OR p_ends_at IS NULL
     OR p_ends_at <= p_starts_at
     OR length(btrim(coalesce(p_eligibility_label, ''))) < 3
     OR length(btrim(coalesce(p_terms_version, ''))) < 1
     OR length(btrim(coalesce(p_reason, ''))) < 5
     OR length(btrim(coalesce(p_source, ''))) < 3 THEN
    RAISE EXCEPTION 'invalid_founder_campaign' USING ERRCODE = '22023';
  END IF;

  IF p_status = 'active' AND EXISTS (
    SELECT 1
    FROM private.ambassador_entry_campaigns
    WHERE status = 'active'
      AND id IS DISTINCT FROM p_campaign_id
  ) THEN
    RETURN jsonb_build_object(
      'status', 'active_campaign_exists'
    );
  END IF;

  IF p_campaign_id IS NULL THEN
    INSERT INTO private.ambassador_entry_campaigns (
      code, name, status, starts_at, ends_at,
      waive_purchase_minimum, eligibility_label, terms_version,
      reason, source, created_by, updated_by,
      deactivated_by, deactivated_at
    ) VALUES (
      p_code, btrim(p_name), p_status, p_starts_at, p_ends_at,
      coalesce(p_waive_purchase_minimum, false),
      btrim(p_eligibility_label), btrim(p_terms_version),
      btrim(p_reason), btrim(p_source), v_actor, v_actor,
      CASE WHEN p_status = 'inactive' THEN v_actor END,
      CASE WHEN p_status = 'inactive' THEN now() END
    )
    RETURNING id INTO v_campaign_id;
  ELSE
    UPDATE private.ambassador_entry_campaigns
    SET code = p_code,
        name = btrim(p_name),
        status = p_status,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        waive_purchase_minimum = coalesce(p_waive_purchase_minimum, false),
        eligibility_label = btrim(p_eligibility_label),
        terms_version = btrim(p_terms_version),
        reason = btrim(p_reason),
        source = btrim(p_source),
        updated_by = v_actor,
        deactivated_by = CASE
          WHEN p_status = 'inactive' THEN v_actor
          ELSE NULL
        END,
        deactivated_at = CASE
          WHEN p_status = 'inactive' THEN coalesce(deactivated_at, now())
          ELSE NULL
        END,
        updated_at = now()
    WHERE id = p_campaign_id
      AND status <> 'archived'
    RETURNING id INTO v_campaign_id;

    IF v_campaign_id IS NULL THEN
      RETURN jsonb_build_object('status', 'campaign_not_found');
    END IF;
  END IF;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  ) VALUES (
    v_actor, 'ambassador_entry_campaign_saved',
    'ambassador_entry_campaign', v_campaign_id, p_status,
    jsonb_build_object('campaign_id', v_campaign_id)
  );

  RETURN jsonb_build_object(
    'status', 'saved',
    'campaign_id', v_campaign_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_save_founder_campaign(
  uuid, text, text, text, timestamptz, timestamptz,
  boolean, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_save_founder_campaign(
  uuid, text, text, text, timestamptz, timestamptz,
  boolean, text, text, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_mark_founder_customers_eligible(
  p_campaign_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_label text := 'Elegível para convite — Cliente fundador';
  v_eligible_count integer := 0;
  v_conflict_count integer := 0;
  v_without_identity_count integer := 0;
  v_ambassador_count integer := 0;
BEGIN
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  IF p_campaign_id IS NOT NULL THEN
    SELECT eligibility_label INTO v_label
    FROM private.ambassador_entry_campaigns
    WHERE id = p_campaign_id
      AND status <> 'archived';

    IF v_label IS NULL THEN
      RETURN jsonb_build_object('status', 'campaign_not_found');
    END IF;
  END IF;

  SELECT count(*) INTO v_without_identity_count
  FROM public.clientes c
  WHERE c.lifecycle_status = 'active'
    AND c.person_id IS NULL;

  SELECT count(*) INTO v_ambassador_count
  FROM public.clientes c
  WHERE c.lifecycle_status = 'active'
    AND c.person_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.ambassadors a
      WHERE a.person_id = c.person_id
        AND a.lifecycle_status = 'active'
    );

  SELECT count(DISTINCT c.id) INTO v_conflict_count
  FROM public.clientes c
  WHERE c.lifecycle_status = 'active'
    AND c.person_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM private.identity_conflict_reviews r
      WHERE r.status = 'open'
        AND (
          r.source_entity_id = c.id
          OR c.person_id = ANY(r.candidate_person_ids)
        )
    );

  INSERT INTO private.ambassador_invitation_eligibilities (
    person_id, customer_id, campaign_id, eligibility_type,
    eligibility_label, status, source, evidence_code, marked_by
  )
  SELECT
    c.person_id,
    c.id,
    p_campaign_id,
    'founder_customer',
    v_label,
    'eligible',
    'founder_customer_bulk_admin',
    'existing_customer_verified_identity',
    v_actor
  FROM public.clientes c
  WHERE c.lifecycle_status = 'active'
    AND c.person_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.ambassadors a
      WHERE a.person_id = c.person_id
        AND a.lifecycle_status = 'active'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM private.identity_conflict_reviews r
      WHERE r.status = 'open'
        AND (
          r.source_entity_id = c.id
          OR c.person_id = ANY(r.candidate_person_ids)
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM private.ambassador_invitation_eligibilities e
      WHERE e.person_id = c.person_id
        AND e.status = 'eligible'
    );

  GET DIAGNOSTICS v_eligible_count = ROW_COUNT;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  ) VALUES (
    v_actor, 'founder_customers_marked_invitation_eligible',
    'ambassador_invitation_eligibility', p_campaign_id, 'completed',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'eligible_count', v_eligible_count,
      'skipped_conflict_count', v_conflict_count,
      'skipped_without_identity_count', v_without_identity_count,
      'skipped_ambassador_count', v_ambassador_count
    )
  );

  RETURN jsonb_build_object(
    'status', 'completed',
    'eligible_count', v_eligible_count,
    'skipped_conflict_count', v_conflict_count,
    'skipped_without_identity_count', v_without_identity_count,
    'skipped_ambassador_count', v_ambassador_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_mark_founder_customers_eligible(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_mark_founder_customers_eligible(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_get_invitation_operations()
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
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  SELECT jsonb_build_object(
    'eligible_count', (
      SELECT count(*)
      FROM private.ambassador_invitation_eligibilities
      WHERE status = 'eligible'
    ),
    'founder_eligible_count', (
      SELECT count(*)
      FROM private.ambassador_invitation_eligibilities
      WHERE status = 'eligible'
        AND eligibility_type = 'founder_customer'
    ),
    'pending_invitation_count', (
      SELECT count(*)
      FROM private.ambassador_program_invitations
      WHERE status = 'pending' AND expires_at > now()
    ),
    'accepted_invitation_count', (
      SELECT count(*)
      FROM private.ambassador_program_invitations
      WHERE status = 'accepted'
    ),
    'campaigns', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'code', c.code,
          'name', c.name,
          'status', c.status,
          'starts_at', c.starts_at,
          'ends_at', c.ends_at,
          'waive_purchase_minimum', c.waive_purchase_minimum,
          'eligibility_label', c.eligibility_label,
          'terms_version', c.terms_version,
          'reason', c.reason,
          'source', c.source
        )
        ORDER BY c.created_at DESC
      )
      FROM private.ambassador_entry_campaigns c
      WHERE c.status <> 'archived'
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_get_invitation_operations()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_get_invitation_operations()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_get_customer_program_status(
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
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  SELECT jsonb_build_object(
    'status', 'ok',
    'eligible', e.id IS NOT NULL AND e.status = 'eligible',
    'eligibility_id', e.id,
    'eligibility_label', e.eligibility_label,
    'eligibility_type', e.eligibility_type,
    'campaign_id', camp.id,
    'campaign_name', camp.name,
    'campaign_waives_purchase_minimum', coalesce(camp.waive_purchase_minimum, false),
    'invitation_status', inv.status,
    'invitation_expires_at', inv.expires_at,
    'is_ambassador', a.id IS NOT NULL,
    'ambassador_status', a.status
  )
  INTO v_result
  FROM public.clientes c
  LEFT JOIN LATERAL (
    SELECT *
    FROM private.ambassador_invitation_eligibilities e0
    WHERE e0.person_id = c.person_id
    ORDER BY (e0.status = 'eligible') DESC, e0.eligible_at DESC
    LIMIT 1
  ) e ON true
  LEFT JOIN private.ambassador_entry_campaigns camp
    ON camp.id = e.campaign_id
  LEFT JOIN LATERAL (
    SELECT *
    FROM private.ambassador_program_invitations i0
    WHERE i0.person_id = c.person_id
    ORDER BY i0.invited_at DESC
    LIMIT 1
  ) inv ON true
  LEFT JOIN public.ambassadors a
    ON a.person_id = c.person_id
   AND a.lifecycle_status = 'active'
  WHERE c.id = p_customer_id
    AND c.lifecycle_status = 'active';

  RETURN coalesce(
    v_result,
    jsonb_build_object('status', 'customer_not_found')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_get_customer_program_status(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_get_customer_program_status(uuid)
  TO authenticated;

DO $$
BEGIN
  IF to_regprocedure(
    'public.fn_admin_create_ambassador_invitation(uuid,text,uuid,timestamptz)'
  ) IS NOT NULL
  AND to_regprocedure(
    'public.fn_admin_create_ambassador_invitation_core(uuid,text,uuid,timestamptz)'
  ) IS NULL THEN
    ALTER FUNCTION public.fn_admin_create_ambassador_invitation(
      uuid, text, uuid, timestamptz
    ) RENAME TO fn_admin_create_ambassador_invitation_core;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.fn_admin_create_ambassador_invitation_core(
  uuid, text, uuid, timestamptz
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_create_ambassador_invitation(
  p_customer_id uuid,
  p_terms_version text,
  p_invitation_token uuid,
  p_expires_at timestamptz
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
  v_eligibility private.ambassador_invitation_eligibilities%ROWTYPE;
  v_campaign private.ambassador_entry_campaigns%ROWTYPE;
  v_result jsonb;
  v_invitation_id uuid;
BEGIN
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  SELECT * INTO v_customer
  FROM public.clientes
  WHERE id = p_customer_id
    AND lifecycle_status = 'active'
  FOR SHARE;

  IF v_customer.id IS NULL OR v_customer.person_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'customer_without_canonical_identity'
    );
  END IF;

  SELECT * INTO v_eligibility
  FROM private.ambassador_invitation_eligibilities
  WHERE person_id = v_customer.person_id
    AND status = 'eligible'
  ORDER BY eligible_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_eligibility.id IS NULL THEN
    INSERT INTO private.ambassador_invitation_eligibilities (
      person_id, customer_id, eligibility_type, eligibility_label,
      status, source, evidence_code, marked_by
    ) VALUES (
      v_customer.person_id, v_customer.id, 'individual_admin',
      'Elegível para convite — Liberação administrativa individual',
      'eligible', 'individual_admin_invitation',
      'admin_confirmed_customer_invitation', v_actor
    )
    RETURNING * INTO v_eligibility;
  END IF;

  IF v_eligibility.campaign_id IS NOT NULL THEN
    SELECT * INTO v_campaign
    FROM private.ambassador_entry_campaigns
    WHERE id = v_eligibility.campaign_id
      AND status = 'active'
      AND now() BETWEEN starts_at AND ends_at;
  ELSE
    SELECT * INTO v_campaign
    FROM private.ambassador_entry_campaigns
    WHERE status = 'active'
      AND now() BETWEEN starts_at AND ends_at
    ORDER BY starts_at DESC
    LIMIT 1;
  END IF;

  v_result := public.fn_admin_create_ambassador_invitation_core(
    p_customer_id,
    p_terms_version,
    p_invitation_token,
    p_expires_at
  );

  IF v_result->>'status' = 'created' THEN
    v_invitation_id := (v_result->>'invitation_id')::uuid;
    UPDATE private.ambassador_program_invitations
    SET eligibility_id = v_eligibility.id,
        campaign_id = v_campaign.id,
        updated_at = now()
    WHERE id = v_invitation_id;

    RETURN v_result || jsonb_build_object(
      'eligibility_id', v_eligibility.id,
      'eligibility_label', v_eligibility.eligibility_label,
      'campaign_id', v_campaign.id,
      'campaign_code', v_campaign.code
    );
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_create_ambassador_invitation(
  uuid, text, uuid, timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_create_ambassador_invitation(
  uuid, text, uuid, timestamptz
) TO authenticated;

DO $$
BEGIN
  IF to_regprocedure(
    'public.fn_accept_ambassador_invitation(uuid,text)'
  ) IS NOT NULL
  AND to_regprocedure(
    'public.fn_accept_ambassador_invitation_core(uuid,text)'
  ) IS NULL THEN
    ALTER FUNCTION public.fn_accept_ambassador_invitation(
      uuid, text
    ) RENAME TO fn_accept_ambassador_invitation_core;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.fn_accept_ambassador_invitation_core(uuid, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_accept_ambassador_invitation(
  p_invitation_token uuid,
  p_terms_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_token_fingerprint bytea;
  v_invitation private.ambassador_program_invitations%ROWTYPE;
  v_campaign private.ambassador_entry_campaigns%ROWTYPE;
  v_result jsonb;
  v_ambassador_id uuid;
  v_exception_id uuid;
BEGIN
  IF v_actor IS NULL OR p_invitation_token IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  v_token_fingerprint := private.identity_hmac_internal(
    'ambassador_invitation_token',
    p_invitation_token::text,
    1::smallint
  );

  SELECT * INTO v_invitation
  FROM private.ambassador_program_invitations
  WHERE token_fingerprint = v_token_fingerprint
  FOR SHARE;

  v_result := public.fn_accept_ambassador_invitation_core(
    p_invitation_token,
    p_terms_version
  );

  IF v_result->>'status' <> 'accepted' OR v_invitation.id IS NULL THEN
    RETURN v_result;
  END IF;

  UPDATE private.ambassador_invitation_eligibilities
  SET status = 'consumed',
      consumed_at = coalesce(consumed_at, now()),
      updated_at = now()
  WHERE id = v_invitation.eligibility_id
    AND status = 'eligible';

  v_ambassador_id := (v_result->>'ambassador_id')::uuid;

  SELECT * INTO v_campaign
  FROM private.ambassador_entry_campaigns
  WHERE id = v_invitation.campaign_id
    AND status = 'active'
    AND now() BETWEEN starts_at AND ends_at
    AND waive_purchase_minimum;

  IF v_campaign.id IS NOT NULL THEN
    INSERT INTO private.ambassador_program_exceptions (
      person_id, ambassador_id, rule_code, effect_type,
      reason, valid_from, valid_until, granted_by,
      campaign_id, source
    )
    SELECT
      a.person_id,
      a.id,
      'monthly_purchase_qualification',
      'allow',
      v_campaign.reason,
      greatest(v_campaign.starts_at, now()),
      v_campaign.ends_at,
      v_campaign.created_by,
      v_campaign.id,
      'founder_customer_campaign'
    FROM public.ambassadors a
    WHERE a.id = v_ambassador_id
    ON CONFLICT (
      ambassador_id, campaign_id, rule_code
    ) WHERE campaign_id IS NOT NULL AND revoked_at IS NULL
    DO NOTHING
    RETURNING id INTO v_exception_id;

    IF v_exception_id IS NOT NULL THEN
      INSERT INTO private.phase1_audit_events (
        actor_id, event_type, entity_type, entity_id, outcome_code, metadata
      ) VALUES (
        v_actor, 'campaign_purchase_minimum_exception_granted',
        'ambassador_program_exception', v_exception_id, 'granted',
        jsonb_build_object(
          'ambassador_id', v_ambassador_id,
          'campaign_id', v_campaign.id,
          'invitation_id', v_invitation.id,
          'valid_until', v_campaign.ends_at
        )
      );
    END IF;
  END IF;

  RETURN v_result || jsonb_build_object(
    'campaign_id', v_campaign.id,
    'purchase_minimum_waived', v_exception_id IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_accept_ambassador_invitation(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_accept_ambassador_invitation(uuid, text)
  TO authenticated;

DO $$
BEGIN
  IF to_regprocedure(
    'public.fn_service_link_invited_auth_account(uuid,uuid)'
  ) IS NOT NULL
  AND to_regprocedure(
    'public.fn_service_link_invited_auth_account_core(uuid,uuid)'
  ) IS NULL THEN
    ALTER FUNCTION public.fn_service_link_invited_auth_account(
      uuid, uuid
    ) RENAME TO fn_service_link_invited_auth_account_core;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.fn_service_link_invited_auth_account_core(
  uuid, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_link_invited_auth_account_core(
  uuid, uuid
) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_service_link_invited_auth_account(
  p_invitation_token uuid,
  p_auth_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_result jsonb;
  v_token_fingerprint bytea;
  v_invitation private.ambassador_program_invitations%ROWTYPE;
  v_campaign private.ambassador_entry_campaigns%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  v_result := public.fn_service_link_invited_auth_account_core(
    p_invitation_token,
    p_auth_user_id
  );

  IF v_result->>'status' <> 'linked' THEN
    RETURN v_result;
  END IF;

  v_token_fingerprint := private.identity_hmac_internal(
    'ambassador_invitation_token',
    p_invitation_token::text,
    1::smallint
  );

  SELECT * INTO v_invitation
  FROM private.ambassador_program_invitations
  WHERE token_fingerprint = v_token_fingerprint;

  SELECT * INTO v_campaign
  FROM private.ambassador_entry_campaigns
  WHERE id = v_invitation.campaign_id;

  RETURN v_result || jsonb_build_object(
    'terms_version', v_invitation.program_terms_version,
    'campaign_name', v_campaign.name,
    'purchase_minimum_waiver', coalesce(
      v_campaign.status = 'active'
      AND now() BETWEEN v_campaign.starts_at AND v_campaign.ends_at
      AND v_campaign.waive_purchase_minimum,
      false
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_link_invited_auth_account(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_link_invited_auth_account(uuid, uuid)
  TO service_role;

DO $$
BEGIN
  IF to_regprocedure(
    'public.fn_create_manual_order_canonical(jsonb,jsonb,uuid)'
  ) IS NOT NULL
  AND to_regprocedure(
    'public.fn_create_manual_order_canonical_core(jsonb,jsonb,uuid)'
  ) IS NULL THEN
    ALTER FUNCTION public.fn_create_manual_order_canonical(
      jsonb, jsonb, uuid
    ) RENAME TO fn_create_manual_order_canonical_core;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.fn_create_manual_order_canonical_core(
  jsonb, jsonb, uuid
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_create_manual_order_canonical(
  p_order jsonb,
  p_items jsonb,
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
  v_customer_id uuid;
  v_selected_ambassador_id uuid;
  v_current_assignment private.customer_ambassador_assignments%ROWTYPE;
  v_assignment_result jsonb;
  v_result jsonb;
BEGIN
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin', 'vendedor']);

  v_customer_id := nullif(p_order->>'cliente_id', '')::uuid;
  v_selected_ambassador_id :=
    nullif(p_order->>'selected_ambassador_id', '')::uuid;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'invalid_order_payload' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_current_assignment
  FROM private.customer_ambassador_assignments
  WHERE customer_id = v_customer_id
    AND status = 'active'
    AND valid_until IS NULL
  FOR UPDATE;

  IF v_selected_ambassador_id IS NOT NULL
     AND v_current_assignment.id IS NULL THEN
    IF v_role <> 'admin' THEN
      RAISE EXCEPTION 'manual_order_assignment_admin_only'
        USING ERRCODE = '42501';
    END IF;

    v_assignment_result := public.fn_assign_customer_ambassador(
      v_customer_id,
      v_selected_ambassador_id,
      'manual_order_selection',
      'Indicação validada individualmente durante a criação atômica do pedido.',
      p_idempotency_key
    );

    IF v_assignment_result->>'status' <> 'assigned' THEN
      RETURN jsonb_build_object(
        'status', 'assignment_rejected',
        'code', v_assignment_result->>'code'
      );
    END IF;
  ELSIF v_selected_ambassador_id IS NOT NULL
        AND v_current_assignment.ambassador_id
          IS DISTINCT FROM v_selected_ambassador_id THEN
    RETURN jsonb_build_object(
      'status', 'assignment_rejected',
      'code', 'existing_official_assignment_preserved'
    );
  END IF;

  v_result := public.fn_create_manual_order_canonical_core(
    p_order,
    p_items,
    p_idempotency_key
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_manual_order_canonical(
  jsonb, jsonb, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_manual_order_canonical(
  jsonb, jsonb, uuid
) TO authenticated;

CREATE OR REPLACE FUNCTION private.enrich_official_order_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.ambassador_name_snapshot := NULL;
  NEW.commission_levels_snapshot := NULL;
  NEW.qualification_snapshot := NULL;

  IF NEW.ambassador_id IS NULL OR NEW.referral_assignment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.full_name
  INTO NEW.ambassador_name_snapshot
  FROM public.ambassadors a
  WHERE a.id = NEW.ambassador_id;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'level_number', l.level_number,
        'name', l.name,
        'percentage', l.percentage
      )
      ORDER BY l.level_number
    ),
    '[]'::jsonb
  )
  INTO NEW.commission_levels_snapshot
  FROM public.commission_plan_levels l
  WHERE l.commission_plan_id = NEW.commission_plan_id_snapshot
    AND l.enabled;

  SELECT jsonb_build_object(
    'qualification_id', q.id,
    'status', q.status,
    'rule_code', q.rule_code,
    'period_start', q.period_start,
    'period_end', q.period_end,
    'rule_snapshot', q.rule_snapshot,
    'exception_id', q.exception_id,
    'evaluated_at', q.evaluated_at
  )
  INTO NEW.qualification_snapshot
  FROM private.ambassador_qualifications q
  WHERE q.id = NEW.ambassador_qualification_id_snapshot;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enrich_official_order_snapshot()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_zzz_enrich_official_order_snapshot
  ON public.pedidos;
CREATE TRIGGER trg_zzz_enrich_official_order_snapshot
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION private.enrich_official_order_snapshot();

CREATE OR REPLACE FUNCTION public.fn_trg_pedidos_snapshots_imutaveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (OLD.ambassador_id IS NOT NULL AND NEW.ambassador_id IS DISTINCT FROM OLD.ambassador_id)
     OR (OLD.referral_code_snapshot IS NOT NULL AND NEW.referral_code_snapshot IS DISTINCT FROM OLD.referral_code_snapshot)
     OR (OLD.commission_plan_id_snapshot IS NOT NULL AND NEW.commission_plan_id_snapshot IS DISTINCT FROM OLD.commission_plan_id_snapshot)
     OR (OLD.commission_percentage_snapshot IS NOT NULL AND NEW.commission_percentage_snapshot IS DISTINCT FROM OLD.commission_percentage_snapshot)
     OR (OLD.commissionable_amount_snapshot IS NOT NULL AND NEW.commissionable_amount_snapshot IS DISTINCT FROM OLD.commissionable_amount_snapshot)
     OR (OLD.commission_amount_snapshot IS NOT NULL AND NEW.commission_amount_snapshot IS DISTINCT FROM OLD.commission_amount_snapshot)
     OR NEW.first_purchase_bonus_enabled_snapshot IS DISTINCT FROM OLD.first_purchase_bonus_enabled_snapshot
     OR NEW.first_purchase_minimum_snapshot IS DISTINCT FROM OLD.first_purchase_minimum_snapshot
     OR NEW.first_purchase_bonus_amount_snapshot IS DISTINCT FROM OLD.first_purchase_bonus_amount_snapshot
     OR NEW.first_purchase_bonus_effective_from_snapshot IS DISTINCT FROM OLD.first_purchase_bonus_effective_from_snapshot
     OR NEW.ambassador_name_snapshot IS DISTINCT FROM OLD.ambassador_name_snapshot
     OR NEW.commission_levels_snapshot IS DISTINCT FROM OLD.commission_levels_snapshot
     OR NEW.qualification_snapshot IS DISTINCT FROM OLD.qualification_snapshot THEN
    IF current_setting('bryza.allow_order_snapshot_update', true)
       IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION
        'Alteração de snapshots do pedido é proibida após o congelamento inicial.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_trg_pedidos_snapshots_imutaveis()
  FROM PUBLIC, anon, authenticated;

ALTER TABLE private.ambassador_entry_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.ambassador_invitation_eligibilities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.ambassador_entry_campaigns
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.ambassador_invitation_eligibilities
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE private.ambassador_entry_campaigns
  TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE private.ambassador_invitation_eligibilities
  TO service_role;

DROP TRIGGER IF EXISTS trg_no_delete_ambassador_entry_campaigns
  ON private.ambassador_entry_campaigns;
CREATE TRIGGER trg_no_delete_ambassador_entry_campaigns
BEFORE DELETE ON private.ambassador_entry_campaigns
FOR EACH ROW EXECUTE FUNCTION private.prevent_phase1_history_delete();

DROP TRIGGER IF EXISTS trg_no_delete_ambassador_invitation_eligibilities
  ON private.ambassador_invitation_eligibilities;
CREATE TRIGGER trg_no_delete_ambassador_invitation_eligibilities
BEFORE DELETE ON private.ambassador_invitation_eligibilities
FOR EACH ROW EXECUTE FUNCTION private.prevent_phase1_history_delete();
