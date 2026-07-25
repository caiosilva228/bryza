-- Remote migration 20260724201307. Phase 3: evidence-based backfill and explicit isolation of unverified legacy
-- seller migrations. This never creates a commissionable assignment.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.referral_attributions
  ADD COLUMN IF NOT EXISTS is_validated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_commissionable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS classification text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION private.sync_customer_email_from_person()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.person_id IS NOT NULL
     AND current_setting('bryza.canonical_identity_write', true) = 'true' THEN
    SELECT email_normalized
    INTO NEW.email
    FROM private.persons
    WHERE id = NEW.person_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_customer_email_from_person()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_customer_email_from_person ON public.clientes;
CREATE TRIGGER trg_sync_customer_email_from_person
BEFORE INSERT OR UPDATE OF person_id, email
ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION private.sync_customer_email_from_person();

DO $$
DECLARE
  v_admin uuid;
  v_profile record;
  v_person_id uuid;
  v_cpf text;
  v_email text;
  v_phone text;
  v_fp bytea;
  v_existing_person_id uuid;
  v_review_fp bytea;
  v_permission text;
BEGIN
  SELECT id INTO v_admin
  FROM public.profiles
  WHERE role::text = 'admin' AND ativo
  ORDER BY id LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'controlled_backfill_requires_active_admin';
  END IF;

  FOR v_profile IN
    SELECT p.*
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at, p.id
  LOOP
    IF v_profile.person_id IS NULL THEN
      v_cpf := nullif(regexp_replace(coalesce(v_profile.cpf, ''), '[^0-9]', '', 'g'), '');
      IF v_cpf IS NOT NULL AND v_cpf !~ '^[0-9]{11}$' THEN v_cpf := NULL; END IF;
      v_email := nullif(lower(btrim(coalesce(v_profile.email, ''))), '');
      v_phone := nullif(regexp_replace(coalesce(v_profile.telefone, ''), '[^0-9]', '', 'g'), '');
      IF v_phone IS NOT NULL AND v_phone !~ '^[0-9]{10,15}$' THEN v_phone := NULL; END IF;

      INSERT INTO private.persons (
        full_name, cpf_normalized, email_normalized, phone_normalized
      )
      VALUES (
        v_profile.nome, v_cpf, v_email, v_phone
      )
      RETURNING id INTO v_person_id;

      IF v_cpf IS NOT NULL THEN
        v_fp := private.identity_hmac_internal('cpf', v_cpf, 1);
        INSERT INTO private.person_identity_fingerprints (
          person_id, identifier_type, fingerprint, verified_at
        )
        VALUES (v_person_id, 'cpf', v_fp, now())
        ON CONFLICT (identifier_type, fingerprint) WHERE is_active
        DO NOTHING;

        IF NOT EXISTS (
          SELECT 1 FROM private.person_identity_fingerprints
          WHERE person_id = v_person_id
            AND identifier_type = 'cpf'
            AND fingerprint = v_fp
            AND is_active
        ) THEN
          SELECT person_id INTO v_existing_person_id
          FROM private.person_identity_fingerprints
          WHERE identifier_type = 'cpf' AND fingerprint = v_fp AND is_active
          LIMIT 1;
          v_review_fp := private.identity_hmac_internal(
            'review', 'profile-cpf:' || encode(v_fp, 'hex'), 1
          );
          PERFORM private.persist_identity_review_internal(
            v_admin, v_review_fp,
            ARRAY['authenticated_profiles_share_cpf'],
            'controlled_identity_backfill',
            ARRAY[v_person_id, v_existing_person_id],
            'profile', v_profile.id
          );
        END IF;
      END IF;

      IF v_email IS NOT NULL THEN
        v_fp := private.identity_hmac_internal('email', v_email, 1);
        INSERT INTO private.person_identity_fingerprints (
          person_id, identifier_type, fingerprint, verified_at
        )
        VALUES (v_person_id, 'email', v_fp, now())
        ON CONFLICT (identifier_type, fingerprint) WHERE is_active
        DO NOTHING;

        IF NOT EXISTS (
          SELECT 1 FROM private.person_identity_fingerprints
          WHERE person_id = v_person_id
            AND identifier_type = 'email'
            AND fingerprint = v_fp
            AND is_active
        ) THEN
          SELECT person_id INTO v_existing_person_id
          FROM private.person_identity_fingerprints
          WHERE identifier_type = 'email' AND fingerprint = v_fp AND is_active
          LIMIT 1;
          v_review_fp := private.identity_hmac_internal(
            'review', 'profile-email:' || encode(v_fp, 'hex'), 1
          );
          PERFORM private.persist_identity_review_internal(
            v_admin, v_review_fp,
            ARRAY['authenticated_profiles_share_email'],
            'controlled_identity_backfill',
            ARRAY[v_person_id, v_existing_person_id],
            'profile', v_profile.id
          );
        END IF;
      END IF;

      IF v_phone IS NOT NULL THEN
        v_fp := private.identity_hmac_internal('phone', v_phone, 1);
        INSERT INTO private.person_identity_fingerprints (
          person_id, identifier_type, fingerprint, verified_at
        )
        VALUES (v_person_id, 'phone', v_fp, now())
        ON CONFLICT (identifier_type, fingerprint) WHERE is_active
        DO NOTHING;

        IF NOT EXISTS (
          SELECT 1 FROM private.person_identity_fingerprints
          WHERE person_id = v_person_id
            AND identifier_type = 'phone'
            AND fingerprint = v_fp
            AND is_active
        ) THEN
          SELECT person_id INTO v_existing_person_id
          FROM private.person_identity_fingerprints
          WHERE identifier_type = 'phone' AND fingerprint = v_fp AND is_active
          LIMIT 1;
          v_review_fp := private.identity_hmac_internal(
            'review', 'profile-phone:' || encode(v_fp, 'hex'), 1
          );
          PERFORM private.persist_identity_review_internal(
            v_admin, v_review_fp,
            ARRAY['authenticated_profiles_share_phone'],
            'controlled_identity_backfill',
            ARRAY[v_person_id, v_existing_person_id],
            'profile', v_profile.id
          );
        END IF;
      END IF;

      INSERT INTO private.person_accounts (
        person_id, auth_user_id, status, linked_by
      )
      VALUES (v_person_id, v_profile.id, 'active', v_admin);

      UPDATE public.profiles
      SET person_id = v_person_id
      WHERE id = v_profile.id;
    ELSE
      v_person_id := v_profile.person_id;
    END IF;

    v_permission := CASE v_profile.role::text
      WHEN 'admin' THEN 'admin'
      WHEN 'vendedor' THEN 'seller'
      WHEN 'logistica' THEN 'logistics'
      WHEN 'embaixador' THEN 'ambassador_portal'
      ELSE NULL
    END;

    IF v_permission IS NOT NULL THEN
      INSERT INTO private.person_access_permissions (
        person_id, auth_user_id, permission_type, status, granted_by
      )
      VALUES (
        v_person_id, v_profile.id, v_permission, 'active', v_admin
      )
      ON CONFLICT (auth_user_id, permission_type)
      DO UPDATE SET
        person_id = EXCLUDED.person_id,
        status = 'active',
        revoked_by = NULL,
        revoked_at = NULL;
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  v_admin uuid;
  v_amb record;
  v_person_id uuid;
  v_profile_cpf text;
  v_profile_phone text;
  v_amb_cpf text;
  v_amb_phone text;
  v_profile_email text;
  v_amb_email text;
  v_review_fp bytea;
BEGIN
  SELECT id INTO v_admin
  FROM public.profiles
  WHERE role::text = 'admin' AND ativo
  ORDER BY id LIMIT 1;

  FOR v_amb IN
    SELECT
      a.*,
      p.person_id AS profile_person_id,
      p.cpf AS profile_cpf,
      p.telefone AS profile_phone,
      p.email AS profile_email
    FROM public.ambassadors a
    LEFT JOIN public.profiles p ON p.id = a.user_id
    WHERE a.person_id IS NULL
    ORDER BY a.created_at, a.id
  LOOP
    v_profile_cpf := regexp_replace(coalesce(v_amb.profile_cpf, ''), '[^0-9]', '', 'g');
    v_profile_phone := regexp_replace(coalesce(v_amb.profile_phone, ''), '[^0-9]', '', 'g');
    v_amb_cpf := regexp_replace(coalesce(v_amb.cpf, ''), '[^0-9]', '', 'g');
    v_amb_phone := regexp_replace(coalesce(v_amb.phone, ''), '[^0-9]', '', 'g');

    IF v_amb.user_id IS NOT NULL
       AND v_amb.profile_person_id IS NOT NULL
       AND v_profile_cpf ~ '^[0-9]{11}$'
       AND v_profile_cpf = v_amb_cpf
       AND v_profile_phone ~ '^[0-9]{10,15}$'
       AND v_profile_phone = v_amb_phone THEN
      v_person_id := v_amb.profile_person_id;

      UPDATE public.ambassadors
      SET person_id = v_person_id
      WHERE id = v_amb.id;

      UPDATE private.persons
      SET full_name = v_amb.full_name,
          cpf_normalized = v_amb_cpf,
          phone_normalized = v_amb_phone,
          updated_at = now()
      WHERE id = v_person_id;

      INSERT INTO private.person_business_roles (
        person_id, role_type, source_entity_id, status, activated_at
      )
      VALUES (
        v_person_id, 'ambassador', v_amb.id,
        CASE WHEN v_amb.status = 'ativo' THEN 'active' ELSE 'pending' END,
        v_amb.activated_at
      )
      ON CONFLICT (role_type, source_entity_id)
      DO UPDATE SET
        person_id = EXCLUDED.person_id,
        status = EXCLUDED.status,
        activated_at = coalesce(
          private.person_business_roles.activated_at,
          EXCLUDED.activated_at
        ),
        updated_at = now();

      INSERT INTO private.person_access_permissions (
        person_id, auth_user_id, permission_type, status, granted_by
      )
      VALUES (
        v_person_id, v_amb.user_id, 'ambassador_portal',
        CASE WHEN v_amb.status = 'ativo' THEN 'active' ELSE 'inactive' END,
        v_admin
      )
      ON CONFLICT (auth_user_id, permission_type)
      DO UPDATE SET
        person_id = EXCLUDED.person_id,
        status = EXCLUDED.status,
        revoked_at = CASE WHEN EXCLUDED.status = 'active' THEN NULL ELSE now() END,
        revoked_by = CASE WHEN EXCLUDED.status = 'active' THEN NULL ELSE v_admin END;

      v_profile_email := lower(btrim(coalesce(v_amb.profile_email, '')));
      v_amb_email := lower(btrim(coalesce(v_amb.email, '')));
      IF v_profile_email <> ''
         AND v_amb_email <> ''
         AND v_profile_email <> v_amb_email THEN
        v_review_fp := private.identity_hmac_internal(
          'review',
          encode(private.identity_hmac_internal('email', v_profile_email, 1), 'hex')
            || ':' ||
          encode(private.identity_hmac_internal('email', v_amb_email, 1), 'hex'),
          1
        );

        PERFORM private.persist_identity_review_internal(
          v_admin,
          v_review_fp,
          ARRAY['authenticated_and_contact_email_diverge'],
          'controlled_identity_backfill',
          ARRAY[v_person_id],
          'ambassador',
          v_amb.id
        );
      END IF;
    ELSE
      v_review_fp := private.identity_hmac_internal(
        'review',
        'ambassador:' || v_amb.id::text,
        1
      );
      PERFORM private.persist_identity_review_internal(
        v_admin,
        v_review_fp,
        ARRAY['ambassador_profile_evidence_insufficient'],
        'controlled_identity_backfill',
        CASE WHEN v_amb.profile_person_id IS NULL
          THEN '{}'::uuid[] ELSE ARRAY[v_amb.profile_person_id] END,
        'ambassador',
        v_amb.id
      );
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  v_admin uuid;
  v_customer record;
  v_person_id uuid;
  v_phone text;
  v_cpf text;
  v_phone_fp bytea;
  v_cpf_fp bytea;
  v_candidates uuid[];
  v_review_fp bytea;
BEGIN
  SELECT id INTO v_admin
  FROM public.profiles
  WHERE role::text = 'admin' AND ativo
  ORDER BY id LIMIT 1;

  FOR v_customer IN
    SELECT * FROM public.clientes
    WHERE person_id IS NULL
    ORDER BY data_cadastro, id
  LOOP
    v_phone := nullif(regexp_replace(coalesce(v_customer.telefone, ''), '[^0-9]', '', 'g'), '');
    v_cpf := nullif(regexp_replace(coalesce(v_customer.cpf, ''), '[^0-9]', '', 'g'), '');
    IF v_phone IS NOT NULL AND v_phone !~ '^[0-9]{10,15}$' THEN v_phone := NULL; END IF;
    IF v_cpf IS NOT NULL AND v_cpf !~ '^[0-9]{11}$' THEN v_cpf := NULL; END IF;

    IF v_phone IS NOT NULL THEN
      v_phone_fp := private.identity_hmac_internal('phone', v_phone, 1);
    ELSE
      v_phone_fp := NULL;
    END IF;

    IF v_cpf IS NOT NULL THEN
      v_cpf_fp := private.identity_hmac_internal('cpf', v_cpf, 1);
    ELSE
      v_cpf_fp := NULL;
    END IF;

    SELECT coalesce(array_agg(DISTINCT person_id ORDER BY person_id), '{}'::uuid[])
    INTO v_candidates
    FROM private.person_identity_fingerprints
    WHERE is_active
      AND (
        (v_phone_fp IS NOT NULL AND identifier_type = 'phone' AND fingerprint = v_phone_fp)
        OR (v_cpf_fp IS NOT NULL AND identifier_type = 'cpf' AND fingerprint = v_cpf_fp)
      );

    IF cardinality(v_candidates) > 0 THEN
      v_review_fp := private.identity_hmac_internal(
        'review',
        coalesce(encode(v_phone_fp, 'hex'), '') || ':' ||
        coalesce(encode(v_cpf_fp, 'hex'), ''),
        1
      );

      PERFORM private.persist_identity_review_internal(
        v_admin,
        v_review_fp,
        ARRAY['customer_identifier_matches_existing_authenticated_identity'],
        'controlled_identity_backfill',
        v_candidates,
        'customer',
        v_customer.id
      );
      CONTINUE;
    END IF;

    INSERT INTO private.persons (
      full_name, cpf_normalized, phone_normalized
    )
    VALUES (
      v_customer.nome, v_cpf, v_phone
    )
    RETURNING id INTO v_person_id;

    IF v_phone_fp IS NOT NULL THEN
      INSERT INTO private.person_identity_fingerprints (
        person_id, identifier_type, fingerprint
      )
      VALUES (v_person_id, 'phone', v_phone_fp);
    END IF;

    IF v_cpf_fp IS NOT NULL THEN
      INSERT INTO private.person_identity_fingerprints (
        person_id, identifier_type, fingerprint
      )
      VALUES (v_person_id, 'cpf', v_cpf_fp);
    END IF;

    PERFORM set_config('bryza.canonical_identity_write', 'true', true);
    UPDATE public.clientes
    SET person_id = v_person_id
    WHERE id = v_customer.id;

    INSERT INTO private.person_business_roles (
      person_id, role_type, source_entity_id, status, activated_at
    )
    VALUES (
      v_person_id, 'customer', v_customer.id, 'active', v_customer.data_cadastro
    );
  END LOOP;
END
$$;

INSERT INTO private.customer_commercial_assignments (
  customer_id,
  commercial_profile_id,
  valid_from,
  source,
  reason,
  assigned_by
)
SELECT
  c.id,
  c.vendedor_responsavel_id,
  c.data_cadastro,
  'existing_customer_baseline',
  'Responsável comercial preservado separadamente da indicação comissionável',
  admin_profile.id
FROM public.clientes c
CROSS JOIN LATERAL (
  SELECT id FROM public.profiles
  WHERE role::text = 'admin' AND ativo
  ORDER BY id LIMIT 1
) admin_profile
WHERE c.vendedor_responsavel_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM private.customer_commercial_assignments cca
    WHERE cca.customer_id = c.id AND cca.valid_until IS NULL
  );

INSERT INTO private.legacy_referral_link_archive (
  customer_id,
  legacy_ambassador_id,
  legacy_referral_attribution_id,
  legacy_source,
  classification,
  is_commissionable
)
SELECT
  c.id,
  c.ambassador_id,
  ra.id,
  c.referral_source,
  'unverified_commercial_migration',
  false
FROM public.clientes c
LEFT JOIN LATERAL (
  SELECT id
  FROM public.referral_attributions
  WHERE customer_id = c.id
  ORDER BY created_at, id
  LIMIT 1
) ra ON true
WHERE c.referral_source IN (
  'migracao_vendedor_caio',
  'migracao_vendedor_isabele'
)
ON CONFLICT (customer_id, legacy_source) DO NOTHING;

UPDATE public.referral_attributions ra
SET is_validated = false,
    is_commissionable = false,
    classification = 'unverified_commercial_migration',
    archived_at = coalesce(ra.archived_at, now()),
    updated_at = now()
FROM public.clientes c
WHERE c.id = ra.customer_id
  AND c.referral_source IN (
    'migracao_vendedor_caio',
    'migracao_vendedor_isabele'
  );

CREATE OR REPLACE FUNCTION public.fn_archive_customer(
  p_customer_id uuid,
  p_reason text
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
BEGIN
  SELECT actor_id, actor_role
  INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'archive_reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_customer
  FROM public.clientes
  WHERE id = p_customer_id
  FOR UPDATE;

  IF v_customer.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_customer.lifecycle_status = 'archived' THEN
    RETURN jsonb_build_object(
      'status', 'archived',
      'entity_id', v_customer.id
    );
  END IF;

  UPDATE private.customer_ambassador_assignments
  SET status = 'archived',
      valid_until = now(),
      ended_by = v_actor,
      updated_at = now()
  WHERE customer_id = p_customer_id
    AND status = 'active';

  UPDATE private.customer_commercial_assignments
  SET valid_until = now()
  WHERE customer_id = p_customer_id
    AND valid_until IS NULL;

  UPDATE private.person_business_roles
  SET status = 'archived',
      inactivated_at = now(),
      updated_at = now()
  WHERE role_type = 'customer'
    AND source_entity_id = p_customer_id;

  UPDATE public.clientes
  SET lifecycle_status = 'archived',
      archived_at = now(),
      archived_by = v_actor,
      archive_reason = btrim(p_reason),
      status_cliente = 'inativo',
      commissionable_ambassador_id = NULL,
      current_referral_assignment_id = NULL
  WHERE id = p_customer_id;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  )
  VALUES (
    v_actor, 'customer_archived', 'customer', p_customer_id, 'archived',
    jsonb_build_object(
      'operation_scope', 'customer_lifecycle',
      'operation_type', 'archive_customer'
    )
  );

  RETURN jsonb_build_object(
    'status', 'archived',
    'entity_id', p_customer_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_archive_customer(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_archive_customer(uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.prevent_customer_physical_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'physical_customer_delete_forbidden_use_archive'
    USING ERRCODE = '23000';
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_customer_physical_delete()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_customer_physical_delete ON public.clientes;
CREATE TRIGGER trg_prevent_customer_physical_delete
BEFORE DELETE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION private.prevent_customer_physical_delete();

COMMENT ON COLUMN public.referral_attributions.is_commissionable IS
  'Legacy referral rows are never commission sources unless individually validated and represented in private.customer_ambassador_assignments.';
