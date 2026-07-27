BEGIN;

CREATE OR REPLACE FUNCTION public.fn_admin_promote_client_to_ambassador(
  p_customer_id uuid,
  p_plan_id uuid DEFAULT NULL,
  p_initial_status text DEFAULT 'pendente'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor                uuid;
  v_actor_role           text;
  v_customer             public.clientes%ROWTYPE;
  v_ambassador           public.ambassadors%ROWTYPE;
  v_plan_id              uuid;
  v_parent_ambassador_id uuid;
BEGIN
  SELECT actor_id, actor_role
  INTO v_actor, v_actor_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id_required';
  END IF;

  IF p_initial_status NOT IN ('pendente', 'ativo') THEN
    RAISE EXCEPTION 'invalid_initial_status';
  END IF;

  SELECT *
  INTO v_customer
  FROM public.clientes
  WHERE id = p_customer_id
  FOR UPDATE;

  IF v_customer.id IS NULL THEN
    RETURN jsonb_build_object('status', 'customer_not_found');
  END IF;

  IF v_customer.own_ambassador_id IS NOT NULL THEN
    SELECT *
    INTO v_ambassador
    FROM public.ambassadors
    WHERE id = v_customer.own_ambassador_id;

    RETURN jsonb_build_object(
      'status', 'already_ambassador',
      'ambassador_id', v_ambassador.id,
      'referral_code', v_ambassador.referral_code
    );
  END IF;

  v_parent_ambassador_id := v_customer.commissionable_ambassador_id;
  IF v_parent_ambassador_id IS NULL THEN
    SELECT ambassador_id
    INTO v_parent_ambassador_id
    FROM public.referral_attributions
    WHERE customer_id = p_customer_id
    LIMIT 1;
  END IF;

  IF v_customer.person_id IS NOT NULL THEN
    SELECT *
    INTO v_ambassador
    FROM public.ambassadors
    WHERE person_id = v_customer.person_id
    LIMIT 1;

    IF v_ambassador.id IS NOT NULL THEN
      PERFORM pg_catalog.set_config('bryza.canonical_identity_write', 'true', true);

      UPDATE public.clientes
      SET own_ambassador_id = v_ambassador.id
      WHERE id = p_customer_id;

      RETURN jsonb_build_object(
        'status', 'linked_existing_ambassador',
        'ambassador_id', v_ambassador.id,
        'referral_code', v_ambassador.referral_code,
        'username', v_ambassador.username
      );
    END IF;
  END IF;

  IF p_plan_id IS NOT NULL THEN
    SELECT id
    INTO v_plan_id
    FROM public.commission_plans
    WHERE id = p_plan_id
      AND status = 'ativo';
  ELSE
    SELECT id
    INTO v_plan_id
    FROM public.commission_plans
    WHERE status = 'ativo'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'active_commission_plan_required';
  END IF;

  PERFORM pg_catalog.set_config('bryza.canonical_identity_write', 'true', true);

  INSERT INTO public.ambassadors (
    person_id, full_name, display_name, phone, email, cpf, status,
    commission_plan_id, parent_ambassador_id, notes
  )
  VALUES (
    v_customer.person_id,
    v_customer.nome,
    v_customer.nome,
    v_customer.telefone,
    v_customer.email,
    v_customer.cpf,
    p_initial_status,
    v_plan_id,
    v_parent_ambassador_id,
    'Promovido pelo administrador a partir do cadastro de cliente #' || v_customer.id::text
  )
  RETURNING * INTO v_ambassador;

  UPDATE public.clientes
  SET own_ambassador_id = v_ambassador.id
  WHERE id = p_customer_id;

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_actor,
    v_actor_role,
    'admin_promoted_client_to_ambassador',
    'ambassadors',
    v_ambassador.id,
    jsonb_build_object(
      'customer_id', p_customer_id,
      'customer_name', v_customer.nome,
      'plan_id', v_plan_id,
      'initial_status', p_initial_status,
      'referral_code', v_ambassador.referral_code
    )
  );

  RETURN jsonb_build_object(
    'status', 'promoted',
    'ambassador_id', v_ambassador.id,
    'referral_code', v_ambassador.referral_code,
    'username', v_ambassador.username
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_admin_promote_client_to_ambassador(uuid, uuid, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_admin_promote_client_to_ambassador(uuid, uuid, text)
TO authenticated;

COMMIT;
