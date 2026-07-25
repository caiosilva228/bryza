-- A aplicação remota da migration operacional passou por uma camada de
-- transporte Windows-1252. Recria somente as funções afetadas com UTF-8.
DO $$
DECLARE
  v_function regprocedure;
  v_definition text;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'public.fn_admin_mark_founder_customers_eligible(uuid)'::regprocedure,
    'public.fn_admin_create_ambassador_invitation(uuid,text,uuid,timestamptz)'::regprocedure,
    'public.fn_create_manual_order_canonical(jsonb,jsonb,uuid)'::regprocedure,
    'public.fn_trg_pedidos_snapshots_imutaveis()'::regprocedure
  ]
  LOOP
    v_definition := pg_get_functiondef(v_function);
    IF v_definition LIKE '%Ã%' OR v_definition LIKE '%â€%' THEN
      EXECUTE convert_from(
        convert_to(v_definition, 'WIN1252'),
        'UTF8'
      );
    END IF;
  END LOOP;
END
$$;
