BEGIN;

-- O MCP nunca recebe service_role. Estes objetos privados só são acessados por
-- funções estreitas e protegidas, ou pelo service_role usado no Auth Hook.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.mcp_approved_agents (
  client_id      TEXT PRIMARY KEY,
  display_name   TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 160),
  description    TEXT,
  environment    TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  resource_url   TEXT NOT NULL,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private.mcp_action_confirmations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id          TEXT NOT NULL,
  tool_name          TEXT NOT NULL CHECK (tool_name IN (
    'prepare_update_order_status',
    'prepare_update_route_status',
    'prepare_register_delivery_problem'
  )),
  entity_type        TEXT NOT NULL CHECK (entity_type IN ('pedido', 'rota')),
  entity_id          UUID NOT NULL,
  payload            JSONB NOT NULL,
  payload_hash       TEXT NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  preview            JSONB NOT NULL,
  token_hash         BYTEA NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'consumed', 'expired')),
  expires_at         TIMESTAMPTZ NOT NULL,
  approved_at        TIMESTAMPTZ,
  approved_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  consumed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_confirmations_actor_status
  ON private.mcp_action_confirmations(actor_id, status, expires_at);

CREATE TABLE IF NOT EXISTS private.mcp_rate_limit_counters (
  actor_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id      TEXT NOT NULL,
  bucket         TEXT NOT NULL CHECK (bucket IN ('read', 'prepare', 'execute')),
  window_start   TIMESTAMPTZ NOT NULL,
  hits           INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
  PRIMARY KEY (actor_id, client_id, bucket, window_start)
);

ALTER TABLE private.mcp_approved_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.mcp_action_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.mcp_rate_limit_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.mcp_approved_agents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.mcp_action_confirmations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.mcp_rate_limit_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.mcp_approved_agents TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE private.mcp_action_confirmations TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE private.mcp_rate_limit_counters TO service_role;

CREATE OR REPLACE FUNCTION private.mcp_payload_hash(
  p_tool_name TEXT,
  p_entity_id UUID,
  p_payload JSONB
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = pg_catalog, extensions
AS $$
  SELECT encode(
    extensions.digest(
      convert_to(p_tool_name || ':' || p_entity_id::TEXT || ':' || p_payload::TEXT, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_mcp_get_agent_details(
  p_client_id TEXT,
  p_resource_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
DECLARE
  v_profile RECORD;
  v_agent RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'mcp_auth_required';
  END IF;

  SELECT role::TEXT, ativo, must_change_password
  INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_profile IS NULL
     OR v_profile.ativo IS NOT TRUE
     OR v_profile.must_change_password IS TRUE
     OR v_profile.role NOT IN ('admin', 'vendedor', 'logistica', 'embaixador') THEN
    RETURN jsonb_build_object('allowed', FALSE);
  END IF;

  SELECT client_id, display_name, description, environment, resource_url, enabled
  INTO v_agent
  FROM private.mcp_approved_agents
  WHERE client_id = p_client_id
    AND resource_url = p_resource_url
    AND enabled IS TRUE;

  IF v_agent IS NULL THEN
    RETURN jsonb_build_object('allowed', FALSE);
  END IF;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'client_id', v_agent.client_id,
    'display_name', v_agent.display_name,
    'description', v_agent.description,
    'environment', v_agent.environment,
    'resource_url', v_agent.resource_url
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_mcp_validate_agent(
  p_client_id TEXT,
  p_resource_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
DECLARE
  v_profile RECORD;
  v_agent RECORD;
BEGIN
  IF auth.uid() IS NULL OR p_client_id IS DISTINCT FROM (auth.jwt() ->> 'client_id') THEN
    RETURN jsonb_build_object('allowed', FALSE);
  END IF;

  SELECT role::TEXT, ativo, must_change_password
  INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_profile IS NULL
     OR v_profile.ativo IS NOT TRUE
     OR v_profile.must_change_password IS TRUE
     OR v_profile.role NOT IN ('admin', 'vendedor', 'logistica', 'embaixador') THEN
    RETURN jsonb_build_object('allowed', FALSE);
  END IF;

  SELECT client_id, display_name, resource_url, enabled
  INTO v_agent
  FROM private.mcp_approved_agents
  WHERE client_id = p_client_id
    AND resource_url = p_resource_url
    AND enabled IS TRUE;

  IF v_agent IS NULL THEN
    RETURN jsonb_build_object('allowed', FALSE);
  END IF;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'display_name', v_agent.display_name,
    'resource_url', v_agent.resource_url
  );
END;
$$;

-- Chamado exclusivamente pelo Custom Access Token Hook com a credencial secreta
-- do projeto. Clientes regulares não conseguem consultar esta função.
CREATE OR REPLACE FUNCTION public.fn_mcp_get_agent_claims(p_client_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
DECLARE
  v_agent RECORD;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'mcp_service_role_required';
  END IF;

  SELECT client_id, display_name, resource_url, enabled
  INTO v_agent
  FROM private.mcp_approved_agents
  WHERE client_id = p_client_id
    AND enabled IS TRUE;

  IF v_agent IS NULL THEN
    RETURN jsonb_build_object('allowed', FALSE, 'claims', '{}'::JSONB);
  END IF;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'claims', jsonb_build_object(
      'aud', v_agent.resource_url,
      'mcp_agent', TRUE,
      'agent_name', v_agent.display_name
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_mcp_consume_rate_limit(
  p_bucket TEXT,
  p_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_client TEXT := auth.jwt() ->> 'client_id';
  v_limit INTEGER;
  v_window TIMESTAMPTZ := date_trunc('minute', now());
  v_hits INTEGER;
BEGIN
  IF v_actor IS NULL OR v_client IS NULL
     OR p_bucket NOT IN ('read', 'prepare', 'execute')
     OR p_count IS NULL OR p_count < 1 OR p_count > 100 THEN
    RETURN FALSE;
  END IF;

  v_limit := CASE p_bucket
    WHEN 'read' THEN 60
    WHEN 'prepare' THEN 10
    WHEN 'execute' THEN 5
  END;

  INSERT INTO private.mcp_rate_limit_counters(actor_id, client_id, bucket, window_start, hits)
  VALUES (v_actor, v_client, p_bucket, v_window, p_count)
  ON CONFLICT (actor_id, client_id, bucket, window_start)
  DO UPDATE SET hits = private.mcp_rate_limit_counters.hits + p_count
  RETURNING hits INTO v_hits;

  RETURN v_hits <= v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_mcp_create_confirmation(
  p_tool_name TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_payload JSONB,
  p_preview JSONB,
  p_client_id TEXT,
  p_resource_url TEXT,
  p_ttl_seconds INTEGER DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, public, extensions
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_client TEXT := auth.jwt() ->> 'client_id';
  v_role TEXT;
  v_token TEXT;
  v_hash TEXT;
  v_id UUID;
  v_expires TIMESTAMPTZ;
BEGIN
  IF v_actor IS NULL OR p_client_id IS DISTINCT FROM v_client THEN
    RAISE EXCEPTION 'mcp_confirmation_actor_invalid';
  END IF;
  IF p_tool_name NOT IN ('prepare_update_order_status', 'prepare_update_route_status', 'prepare_register_delivery_problem') THEN
    RAISE EXCEPTION 'mcp_confirmation_tool_invalid';
  END IF;
  IF p_entity_type NOT IN ('pedido', 'rota') OR p_entity_id IS NULL THEN
    RAISE EXCEPTION 'mcp_confirmation_entity_invalid';
  END IF;
  IF p_ttl_seconds < 60 OR p_ttl_seconds > 900 THEN
    RAISE EXCEPTION 'mcp_confirmation_ttl_invalid';
  END IF;
  IF octet_length(coalesce(p_payload, '{}'::JSONB)::TEXT) > 12000
     OR octet_length(coalesce(p_preview, '{}'::JSONB)::TEXT) > 6000 THEN
    RAISE EXCEPTION 'mcp_confirmation_payload_too_large';
  END IF;

  SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = v_actor AND ativo IS TRUE AND must_change_password IS FALSE;
  IF v_role NOT IN ('admin', 'logistica') THEN
    RAISE EXCEPTION 'mcp_confirmation_role_invalid';
  END IF;

  IF p_tool_name = 'prepare_update_route_status' AND p_entity_type <> 'rota' THEN
    RAISE EXCEPTION 'mcp_confirmation_entity_invalid';
  END IF;
  IF p_tool_name <> 'prepare_update_route_status' AND p_entity_type <> 'pedido' THEN
    RAISE EXCEPTION 'mcp_confirmation_entity_invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM private.mcp_approved_agents
    WHERE client_id = p_client_id
      AND resource_url = p_resource_url
      AND enabled IS TRUE
  ) THEN
    RAISE EXCEPTION 'mcp_confirmation_client_invalid';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := private.mcp_payload_hash(p_tool_name, p_entity_id, p_payload);
  v_expires := now() + make_interval(secs => p_ttl_seconds);

  INSERT INTO private.mcp_action_confirmations(
    actor_id, client_id, tool_name, entity_type, entity_id,
    payload, payload_hash, preview, token_hash, expires_at
  )
  VALUES (
    v_actor, p_client_id, p_tool_name, p_entity_type, p_entity_id,
    p_payload, v_hash, p_preview,
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), v_expires
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'confirmation_id', v_id,
    'confirmation_token', v_token,
    'payload_hash', v_hash,
    'expires_at', v_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_mcp_get_confirmation(p_confirmation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
DECLARE
  v_confirmation RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'mcp_auth_required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND ativo IS TRUE
      AND must_change_password IS FALSE
      AND role::TEXT IN ('admin', 'logistica')
  ) THEN
    RAISE EXCEPTION 'mcp_confirmation_role_invalid';
  END IF;

  SELECT id, actor_id, client_id, tool_name, entity_type, entity_id,
         payload_hash, preview, status, expires_at
  INTO v_confirmation
  FROM private.mcp_action_confirmations
  WHERE id = p_confirmation_id
    AND actor_id = auth.uid()
    AND status IN ('pending', 'approved');

  IF v_confirmation IS NULL THEN
    RAISE EXCEPTION 'mcp_confirmation_not_found';
  END IF;
  IF v_confirmation.expires_at <= now() THEN
    UPDATE private.mcp_action_confirmations SET status = 'expired' WHERE id = p_confirmation_id;
    RAISE EXCEPTION 'mcp_confirmation_expired';
  END IF;

  RETURN jsonb_build_object(
    'confirmation_id', v_confirmation.id,
    'client_id', v_confirmation.client_id,
    'tool_name', v_confirmation.tool_name,
    'entity_type', v_confirmation.entity_type,
    'entity_id', v_confirmation.entity_id,
    'payload_hash', v_confirmation.payload_hash,
    'preview', v_confirmation.preview,
    'status', v_confirmation.status,
    'expires_at', v_confirmation.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_mcp_approve_confirmation(
  p_confirmation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
DECLARE
  v_confirmation RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'mcp_auth_required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND ativo IS TRUE
      AND must_change_password IS FALSE
      AND role::TEXT IN ('admin', 'logistica')
  ) THEN
    RAISE EXCEPTION 'mcp_confirmation_role_invalid';
  END IF;

  SELECT * INTO v_confirmation
  FROM private.mcp_action_confirmations
  WHERE id = p_confirmation_id
    AND actor_id = auth.uid()
  FOR UPDATE;

  IF v_confirmation IS NULL OR v_confirmation.status <> 'pending' THEN
    RAISE EXCEPTION 'mcp_confirmation_not_pending';
  END IF;
  IF v_confirmation.expires_at <= now() THEN
    UPDATE private.mcp_action_confirmations SET status = 'expired' WHERE id = p_confirmation_id;
    RAISE EXCEPTION 'mcp_confirmation_expired';
  END IF;
  UPDATE private.mcp_action_confirmations
  SET status = 'approved', approved_at = now(), approved_by = auth.uid()
  WHERE id = p_confirmation_id;

  RETURN jsonb_build_object('approved', TRUE, 'confirmation_id', p_confirmation_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_mcp_execute_confirmed_action(
  p_confirmation_id UUID,
  p_confirmation_token TEXT,
  p_tool_name TEXT,
  p_entity_id UUID,
  p_payload_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, public, extensions
AS $$
DECLARE
  v_confirmation RECORD;
  v_role TEXT;
  v_payload JSONB;
  v_next_status TEXT;
  v_problem_type TEXT;
  v_next_action TEXT;
  v_notes TEXT;
  v_order RECORD;
  v_route RECORD;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR p_tool_name NOT IN (
    'prepare_update_order_status',
    'prepare_update_route_status',
    'prepare_register_delivery_problem'
  ) THEN
    RAISE EXCEPTION 'mcp_confirmation_invalid';
  END IF;

  SELECT * INTO v_confirmation
  FROM private.mcp_action_confirmations
  WHERE id = p_confirmation_id
  FOR UPDATE;

  IF v_confirmation IS NULL
     OR v_confirmation.actor_id <> auth.uid()
     OR v_confirmation.client_id IS DISTINCT FROM (auth.jwt() ->> 'client_id')
     OR v_confirmation.tool_name IS DISTINCT FROM p_tool_name
     OR v_confirmation.entity_id IS DISTINCT FROM p_entity_id
     OR v_confirmation.payload_hash IS DISTINCT FROM lower(p_payload_hash)
     OR v_confirmation.status <> 'approved'
     OR v_confirmation.expires_at <= now()
     OR v_confirmation.token_hash IS DISTINCT FROM extensions.digest(convert_to(p_confirmation_token, 'UTF8'), 'sha256') THEN
    IF v_confirmation IS NOT NULL AND v_confirmation.expires_at <= now() THEN
      UPDATE private.mcp_action_confirmations SET status = 'expired' WHERE id = p_confirmation_id;
    END IF;
    RAISE EXCEPTION 'mcp_confirmation_invalid';
  END IF;

  SELECT role::TEXT INTO v_role
  FROM public.profiles
  WHERE id = auth.uid() AND ativo IS TRUE AND must_change_password IS FALSE;
  IF v_role NOT IN ('admin', 'logistica') THEN RAISE EXCEPTION 'mcp_role_invalid'; END IF;

  v_payload := v_confirmation.payload;
  IF private.mcp_payload_hash(p_tool_name, p_entity_id, v_payload) IS DISTINCT FROM lower(p_payload_hash) THEN
    RAISE EXCEPTION 'mcp_confirmation_payload_changed';
  END IF;

  IF p_tool_name = 'prepare_update_order_status' THEN
    v_next_status := v_payload ->> 'next_status';
    IF v_next_status NOT IN ('pronto_para_entrega', 'em_rota', 'entregue', 'cancelado') THEN
      RAISE EXCEPTION 'mcp_order_status_not_allowed';
    END IF;

    SELECT id, numero_pedido, status_pedido INTO v_order
    FROM public.pedidos
    WHERE id = p_entity_id
    FOR UPDATE;
    IF v_order IS NULL THEN RAISE EXCEPTION 'mcp_order_not_found'; END IF;

    UPDATE public.pedidos
    SET status_pedido = v_next_status,
        delivery_started_at = CASE
          WHEN v_next_status = 'em_rota' THEN coalesce(delivery_started_at, now())
          ELSE delivery_started_at
        END,
        delivered_at = CASE
          WHEN v_next_status = 'entregue' THEN coalesce(delivered_at, now())
          ELSE delivered_at
        END,
        updated_at = now()
    WHERE id = p_entity_id;

    v_result := jsonb_build_object(
      'entity_type', 'pedido',
      'entity_id', p_entity_id,
      'order_number', v_order.numero_pedido,
      'previous_status', v_order.status_pedido,
      'status', v_next_status
    );
  ELSIF p_tool_name = 'prepare_update_route_status' THEN
    v_next_status := v_payload ->> 'next_status';
    IF v_next_status NOT IN ('Separando Produtos', 'Pronta para Sair', 'Em Andamento', 'Finalizada com Pendências', 'Cancelada') THEN
      RAISE EXCEPTION 'mcp_route_status_not_allowed';
    END IF;

    SELECT id, name, status INTO v_route
    FROM public.delivery_routes
    WHERE id = p_entity_id
    FOR UPDATE;
    IF v_route IS NULL THEN RAISE EXCEPTION 'mcp_route_not_found'; END IF;

    UPDATE public.delivery_routes
    SET status = v_next_status,
        started_at = CASE
          WHEN v_next_status = 'Em Andamento' THEN now()
          ELSE started_at
        END,
        finished_at = CASE
          WHEN v_next_status = 'Em Andamento' THEN NULL
          WHEN v_next_status = 'Finalizada com Pendências' THEN now()
          ELSE finished_at
        END,
        updated_at = now()
    WHERE id = p_entity_id;

    v_result := jsonb_build_object(
      'entity_type', 'rota',
      'entity_id', p_entity_id,
      'route_name', v_route.name,
      'previous_status', v_route.status,
      'status', v_next_status
    );
  ELSE
    v_problem_type := v_payload ->> 'problem_type';
    v_next_action := v_payload ->> 'next_action';
    v_notes := v_payload ->> 'notes';
    IF v_problem_type NOT IN ('cliente_nao_estava', 'endereco_errado', 'cliente_recusou', 'sem_dinheiro', 'pediu_reagendamento', 'produto_avariado', 'outro')
       OR v_next_action NOT IN ('keep', 'back_to_ready', 'cancel')
       OR v_notes IS NULL OR char_length(v_notes) NOT BETWEEN 1 AND 500
       OR v_notes ~* '(cpf|pix|senha|password|token|secret|hmac)'
       OR v_notes ~ '[0-9]{10,}' THEN
      RAISE EXCEPTION 'mcp_delivery_problem_not_allowed';
    END IF;

    SELECT id, numero_pedido, status_pedido INTO v_order
    FROM public.pedidos
    WHERE id = p_entity_id
    FOR UPDATE;
    IF v_order IS NULL THEN RAISE EXCEPTION 'mcp_order_not_found'; END IF;
    IF v_order.status_pedido NOT IN ('pronto_para_entrega', 'em_rota', 'entregue') THEN
      RAISE EXCEPTION 'mcp_delivery_problem_status_not_allowed';
    END IF;

    UPDATE public.pedidos
    SET delivery_problem_type = v_problem_type,
        delivery_notes = v_notes,
        status_pedido = CASE v_next_action
          WHEN 'back_to_ready' THEN 'pronto_para_entrega'
          WHEN 'cancel' THEN 'cancelado'
          ELSE status_pedido
        END,
        updated_at = now()
    WHERE id = p_entity_id;

    UPDATE public.delivery_route_orders
    SET status = 'Não Entregue',
        notes = v_problem_type || ': ' || v_notes,
        updated_at = now()
    WHERE order_id = p_entity_id
      AND status IN ('Pendente', 'Em Rota');

    v_result := jsonb_build_object(
      'entity_type', 'pedido',
      'entity_id', p_entity_id,
      'order_number', v_order.numero_pedido,
      'status', CASE v_next_action
        WHEN 'back_to_ready' THEN 'pronto_para_entrega'
        WHEN 'cancel' THEN 'cancelado'
        ELSE v_order.status_pedido
      END,
      'problem_type', v_problem_type
    );
  END IF;

  UPDATE private.mcp_action_confirmations
  SET status = 'consumed', consumed_at = now(), payload = '{}'::JSONB
  WHERE id = p_confirmation_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_mcp_record_audit(
  p_request_id TEXT,
  p_tool_name TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_result TEXT,
  p_latency_ms INTEGER,
  p_denial_code TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role TEXT;
  v_client TEXT := auth.jwt() ->> 'client_id';
BEGIN
  IF auth.uid() IS NULL OR v_client IS NULL THEN RAISE EXCEPTION 'mcp_audit_actor_invalid'; END IF;
  IF p_request_id IS NULL OR p_request_id !~ '^[A-Za-z0-9._:-]{8,100}$' THEN RAISE EXCEPTION 'mcp_audit_request_invalid'; END IF;
  IF p_tool_name IS NULL OR p_tool_name !~ '^[a-z0-9_]{1,80}$' THEN RAISE EXCEPTION 'mcp_audit_tool_invalid'; END IF;
  IF p_result NOT IN ('success', 'denied', 'error') THEN RAISE EXCEPTION 'mcp_audit_result_invalid'; END IF;
  IF p_entity_type IS NOT NULL AND p_entity_type NOT IN ('pedido', 'rota', 'mcp') THEN RAISE EXCEPTION 'mcp_audit_entity_invalid'; END IF;
  IF p_latency_ms IS NULL OR p_latency_ms < 0 OR p_latency_ms > 600000 THEN RAISE EXCEPTION 'mcp_audit_latency_invalid'; END IF;

  SELECT role::TEXT INTO v_role
  FROM public.profiles
  WHERE id = auth.uid() AND ativo IS TRUE AND must_change_password IS FALSE;
  IF v_role NOT IN ('admin', 'vendedor', 'logistica', 'embaixador') THEN RAISE EXCEPTION 'mcp_audit_role_invalid'; END IF;

  INSERT INTO public.audit_logs(actor_id, actor_role, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    v_role,
    'mcp.' || p_tool_name,
    coalesce(p_entity_type, 'mcp'),
    p_entity_id,
    jsonb_strip_nulls(jsonb_build_object(
      'mcp_client_id', v_client,
      'request_id', p_request_id,
      'result', p_result,
      'latency_ms', p_latency_ms,
      'denial_code', p_denial_code
    ))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_mcp_get_agent_details(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_mcp_validate_agent(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_mcp_get_agent_claims(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_mcp_consume_rate_limit(TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_mcp_create_confirmation(TEXT, TEXT, UUID, JSONB, JSONB, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_mcp_get_confirmation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_mcp_approve_confirmation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_mcp_execute_confirmed_action(UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_mcp_record_audit(TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_mcp_get_agent_details(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_mcp_validate_agent(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_mcp_get_agent_claims(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_mcp_consume_rate_limit(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_mcp_create_confirmation(TEXT, TEXT, UUID, JSONB, JSONB, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_mcp_get_confirmation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_mcp_approve_confirmation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_mcp_execute_confirmed_action(UUID, TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_mcp_record_audit(TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, TEXT) TO authenticated;

COMMENT ON TABLE private.mcp_approved_agents IS
  'Private allowlist of OAuth clients permitted to receive Bryza MCP claims. Maintain separately per environment.';
COMMENT ON TABLE private.mcp_action_confirmations IS
  'Short-lived, actor-bound and single-use MCP write confirmations. Payload is erased after successful execution.';
COMMENT ON FUNCTION public.fn_mcp_record_audit(TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, TEXT) IS
  'Appends MCP audit metadata without accepting raw arguments, PII, secrets or before/after snapshots.';

COMMIT;
