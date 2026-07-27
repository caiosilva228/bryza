BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- The original commercial seller relation and the official ambassador
-- referral relation are intentionally independent. Reconcile the two known
-- seller/ambassador identities without replacing any existing official
-- referral assignment.
DO $$
DECLARE
  v_actor_id uuid;
  v_target_count integer;
  v_customer record;
  v_result jsonb;
BEGIN
  SELECT p.id
  INTO v_actor_id
  FROM public.profiles p
  WHERE p.role = 'admin'
    AND p.ativo
  ORDER BY p.created_at, p.id
  LIMIT 1;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'active_admin_required_for_referral_reconciliation';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);

  SELECT count(*)
  INTO v_target_count
  FROM public.ambassadors a
  JOIN public.profiles seller
    ON lower(btrim(seller.nome)) = lower(btrim(a.full_name))
   AND seller.role = 'vendedor'
   AND seller.ativo
  WHERE a.username IN ('bryza02', 'bryza03')
    AND a.status = 'ativo'
    AND a.lifecycle_status = 'active';

  IF v_target_count <> 2 THEN
    RAISE EXCEPTION
      'expected_two_seller_ambassador_mappings_found_%', v_target_count;
  END IF;

  FOR v_customer IN
    SELECT
      c.id AS customer_id,
      a.id AS ambassador_id,
      a.username
    FROM public.ambassadors a
    JOIN public.profiles seller
      ON lower(btrim(seller.nome)) = lower(btrim(a.full_name))
     AND seller.role = 'vendedor'
     AND seller.ativo
    JOIN public.clientes c
      ON c.vendedor_responsavel_id = seller.id
     AND c.lifecycle_status = 'active'
    WHERE a.username IN ('bryza02', 'bryza03')
      AND a.status = 'ativo'
      AND a.lifecycle_status = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM private.customer_ambassador_assignments current_assignment
        WHERE current_assignment.customer_id = c.id
          AND current_assignment.status = 'active'
      )
    ORDER BY a.username, c.codigo_cliente, c.id
  LOOP
    v_result := public.fn_assign_customer_ambassador(
      v_customer.customer_id,
      v_customer.ambassador_id,
      'verified_migration',
      'Conciliação do vendedor comercial com o embaixador de mesma identidade',
      extensions.gen_random_uuid()
    );

    IF coalesce(v_result->>'status', '') <> 'assigned' THEN
      RAISE EXCEPTION
        'referral_reconciliation_failed_customer_%_status_%',
        v_customer.customer_id,
        coalesce(v_result->>'status', 'missing');
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.ambassadors a
    JOIN public.profiles seller
      ON lower(btrim(seller.nome)) = lower(btrim(a.full_name))
     AND seller.role = 'vendedor'
     AND seller.ativo
    JOIN public.clientes c
      ON c.vendedor_responsavel_id = seller.id
     AND c.lifecycle_status = 'active'
    LEFT JOIN private.customer_ambassador_assignments current_assignment
      ON current_assignment.customer_id = c.id
     AND current_assignment.status = 'active'
    WHERE a.username IN ('bryza02', 'bryza03')
      AND (
        current_assignment.id IS NULL
        OR current_assignment.ambassador_id <> a.id
        OR NOT current_assignment.is_validated
        OR NOT current_assignment.is_commissionable
        OR c.current_referral_assignment_id IS DISTINCT FROM current_assignment.id
        OR c.commissionable_ambassador_id IS DISTINCT FROM a.id
      )
  ) THEN
    RAISE EXCEPTION 'referral_reconciliation_incomplete';
  END IF;
END
$$;

COMMIT;
