-- Atribuições encerradas preservam a natureza histórica do vínculo.
-- A vigência é determinada exclusivamente por status/valid_until.
ALTER TABLE private.customer_ambassador_assignments
  DROP CONSTRAINT IF EXISTS customer_ambassador_assignments_check1;

ALTER TABLE private.customer_ambassador_assignments
  ADD CONSTRAINT customer_ambassador_assignments_validated_if_commissionable
  CHECK (NOT is_commissionable OR is_validated)
  NOT VALID;

ALTER TABLE private.customer_ambassador_assignments
  VALIDATE CONSTRAINT
    customer_ambassador_assignments_validated_if_commissionable;
