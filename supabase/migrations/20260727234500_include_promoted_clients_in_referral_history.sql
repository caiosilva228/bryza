BEGIN;

CREATE OR REPLACE FUNCTION public.fn_get_clientes_indicados(
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_ambassador_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_sort_by text DEFAULT NULL,
  p_sort_order text DEFAULT 'desc'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_total bigint;
  v_items jsonb;
  v_order_dir text;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100
     OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid_referral_pagination' USING ERRCODE = '22023';
  END IF;

  v_order_dir := CASE
    WHEN lower(coalesce(p_sort_order, 'desc')) = 'asc' THEN 'ASC'
    ELSE 'DESC'
  END;

  SELECT count(*)
  INTO v_total
  FROM private.customer_ambassador_assignments ca
  JOIN public.ambassadors a ON a.id = ca.ambassador_id
  JOIN public.clientes c ON c.id = ca.customer_id
  WHERE ca.status = 'active'
    AND ca.is_validated
    AND c.lifecycle_status = 'active'
    AND (p_ambassador_id IS NULL OR ca.ambassador_id = p_ambassador_id)
    AND (p_status IS NULL OR c.status_cliente::text = p_status)
    AND (
      p_search IS NULL
      OR c.nome ILIKE '%' || p_search || '%'
      OR c.telefone ILIKE '%' || p_search || '%'
      OR c.email ILIKE '%' || p_search || '%'
    );

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      ca.id,
      c.id AS id_cliente,
      c.nome,
      coalesce(c.telefone, '') AS telefone,
      c.email,
      c.cidade,
      c.estado,
      c.status_cliente::text AS status_cliente,
      ca.created_at AS data_cadastro,
      coalesce(c.total_compras, 0) AS total_compras,
      coalesce(c.valor_total_gasto, 0) AS valor_total_gasto,
      coalesce(c.ticket_medio, 0) AS ticket_medio,
      ca.source AS referral_source,
      ca.status AS attribution_status,
      ca.is_commissionable,
      a.id AS ambassador_id,
      a.full_name AS ambassador_name,
      a.username AS ambassador_username,
      a.referral_code AS ambassador_referral_code,
      a.status AS ambassador_status
    FROM private.customer_ambassador_assignments ca
    JOIN public.ambassadors a ON a.id = ca.ambassador_id
    JOIN public.clientes c ON c.id = ca.customer_id
    WHERE ca.status = 'active'
      AND ca.is_validated
      AND c.lifecycle_status = 'active'
      AND (p_ambassador_id IS NULL OR ca.ambassador_id = p_ambassador_id)
      AND (p_status IS NULL OR c.status_cliente::text = p_status)
      AND (
        p_search IS NULL
        OR c.nome ILIKE '%' || p_search || '%'
        OR c.telefone ILIKE '%' || p_search || '%'
        OR c.email ILIKE '%' || p_search || '%'
      )
    ORDER BY
      CASE WHEN p_sort_by = 'nome' AND v_order_dir = 'ASC'
        THEN c.nome END ASC,
      CASE WHEN p_sort_by = 'nome' AND v_order_dir = 'DESC'
        THEN c.nome END DESC,
      CASE WHEN p_sort_by = 'telefone' AND v_order_dir = 'ASC'
        THEN c.telefone END ASC,
      CASE WHEN p_sort_by = 'telefone' AND v_order_dir = 'DESC'
        THEN c.telefone END DESC,
      CASE WHEN p_sort_by = 'cidade' AND v_order_dir = 'ASC'
        THEN c.cidade END ASC,
      CASE WHEN p_sort_by = 'cidade' AND v_order_dir = 'DESC'
        THEN c.cidade END DESC,
      CASE WHEN p_sort_by = 'status' AND v_order_dir = 'ASC'
        THEN c.status_cliente::text END ASC,
      CASE WHEN p_sort_by = 'status' AND v_order_dir = 'DESC'
        THEN c.status_cliente::text END DESC,
      CASE WHEN p_sort_by = 'ambassador_name' AND v_order_dir = 'ASC'
        THEN a.full_name END ASC,
      CASE WHEN p_sort_by = 'ambassador_name' AND v_order_dir = 'DESC'
        THEN a.full_name END DESC,
      CASE WHEN p_sort_by = 'compras' AND v_order_dir = 'ASC'
        THEN coalesce(c.total_compras, 0) END ASC,
      CASE WHEN p_sort_by = 'compras' AND v_order_dir = 'DESC'
        THEN coalesce(c.total_compras, 0) END DESC,
      CASE WHEN p_sort_by = 'total_gasto' AND v_order_dir = 'ASC'
        THEN coalesce(c.valor_total_gasto, 0) END ASC,
      CASE WHEN p_sort_by = 'total_gasto' AND v_order_dir = 'DESC'
        THEN coalesce(c.valor_total_gasto, 0) END DESC,
      CASE WHEN p_sort_by = 'data_cadastro' AND v_order_dir = 'ASC'
        THEN ca.created_at END ASC,
      CASE WHEN p_sort_by = 'data_cadastro' AND v_order_dir = 'DESC'
        THEN ca.created_at END DESC,
      CASE WHEN p_sort_by IS NULL THEN ca.created_at END DESC,
      ca.id DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  RETURN jsonb_build_object('items', v_items, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_clientes_indicados(
  integer, integer, text, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_get_clientes_indicados(
  integer, integer, text, uuid, text, text, text
) TO service_role;

COMMENT ON FUNCTION public.fn_get_clientes_indicados(
  integer, integer, text, uuid, text, text, text
) IS
  'Returns the complete validated referral history, including customers who later became ambassadors.';

COMMIT;
