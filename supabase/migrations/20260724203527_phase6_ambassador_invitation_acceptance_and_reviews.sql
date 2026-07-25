-- Remote migration 20260724203527. Phase 6: audited invitations/acceptance, launch exceptions and identity-review RPCs.

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
  v_existing private.ambassador_program_invitations%ROWTYPE;
  v_invitation_id uuid;
  v_token_fingerprint bytea;
BEGIN
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  IF p_customer_id IS NULL
     OR p_invitation_token IS NULL
     OR length(btrim(coalesce(p_terms_version, ''))) < 1
     OR p_expires_at <= now() + interval '1 hour'
     OR p_expires_at > now() + interval '90 days' THEN
    RAISE EXCEPTION 'invalid_ambassador_invitation' USING ERRCODE = '22023';
  END IF;

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

  IF EXISTS (
    SELECT 1 FROM public.ambassadors
    WHERE person_id = v_customer.person_id
      AND lifecycle_status = 'active'
  ) THEN
    RETURN jsonb_build_object('status', 'already_ambassador');
  END IF;

  SELECT * INTO v_existing
  FROM private.ambassador_program_invitations
  WHERE person_id = v_customer.person_id
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY invited_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'pending_invitation_exists',
      'invitation_id', v_existing.id,
      'expires_at', v_existing.expires_at
    );
  END IF;

  v_token_fingerprint := private.identity_hmac_internal(
    'ambassador_invitation_token',
    p_invitation_token::text,
    1::smallint
  );

  INSERT INTO private.ambassador_program_invitations (
    person_id, token_fingerprint, program_terms_version,
    invited_by, expires_at
  ) VALUES (
    v_customer.person_id, v_token_fingerprint, btrim(p_terms_version),
    v_actor, p_expires_at
  )
  RETURNING id INTO v_invitation_id;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  ) VALUES (
    v_actor, 'ambassador_program_invitation_created',
    'ambassador_program_invitation', v_invitation_id, 'created',
    jsonb_build_object(
      'customer_id', p_customer_id,
      'terms_version', btrim(p_terms_version),
      'expires_at', p_expires_at
    )
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'invitation_id', v_invitation_id,
    'invitation_token', p_invitation_token,
    'expires_at', p_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_create_ambassador_invitation(
  uuid, text, uuid, timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_create_ambassador_invitation(
  uuid, text, uuid, timestamptz
) TO authenticated;

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
  v_account private.person_accounts%ROWTYPE;
  v_invitation private.ambassador_program_invitations%ROWTYPE;
  v_person private.persons%ROWTYPE;
  v_ambassador public.ambassadors%ROWTYPE;
  v_review_id uuid;
  v_review_fp bytea;
  v_token_fingerprint bytea;
BEGIN
  IF v_actor IS NULL OR p_invitation_token IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_account
  FROM private.person_accounts
  WHERE auth_user_id = v_actor AND status = 'active'
  FOR SHARE;

  IF v_account.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'authenticated_account_without_canonical_identity'
    );
  END IF;

  v_token_fingerprint := private.identity_hmac_internal(
    'ambassador_invitation_token',
    p_invitation_token::text,
    1::smallint
  );

  SELECT * INTO v_invitation
  FROM private.ambassador_program_invitations
  WHERE token_fingerprint = v_token_fingerprint
  FOR UPDATE;

  IF v_invitation.id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_invitation');
  END IF;
  IF v_invitation.status = 'accepted' THEN
    SELECT * INTO v_ambassador
    FROM public.ambassadors
    WHERE person_id = v_invitation.person_id;
    RETURN jsonb_build_object(
      'status', 'accepted',
      'ambassador_id', v_ambassador.id,
      'referral_code', v_ambassador.referral_code,
      'replayed', true
    );
  END IF;
  IF v_invitation.status <> 'pending' OR v_invitation.expires_at <= now() THEN
    UPDATE private.ambassador_program_invitations
    SET status = CASE WHEN status = 'pending' THEN 'expired' ELSE status END,
        updated_at = now()
    WHERE id = v_invitation.id;
    RETURN jsonb_build_object('status', 'expired_or_unavailable');
  END IF;
  IF v_invitation.program_terms_version <> btrim(p_terms_version) THEN
    RETURN jsonb_build_object('status', 'terms_version_mismatch');
  END IF;

  IF v_invitation.person_id <> v_account.person_id THEN
    v_review_fp := extensions.digest(
      convert_to(
        'invitation_account_mismatch:' || encode(v_token_fingerprint, 'hex') ||
        ':' || v_actor::text,
        'UTF8'
      ),
      'sha256'
    );
    v_review_id := private.persist_identity_review_internal(
      v_actor,
      v_review_fp,
      ARRAY['authenticated_account_does_not_match_invited_person'],
      'ambassador_invitation_acceptance',
      ARRAY[v_invitation.person_id, v_account.person_id],
      'ambassador_program_invitation',
      v_invitation.id
    );
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'review_id', v_review_id
    );
  END IF;

  SELECT * INTO v_person
  FROM private.persons
  WHERE id = v_invitation.person_id
    AND status = 'active'
  FOR SHARE;

  IF v_person.id IS NULL OR v_person.cpf_normalized IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'canonical_identity_incomplete'
    );
  END IF;

  SELECT * INTO v_ambassador
  FROM public.ambassadors
  WHERE person_id = v_person.id
  FOR UPDATE;

  IF v_ambassador.id IS NULL THEN
    PERFORM set_config('bryza.canonical_identity_write', 'true', true);
    INSERT INTO public.ambassadors (
      user_id, person_id, full_name, display_name, cpf, phone, email,
      status, activated_at, notes
    ) VALUES (
      v_actor, v_person.id, v_person.full_name, v_person.full_name,
      v_person.cpf_normalized, v_person.phone_normalized,
      v_person.email_normalized, 'ativo', now(),
      'Ativado após convite e aceite auditado do Programa de Embaixadores.'
    )
    RETURNING * INTO v_ambassador;
  ELSE
    UPDATE public.ambassadors
    SET user_id = v_actor,
        status = 'ativo',
        lifecycle_status = 'active',
        activated_at = coalesce(activated_at, now()),
        deactivated_at = NULL,
        updated_at = now()
    WHERE id = v_ambassador.id
    RETURNING * INTO v_ambassador;
  END IF;

  INSERT INTO private.ambassador_program_acceptances (
    invitation_id, person_id, terms_version,
    accepted_by_auth_user_id, evidence_fingerprint
  ) VALUES (
    v_invitation.id, v_person.id, btrim(p_terms_version),
    v_actor,
    extensions.digest(
      convert_to(
        v_invitation.id::text || ':' || v_actor::text || ':' ||
        btrim(p_terms_version),
        'UTF8'
      ),
      'sha256'
    )
  )
  ON CONFLICT (invitation_id) DO NOTHING;

  UPDATE private.ambassador_program_invitations
  SET status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  WHERE id = v_invitation.id;

  INSERT INTO private.person_business_roles (
    person_id, role_type, source_entity_id, status, activated_at
  ) VALUES (
    v_person.id, 'ambassador', v_ambassador.id, 'active', now()
  )
  ON CONFLICT (person_id, role_type) DO UPDATE
    SET source_entity_id = EXCLUDED.source_entity_id,
        status = 'active',
        activated_at = coalesce(private.person_business_roles.activated_at, now()),
        inactivated_at = NULL,
        updated_at = now();

  INSERT INTO private.person_access_permissions (
    person_id, auth_user_id, permission_type, status, granted_by
  ) VALUES (
    v_person.id, v_actor, 'ambassador_portal', 'active', v_actor
  )
  ON CONFLICT (auth_user_id, permission_type) DO UPDATE
    SET person_id = EXCLUDED.person_id,
        status = 'active',
        granted_by = EXCLUDED.granted_by,
        granted_at = now(),
        revoked_by = NULL,
        revoked_at = NULL;

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);
  UPDATE public.clientes
  SET own_ambassador_id = v_ambassador.id
  WHERE person_id = v_person.id
    AND lifecycle_status = 'active';

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  ) VALUES (
    v_actor, 'ambassador_program_invitation_accepted',
    'ambassador', v_ambassador.id, 'activated',
    jsonb_build_object(
      'invitation_id', v_invitation.id,
      'terms_version', btrim(p_terms_version)
    )
  );

  RETURN jsonb_build_object(
    'status', 'accepted',
    'ambassador_id', v_ambassador.id,
    'referral_code', v_ambassador.referral_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_accept_ambassador_invitation(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_accept_ambassador_invitation(uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_grant_ambassador_exception(
  p_ambassador_id uuid,
  p_reason text,
  p_valid_until timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_person_id uuid;
  v_exception_id uuid;
BEGIN
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  SELECT person_id INTO v_person_id
  FROM public.ambassadors
  WHERE id = p_ambassador_id
    AND lifecycle_status = 'active';

  IF v_person_id IS NULL
     OR length(btrim(coalesce(p_reason, ''))) < 5
     OR p_valid_until <= now()
     OR p_valid_until > now() + interval '2 years' THEN
    RAISE EXCEPTION 'invalid_ambassador_exception' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.ambassador_program_exceptions (
    person_id, ambassador_id, rule_code, effect_type,
    reason, valid_from, valid_until, granted_by
  ) VALUES (
    v_person_id, p_ambassador_id, 'monthly_purchase_qualification',
    'allow', btrim(p_reason), now(), p_valid_until, v_actor
  )
  RETURNING id INTO v_exception_id;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  ) VALUES (
    v_actor, 'ambassador_qualification_exception_granted',
    'ambassador_program_exception', v_exception_id, 'granted',
    jsonb_build_object(
      'ambassador_id', p_ambassador_id,
      'valid_until', p_valid_until
    )
  );

  RETURN jsonb_build_object(
    'status', 'granted',
    'exception_id', v_exception_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_grant_ambassador_exception(
  uuid, text, timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_grant_ambassador_exception(
  uuid, text, timestamptz
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_list_identity_reviews()
RETURNS TABLE (
  review_id uuid,
  status text,
  conflict_types text[],
  operation_scope text,
  candidate_count integer,
  created_at timestamptz,
  resolved_at timestamptz,
  resolution_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
BEGIN
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  RETURN QUERY
  SELECT r.id, r.status, r.conflict_types, r.operation_scope,
         cardinality(r.candidate_person_ids), r.created_at,
         r.resolved_at, r.resolution_code
  FROM private.identity_conflict_reviews r
  ORDER BY (r.status = 'open') DESC, r.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_list_identity_reviews()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_list_identity_reviews()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_resolve_identity_review(
  p_review_id uuid,
  p_resolution_code text,
  p_resolution_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
BEGIN
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  IF p_resolution_code NOT IN (
    'confirmed_same_person', 'confirmed_distinct_people',
    'corrected_source_data', 'insufficient_evidence', 'rejected'
  ) OR length(btrim(coalesce(p_resolution_notes, ''))) < 5 THEN
    RAISE EXCEPTION 'invalid_identity_review_resolution' USING ERRCODE = '22023';
  END IF;

  UPDATE private.identity_conflict_reviews
  SET status = 'resolved',
      reviewer_id = v_actor,
      resolution_code = p_resolution_code,
      resolution_notes = btrim(p_resolution_notes),
      resolved_at = now(),
      updated_at = now()
  WHERE id = p_review_id
    AND status = 'open';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_open_or_not_found');
  END IF;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  ) VALUES (
    v_actor, 'identity_conflict_review_resolved',
    'identity_conflict_review', p_review_id, p_resolution_code,
    jsonb_build_object('resolution_code', p_resolution_code)
  );

  RETURN jsonb_build_object('status', 'resolved', 'review_id', p_review_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_resolve_identity_review(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_resolve_identity_review(uuid, text, text)
  TO authenticated;
