-- Remote migration 20260724200437. PostgreSQL resolves numeric literals as integer. Keep the smallint key-version
-- storage while providing an explicit internal compatibility overload.
CREATE OR REPLACE FUNCTION private.identity_hmac_internal(
  p_identifier_type text,
  p_normalized_value text,
  p_key_version integer
)
RETURNS bytea
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT private.identity_hmac_internal(
    p_identifier_type,
    p_normalized_value,
    p_key_version::smallint
  );
$$;

REVOKE ALL ON FUNCTION private.identity_hmac_internal(text, text, integer)
  FROM PUBLIC, anon, authenticated;
