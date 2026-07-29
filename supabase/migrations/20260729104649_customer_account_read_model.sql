-- Customer account read model.
-- Base-table RLS remains unchanged: authenticated customers only receive the
-- explicitly projected fields returned by these functions.

CREATE OR REPLACE FUNCTION private.require_customer_account_context()
RETURNS TABLE(person_id uuid, customer_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'customer_account_unauthorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT pa.person_id, pbr.source_entity_id
  FROM private.person_accounts pa
  JOIN private.persons person ON person.id = pa.person_id
  JOIN private.person_business_roles pbr
    ON pbr.person_id = pa.person_id
   AND pbr.role_type = 'customer'
   AND pbr.status = 'active'
  JOIN public.clientes customer
    ON customer.id = pbr.source_entity_id
   AND customer.lifecycle_status = 'active'
  WHERE pa.auth_user_id = v_auth_user_id
    AND pa.status = 'active'
    AND person.status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_account_not_linked' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.require_customer_account_context()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_customer_account_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_person_id uuid;
  v_customer_id uuid;
  v_person private.persons%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_email_hint text;
  v_last_activity timestamptz;
BEGIN
  SELECT context.person_id, context.customer_id
  INTO v_person_id, v_customer_id
  FROM private.require_customer_account_context() context;

  SELECT * INTO v_person
  FROM private.persons
  WHERE id = v_person_id;

  SELECT * INTO v_customer
  FROM public.clientes
  WHERE id = v_customer_id;

  IF v_person.email_normalized IS NOT NULL
     AND v_person.email_normalized NOT LIKE '%@usuarios.bryza.internal' THEN
    v_email_hint :=
      left(split_part(v_person.email_normalized, '@', 1), 1)
      || '***@'
      || split_part(v_person.email_normalized, '@', 2);
  END IF;

  SELECT max(activity_at) INTO v_last_activity
  FROM (
    SELECT p.created_at AS activity_at
    FROM public.pedidos p WHERE p.cliente_id = v_customer_id
    UNION ALL
    SELECT a.created_at
    FROM public.agendamentos a WHERE a.cliente_id = v_customer_id
  ) activity;

  RETURN jsonb_build_object(
    'status', 'ok',
    'account', jsonb_build_object(
      'customer_code', 'C' || lpad(v_customer.codigo_cliente::text, 5, '0'),
      'full_name', v_person.full_name,
      'phone_last4', CASE
        WHEN v_person.phone_normalized IS NOT NULL
          THEN right(v_person.phone_normalized, 4)
        ELSE NULL
      END,
      'email_hint', v_email_hint,
      'cpf_last2', CASE
        WHEN v_person.cpf_normalized IS NOT NULL
          THEN right(v_person.cpf_normalized, 2)
        ELSE NULL
      END,
      'city', nullif(v_customer.cidade, ''),
      'state', nullif(v_customer.estado, '')
    ),
    'counts', jsonb_build_object(
      'orders', (
        SELECT count(*) FROM public.pedidos p
        WHERE p.cliente_id = v_customer_id
      ),
      'open_schedules', (
        SELECT count(*) FROM public.agendamentos a
        WHERE a.cliente_id = v_customer_id
          AND a.pedido_id IS NULL
          AND a.status::text <> 'cancelado'
      ),
      'pending_payments', (
        SELECT count(*)
        FROM (
          SELECT p.id
          FROM public.pedidos p
          WHERE p.cliente_id = v_customer_id
            AND p.payment_status IN ('pendente', 'processando', 'em_analise')
          UNION ALL
          SELECT a.id
          FROM public.agendamentos a
          WHERE a.cliente_id = v_customer_id
            AND a.pedido_id IS NULL
            AND a.payment_status IN ('pendente', 'processando', 'em_analise')
        ) pending
      )
    ),
    'last_activity_at', v_last_activity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_customer_account_summary()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_customer_account_summary()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_customer_list_orders(
  p_limit integer DEFAULT 20,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_customer_id uuid;
  v_limit integer := coalesce(p_limit, 20);
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_items jsonb;
  v_has_more boolean;
  v_next_created_at timestamptz;
  v_next_id uuid;
BEGIN
  IF v_limit NOT BETWEEN 1 AND 50
     OR ((p_cursor_created_at IS NULL) <> (p_cursor_id IS NULL))
     OR (v_status IS NOT NULL AND length(v_status) > 50) THEN
    RAISE EXCEPTION 'invalid_customer_order_query' USING ERRCODE = '22023';
  END IF;

  SELECT context.customer_id
  INTO v_customer_id
  FROM private.require_customer_account_context() context;

  WITH entries AS (
    SELECT
      'pedido'::text AS entity_type,
      p.id AS entity_id,
      p.numero_pedido AS number,
      p.created_at,
      p.updated_at,
      p.status_pedido AS fulfillment_status,
      p.payment_status,
      p.payment_timing,
      p.valor_total,
      NULL::timestamptz AS scheduled_for
    FROM public.pedidos p
    WHERE p.cliente_id = v_customer_id

    UNION ALL

    SELECT
      'agendamento'::text,
      a.id,
      a.numero_agendamento,
      a.created_at,
      a.updated_at,
      a.status::text,
      a.payment_status,
      a.payment_timing,
      a.valor_total,
      a.data_agendamento
    FROM public.agendamentos a
    WHERE a.cliente_id = v_customer_id
      AND a.pedido_id IS NULL
  ),
  filtered AS (
    SELECT
      e.*,
      (
        e.payment_timing = 'entrega'
        AND e.payment_status NOT IN (
          'aprovado', 'cancelado', 'reembolsado', 'chargeback'
        )
        AND e.fulfillment_status NOT IN (
          'cancelado', 'entregue', 'finalizado'
        )
      ) AS can_pay_now
    FROM entries e
    WHERE (
      v_status IS NULL
      OR lower(e.fulfillment_status) = v_status
      OR lower(e.payment_status) = v_status
    )
      AND (
        p_cursor_created_at IS NULL
        OR (e.created_at, e.entity_id) < (p_cursor_created_at, p_cursor_id)
      )
  ),
  page AS (
    SELECT
      f.*,
      row_number() OVER (
        ORDER BY f.created_at DESC, f.entity_id DESC
      ) AS row_number
    FROM filtered f
    ORDER BY f.created_at DESC, f.entity_id DESC
    LIMIT v_limit + 1
  )
  SELECT
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'entity_type', page.entity_type,
          'entity_id', page.entity_id,
          'number', page.number,
          'created_at', page.created_at,
          'updated_at', page.updated_at,
          'scheduled_for', page.scheduled_for,
          'fulfillment_status', page.fulfillment_status,
          'payment_status', page.payment_status,
          'payment_timing', page.payment_timing,
          'total', page.valor_total,
          'can_pay_now', page.can_pay_now
        )
        ORDER BY page.created_at DESC, page.entity_id DESC
      ) FILTER (WHERE page.row_number <= v_limit),
      '[]'::jsonb
    ),
    count(*) > v_limit,
    (array_agg(
      page.created_at ORDER BY page.created_at DESC, page.entity_id DESC
    ))[least(count(*)::integer, v_limit)],
    (array_agg(
      page.entity_id ORDER BY page.created_at DESC, page.entity_id DESC
    ))[least(count(*)::integer, v_limit)]
  INTO v_items, v_has_more, v_next_created_at, v_next_id
  FROM page;

  RETURN jsonb_build_object(
    'status', 'ok',
    'items', v_items,
    'has_more', v_has_more,
    'next_cursor', CASE
      WHEN v_has_more THEN jsonb_build_object(
        'created_at', v_next_created_at,
        'id', v_next_id
      )
      ELSE NULL
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_customer_list_orders(
  integer, timestamptz, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_customer_list_orders(
  integer, timestamptz, uuid, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_customer_order_detail(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_customer_id uuid;
  v_entity_type text := lower(btrim(coalesce(p_entity_type, '')));
  v_result jsonb;
BEGIN
  IF v_entity_type NOT IN ('pedido', 'agendamento') OR p_entity_id IS NULL THEN
    RAISE EXCEPTION 'invalid_customer_order_identity' USING ERRCODE = '22023';
  END IF;

  SELECT context.customer_id
  INTO v_customer_id
  FROM private.require_customer_account_context() context;

  IF v_entity_type = 'pedido' THEN
    SELECT jsonb_build_object(
      'status', 'ok',
      'order', jsonb_build_object(
        'entity_type', 'pedido',
        'entity_id', p.id,
        'number', p.numero_pedido,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'fulfillment_status', p.status_pedido,
        'payment', jsonb_build_object(
          'status', p.payment_status,
          'timing', p.payment_timing,
          'source', p.payment_source,
          'method', p.forma_pagamento,
          'paid_at', p.paid_at,
          'amount_received', p.amount_received
        ),
        'delivery', jsonb_build_object(
          'address', p.endereco_entrega,
          'neighborhood', p.bairro,
          'city', p.cidade,
          'state', p.estado,
          'postal_code', p.cep,
          'started_at', p.delivery_started_at,
          'delivered_at', p.delivered_at,
          'finalized_at', p.finalized_at
        ),
        'total', p.valor_total,
        'can_pay_now', (
          p.payment_timing = 'entrega'
          AND p.payment_status NOT IN (
            'aprovado', 'cancelado', 'reembolsado', 'chargeback'
          )
          AND p.status_pedido NOT IN (
            'cancelado', 'entregue', 'finalizado'
          )
        )
      ),
      'items', coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_name', product.nome_produto,
            'image_url', product.imagem_url,
            'quantity', item.quantidade,
            'unit_price', item.preco_unitario,
            'discount', item.desconto_aplicado,
            'subtotal', item.subtotal
          )
          ORDER BY item.created_at, item.id
        )
        FROM public.pedido_itens item
        LEFT JOIN public.produtos product ON product.id = item.produto_id
        WHERE item.pedido_id = p.id
      ), '[]'::jsonb)
    )
    INTO v_result
    FROM public.pedidos p
    WHERE p.id = p_entity_id
      AND p.cliente_id = v_customer_id;
  ELSE
    SELECT jsonb_build_object(
      'status', 'ok',
      'order', jsonb_build_object(
        'entity_type', 'agendamento',
        'entity_id', a.id,
        'number', a.numero_agendamento,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'scheduled_for', a.data_agendamento,
        'fulfillment_status', a.status::text,
        'payment', jsonb_build_object(
          'status', a.payment_status,
          'timing', a.payment_timing,
          'source', a.payment_source,
          'method', a.forma_pagamento,
          'paid_at', a.paid_at,
          'amount_received', CASE
            WHEN a.payment_status = 'aprovado' THEN a.valor_total
            ELSE NULL
          END
        ),
        'delivery', jsonb_build_object(
          'address', a.endereco_entrega,
          'neighborhood', a.bairro,
          'city', a.cidade,
          'state', a.estado,
          'postal_code', a.cep
        ),
        'total', a.valor_total,
        'can_pay_now', (
          a.payment_timing = 'entrega'
          AND a.payment_status NOT IN (
            'aprovado', 'cancelado', 'reembolsado', 'chargeback'
          )
          AND a.status::text NOT IN ('cancelado', 'convertido')
        )
      ),
      'items', coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_name', product.nome_produto,
            'image_url', product.imagem_url,
            'quantity', item.quantidade,
            'unit_price', item.preco_unitario,
            'discount', item.desconto_aplicado,
            'subtotal', item.subtotal
          )
          ORDER BY item.created_at, item.id
        )
        FROM public.agendamento_itens item
        LEFT JOIN public.produtos product ON product.id = item.produto_id
        WHERE item.agendamento_id = a.id
      ), '[]'::jsonb)
    )
    INTO v_result
    FROM public.agendamentos a
    WHERE a.id = p_entity_id
      AND a.cliente_id = v_customer_id;
  END IF;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'customer_order_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_customer_order_detail(text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_customer_order_detail(text, uuid)
  TO authenticated;

-- Service-only bridge called after Supabase Auth has verified an identifier.
-- It never trusts request-supplied e-mail/phone and never returns PII.
CREATE OR REPLACE FUNCTION public.fn_service_link_customer_auth_account(
  p_auth_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_email text;
  v_phone text;
  v_email_fp bytea;
  v_phone_fp bytea;
  v_candidates uuid[];
  v_person_id uuid;
  v_existing_by_person private.person_accounts%ROWTYPE;
  v_existing_by_user private.person_accounts%ROWTYPE;
  v_review_fp bytea;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_auth_user' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_user
  FROM auth.users
  WHERE id = p_auth_user_id
    AND deleted_at IS NULL
    AND (banned_until IS NULL OR banned_until <= now())
  FOR SHARE;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_match');
  END IF;

  IF v_user.email_confirmed_at IS NOT NULL THEN
    v_email := nullif(lower(btrim(coalesce(v_user.email, ''))), '');
  END IF;
  IF v_user.phone_confirmed_at IS NOT NULL THEN
    v_phone := nullif(regexp_replace(coalesce(v_user.phone, ''), '[^0-9]', '', 'g'), '');
    IF v_phone ~ '^55[0-9]{10,11}$' THEN
      v_phone := substring(v_phone FROM 3);
    END IF;
  END IF;

  IF v_email IS NULL AND v_phone IS NULL THEN
    RETURN jsonb_build_object('status', 'no_match');
  END IF;

  IF v_email IS NOT NULL THEN
    v_email_fp := private.identity_hmac_internal(
      'email', v_email, 1::smallint
    );
  END IF;
  IF v_phone IS NOT NULL THEN
    v_phone_fp := private.identity_hmac_internal(
      'phone', v_phone, 1::smallint
    );
  END IF;

  SELECT coalesce(array_agg(DISTINCT f.person_id ORDER BY f.person_id), '{}'::uuid[])
  INTO v_candidates
  FROM private.person_identity_fingerprints f
  JOIN private.persons person
    ON person.id = f.person_id AND person.status = 'active'
  WHERE f.is_active
    AND (
      (v_email_fp IS NOT NULL
       AND f.identifier_type = 'email' AND f.fingerprint = v_email_fp)
      OR
      (v_phone_fp IS NOT NULL
       AND f.identifier_type = 'phone' AND f.fingerprint = v_phone_fp)
    );

  IF cardinality(v_candidates) = 0 THEN
    RETURN jsonb_build_object('status', 'no_match');
  END IF;

  IF cardinality(v_candidates) > 1 THEN
    v_review_fp := private.identity_hmac_internal(
      'review',
      'customer_auth_link:' || p_auth_user_id::text,
      1::smallint
    );
    PERFORM private.persist_identity_review_internal(
      p_auth_user_id,
      v_review_fp,
      ARRAY['verified_auth_identifiers_point_to_different_people'],
      'customer_auth_account_link',
      v_candidates,
      'auth_user',
      p_auth_user_id
    );
    RETURN jsonb_build_object('status', 'manual_review');
  END IF;

  v_person_id := v_candidates[1];
  PERFORM pg_advisory_xact_lock(
    hashtextextended('customer_auth_user:' || p_auth_user_id::text, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('customer_auth_person:' || v_person_id::text, 0)
  );

  SELECT * INTO v_existing_by_person
  FROM private.person_accounts
  WHERE person_id = v_person_id
  FOR UPDATE;

  SELECT * INTO v_existing_by_user
  FROM private.person_accounts
  WHERE auth_user_id = p_auth_user_id
  FOR UPDATE;

  IF (
    v_existing_by_person.id IS NOT NULL
    AND (
      v_existing_by_person.auth_user_id <> p_auth_user_id
      OR v_existing_by_person.status <> 'active'
    )
  ) OR (
    v_existing_by_user.id IS NOT NULL
    AND (
      v_existing_by_user.person_id <> v_person_id
      OR v_existing_by_user.status <> 'active'
    )
  ) THEN
    v_review_fp := private.identity_hmac_internal(
      'review',
      'customer_auth_account_conflict:' || p_auth_user_id::text,
      1::smallint
    );
    PERFORM private.persist_identity_review_internal(
      p_auth_user_id,
      v_review_fp,
      ARRAY['canonical_person_account_one_to_one_conflict'],
      'customer_auth_account_link',
      ARRAY[v_person_id],
      'auth_user',
      p_auth_user_id
    );
    RETURN jsonb_build_object('status', 'manual_review');
  END IF;

  IF v_existing_by_person.id IS NULL AND v_existing_by_user.id IS NULL THEN
    INSERT INTO private.person_accounts (
      person_id, auth_user_id, status, linked_by
    ) VALUES (
      v_person_id, p_auth_user_id, 'active', NULL
    );
  END IF;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  ) VALUES (
    p_auth_user_id,
    'customer_auth_account_linked',
    'person_account',
    v_person_id,
    'linked',
    jsonb_build_object('link_source', 'verified_auth_identifier')
  );

  RETURN jsonb_build_object('status', 'linked');
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_link_customer_auth_account(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_link_customer_auth_account(uuid)
  TO service_role;

COMMENT ON FUNCTION public.fn_customer_account_summary()
IS 'Returns a masked summary for the customer linked to auth.uid().';
COMMENT ON FUNCTION public.fn_customer_list_orders(integer, timestamptz, uuid, text)
IS 'Returns a cursor-paginated, curated order/schedule list for auth.uid().';
COMMENT ON FUNCTION public.fn_customer_order_detail(text, uuid)
IS 'Returns curated details only when the entity belongs to auth.uid().';
COMMENT ON FUNCTION public.fn_service_link_customer_auth_account(uuid)
IS 'Service-only account linker using confirmed identifiers from auth.users.';
