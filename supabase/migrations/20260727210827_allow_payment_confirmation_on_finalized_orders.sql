-- The order-status synchronizer already supports confirmed payments for both
-- delivered and finalized orders. Keep the security guard aligned so legacy or
-- imported finalized orders with a pending payment can still be reconciled.
DO $migration$
DECLARE
  v_definition text;
  v_updated_definition text;
  v_condition_start integer;
  v_old_condition constant text :=
    'IF OLD.status_pedido <> ''entregue'' THEN';
  v_new_condition constant text :=
    'IF OLD.status_pedido NOT IN (''entregue'', ''finalizado'') THEN';
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'fn_pedidos_security_before_update'
    AND p.prokind = 'f';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'fn_pedidos_security_before_update_not_found';
  END IF;

  -- The first occurrence belongs to the confirmation branch. The second one,
  -- kept unchanged, belongs to the divergent-payment branch.
  v_condition_start := strpos(v_definition, v_old_condition);

  IF v_condition_start = 0 THEN
    RAISE EXCEPTION 'payment_confirmation_guard_pattern_not_found';
  END IF;

  v_updated_definition := overlay(
    v_definition
    PLACING v_new_condition
    FROM v_condition_start
    FOR length(v_old_condition)
  );

  EXECUTE v_updated_definition;
END;
$migration$;
