-- Remote migration 20260724204558. Audit metadata remains allow-listed and cannot contain raw identity fields.
ALTER TABLE private.phase1_audit_events
  DROP CONSTRAINT IF EXISTS phase1_audit_events_metadata_check1;

ALTER TABLE private.phase1_audit_events
  ADD CONSTRAINT phase1_audit_events_metadata_check1
  CHECK (
    (
      metadata - ARRAY[
        'operation_scope',
        'operation_type',
        'conflict_types',
        'idempotency_key',
        'attempt_count',
        'actor_type',
        'customer_id',
        'auth_user_id',
        'ambassador_id',
        'invitation_id',
        'official_assignment_id',
        'terms_version',
        'expires_at',
        'valid_until',
        'resolution_code'
      ]
    ) = '{}'::jsonb
  ) NOT VALID;

COMMENT ON CONSTRAINT phase1_audit_events_metadata_check1
  ON private.phase1_audit_events
  IS 'Strict non-PII metadata allow-list. CPF, phone, e-mail, address, credentials, tokens and secrets are forbidden.';
