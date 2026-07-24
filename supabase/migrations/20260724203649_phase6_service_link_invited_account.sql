-- Remote migration 20260724203649. Service-only bridge used immediately after Supabase Auth creates an invited user.
-- The invitation token is HMAC-matched and the verified Auth e-mail must belong
-- to the same canonical person before the one-to-one account link is created.

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
  v_invitation private.ambassador_program_invitations%ROWTYPE;
  v_person private.persons%ROWTYPE;
  v_user auth.users%ROWTYPE;
  v_token_fingerprint bytea;
  v_auth_email_fingerprint bytea;
  v_person_email_fingerprint bytea;
  v_review_id uuid;
  v_review_fingerprint bytea;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     OR p_invitation_token IS NULL
     OR p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  v_token_fingerprint := private.identity_hmac_internal(
    'ambassador_invitation_token',
    p_invitation_token::text,
    1::smallint
  );

  SELECT * INTO v_invitation
  FROM private.ambassador_program_invitations
  WHERE token_fingerprint = v_token_fingerprint
    AND status = 'pending'
    AND expires_at > now()
  FOR UPDATE;

  IF v_invitation.id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_or_expired_invitation');
  END IF;

  SELECT * INTO v_person
  FROM private.persons
  WHERE id = v_invitation.person_id
    AND status = 'active'
  FOR SHARE;

  SELECT * INTO v_user
  FROM auth.users
  WHERE id = p_auth_user_id
  FOR SHARE;

  IF v_person.id IS NULL OR v_user.id IS NULL
     OR v_user.email IS NULL OR v_user.email_confirmed_at IS NULL
     OR v_person.email_normalized IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'verified_email_required'
    );
  END IF;

  v_auth_email_fingerprint := private.identity_hmac_internal(
    'email', lower(btrim(v_user.email)), 1::smallint
  );
  v_person_email_fingerprint := private.identity_hmac_internal(
    'email', v_person.email_normalized, 1::smallint
  );

  IF v_auth_email_fingerprint <> v_person_email_fingerprint THEN
    v_review_fingerprint := extensions.digest(
      convert_to(
        'invited_auth_email_mismatch:' || encode(v_token_fingerprint, 'hex')
          || ':' || p_auth_user_id::text,
        'UTF8'
      ),
      'sha256'
    );
    v_review_id := private.persist_identity_review_internal(
      v_invitation.invited_by,
      v_review_fingerprint,
      ARRAY['verified_auth_email_does_not_match_invited_person'],
      'ambassador_invited_account_link',
      ARRAY[v_person.id],
      'ambassador_program_invitation',
      v_invitation.id
    );
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'review_id', v_review_id
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM private.person_accounts
    WHERE person_id = v_person.id
      AND auth_user_id <> p_auth_user_id
      AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM private.person_accounts
    WHERE auth_user_id = p_auth_user_id
      AND person_id <> v_person.id
      AND status = 'active'
  ) THEN
    v_review_fingerprint := extensions.digest(
      convert_to(
        'invited_account_one_to_one_conflict:' ||
        encode(v_token_fingerprint, 'hex') || ':' || p_auth_user_id::text,
        'UTF8'
      ),
      'sha256'
    );
    v_review_id := private.persist_identity_review_internal(
      v_invitation.invited_by,
      v_review_fingerprint,
      ARRAY['canonical_person_account_one_to_one_conflict'],
      'ambassador_invited_account_link',
      ARRAY[v_person.id],
      'ambassador_program_invitation',
      v_invitation.id
    );
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'review_id', v_review_id
    );
  END IF;

  INSERT INTO private.person_accounts (
    person_id, auth_user_id, status, linked_by
  ) VALUES (
    v_person.id, p_auth_user_id, 'active', v_invitation.invited_by
  )
  ON CONFLICT (person_id) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id,
        status = 'active',
        linked_by = EXCLUDED.linked_by,
        disabled_at = NULL,
        updated_at = now();

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);
  INSERT INTO public.profiles (
    id, person_id, nome, email, telefone, cpf, role, ativo,
    must_change_password
  ) VALUES (
    p_auth_user_id, v_person.id, v_person.full_name,
    v_person.email_normalized, v_person.phone_normalized,
    v_person.cpf_normalized, 'embaixador', true, false
  )
  ON CONFLICT (id) DO UPDATE
    SET person_id = EXCLUDED.person_id,
        nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        telefone = EXCLUDED.telefone,
        cpf = EXCLUDED.cpf,
        ativo = true;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  ) VALUES (
    v_invitation.invited_by, 'invited_auth_account_linked',
    'ambassador_program_invitation', v_invitation.id, 'linked',
    jsonb_build_object('auth_user_id', p_auth_user_id)
  );

  RETURN jsonb_build_object(
    'status', 'linked',
    'invitation_id', v_invitation.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_link_invited_auth_account(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_link_invited_auth_account(uuid, uuid)
  TO service_role;
