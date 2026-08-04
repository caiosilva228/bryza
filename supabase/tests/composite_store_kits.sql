-- Contratos de schema para os kits compostos da /loja.
-- Execute depois de aplicar as migrations em um banco Supabase de teste.

DO $$
BEGIN
  IF to_regclass('public.kits') IS NULL
     OR to_regclass('public.kit_itens') IS NULL
     OR to_regclass('public.agendamento_kits') IS NULL
     OR to_regclass('public.pedido_kits') IS NULL
     OR to_regclass('public.venda_kits') IS NULL THEN
    RAISE EXCEPTION 'kit_tables_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agendamento_itens'
      AND column_name = 'kit_line_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pedido_itens'
      AND column_name = 'kit_line_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venda_itens'
      AND column_name = 'kit_line_id'
  ) THEN
    RAISE EXCEPTION 'kit_line_columns_missing';
  END IF;

  IF to_regprocedure('public.fn_create_store_agendamento_with_kits(jsonb,jsonb,uuid)') IS NULL
     OR to_regprocedure('public.fn_convert_agendamento_to_order_internal(uuid,text,text,text,timestamptz,numeric,text)') IS NULL
     OR to_regprocedure('public.fn_validate_agendamento_component_stock(uuid)') IS NULL THEN
    RAISE EXCEPTION 'kit_functions_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_confirmar_baixa_estoque_pedido'
      AND tgrelid = 'public.pedidos'::regclass
  ) THEN
    RAISE EXCEPTION 'stock_finalization_trigger_missing';
  END IF;
END;
$$;
