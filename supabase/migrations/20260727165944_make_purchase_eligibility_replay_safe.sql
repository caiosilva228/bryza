CREATE OR REPLACE FUNCTION private.mark_customer_eligible_after_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_customer public.clientes%ROWTYPE;
  v_minimum numeric := 79;
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.status_pedido NOT IN ('entregue', 'finalizado')
     OR NEW.payment_check_status <> 'confirmado' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(first_purchase_minimum_amount, 79)
  INTO v_minimum
  FROM public.ambassador_program_settings
  WHERE singleton;

  IF coalesce(NEW.valor_total, 0) < v_minimum THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_customer
  FROM public.clientes
  WHERE id = NEW.cliente_id
    AND lifecycle_status = 'active'
  FOR SHARE;

  IF v_customer.id IS NULL
     OR v_customer.person_id IS NULL
     OR v_customer.own_ambassador_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL THEN
    SELECT id INTO v_actor
    FROM public.profiles
    WHERE role = 'admin' AND ativo
    ORDER BY created_at, id
    LIMIT 1;
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'eligibility_actor_unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO private.ambassador_invitation_eligibilities (
    person_id, customer_id, eligibility_type, eligibility_label,
    status, source, evidence_code, marked_by, eligible_at
  ) VALUES (
    v_customer.person_id,
    v_customer.id,
    'qualifying_purchase',
    'Elegível por compra confirmada de R$ 79 ou mais',
    'eligible',
    'qualifying_purchase_trigger',
    'confirmed_purchase_minimum_79',
    v_actor,
    coalesce(NEW.finalized_at, NEW.updated_at, now())
  )
  ON CONFLICT (person_id) WHERE status = 'eligible'
  DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.mark_customer_eligible_after_purchase()
  FROM PUBLIC, anon, authenticated;
