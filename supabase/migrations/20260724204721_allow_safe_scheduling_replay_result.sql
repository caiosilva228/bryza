-- Remote migration 20260724204721.
ALTER TABLE private.operation_idempotency
  DROP CONSTRAINT IF EXISTS operation_idempotency_original_result_check1;

ALTER TABLE private.operation_idempotency
  ADD CONSTRAINT operation_idempotency_original_result_check1
  CHECK (
    (
      original_result - ARRAY[
        'status',
        'code',
        'entity_id',
        'review_id',
        'operation_id',
        'agendamento_id',
        'numero_agendamento',
        'data_agendamento',
        'valor_total',
        'program_invitation_available'
      ]
    ) = '{}'::jsonb
  ) NOT VALID;

ALTER TABLE private.operation_idempotency
  ADD CONSTRAINT operation_idempotency_scheduling_id_check
  CHECK (
    NOT (original_result ? 'agendamento_id')
    OR (original_result->>'agendamento_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) NOT VALID;

COMMENT ON CONSTRAINT operation_idempotency_original_result_check1
  ON private.operation_idempotency
  IS 'Safe replay allow-list. It excludes names, CPF, e-mail, phone, address, tokens, credentials and secrets.';
