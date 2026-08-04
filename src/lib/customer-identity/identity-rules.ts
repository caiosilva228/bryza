import {
  isValidBrazilPhone,
  normalizeCustomerCpf as normalizeCpfValue,
  normalizeCustomerPhone as normalizePhoneValue,
} from '../customers/canonical-identity.ts';

export type IdentityIdentifier = 'phone' | 'cpf' | 'email';

export type IdentityMatch = {
  personId: string;
  identifier: IdentityIdentifier;
};

export type IdentityResolution =
  | { outcome: 'create_person' }
  | { outcome: 'reuse_person'; personId: string }
  | { outcome: 'keep_person'; personId: string }
  | {
      outcome: 'manual_review_required';
      reason:
        | 'identifiers_point_to_different_people'
        | 'identifier_conflicts_with_current_person'
        | 'unverified_identifier_matches_existing_person';
      candidatePersonIds: string[];
    };

/**
 * Mirrors the public canonical customer RPC: formatting and an optional
 * Brazilian country code are ignored.
 */
export function normalizeCustomerPhone(
  value: string | null | undefined,
): string {
  const normalized = normalizePhoneValue(value);

  if (!isValidBrazilPhone(normalized)) {
    throw new Error('invalid_customer_phone');
  }

  return normalized;
}

/**
 * Mirrors the canonical customer RPC: an omitted CPF stays null and a
 * provided CPF must normalize to exactly 11 ASCII digits.
 *
 * The database currently validates shape, not CPF check digits.
 */
export function normalizeCustomerCpf(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeCpfValue(value);

  if (normalized === null) {
    return null;
  }
  if (!/^[0-9]{11}$/.test(normalized)) {
    throw new Error('invalid_customer_cpf');
  }

  return normalized;
}

/**
 * Pure representation of the identity-candidate branch in
 * fn_upsert_customer_canonical. CPF is the verified identifier; a new
 * customer matched only by phone/e-mail must be reviewed manually.
 */
export function resolveCustomerIdentity(input: {
  currentPersonId?: string | null;
  matches: IdentityMatch[];
}): IdentityResolution {
  const currentPersonId = input.currentPersonId ?? null;
  const candidatePersonIds = [...new Set(
    input.matches.map((match) => match.personId),
  )].sort();
  const cpfCandidate = input.matches.find(
    (match) => match.identifier === 'cpf',
  )?.personId ?? null;

  if (candidatePersonIds.length > 1) {
    return {
      outcome: 'manual_review_required',
      reason: 'identifiers_point_to_different_people',
      candidatePersonIds,
    };
  }

  if (
    currentPersonId
    && candidatePersonIds.length === 1
    && candidatePersonIds[0] !== currentPersonId
  ) {
    return {
      outcome: 'manual_review_required',
      reason: 'identifier_conflicts_with_current_person',
      candidatePersonIds,
    };
  }

  if (!currentPersonId && candidatePersonIds.length === 1 && !cpfCandidate) {
    return {
      outcome: 'manual_review_required',
      reason: 'unverified_identifier_matches_existing_person',
      candidatePersonIds,
    };
  }

  if (currentPersonId) {
    return { outcome: 'keep_person', personId: currentPersonId };
  }

  if (candidatePersonIds.length === 1) {
    return { outcome: 'reuse_person', personId: candidatePersonIds[0] };
  }

  return { outcome: 'create_person' };
}

export type IdempotentResult<T> = {
  value: T;
  replayed: boolean;
};

type PendingOperation<T> = {
  payloadFingerprint: string;
  promise: Promise<T>;
};

/**
 * In-memory single-flight coordinator used to verify the expected contract:
 * concurrent equivalent operations share one execution, while reusing a key
 * with a different normalized payload is rejected.
 *
 * Durable cross-process idempotency remains the database's responsibility.
 */
export class IdempotencyCoordinator<T> {
  readonly #operations = new Map<string, PendingOperation<T>>();

  async run(
    key: string,
    payloadFingerprint: string,
    operation: () => Promise<T> | T,
  ): Promise<IdempotentResult<T>> {
    const existing = this.#operations.get(key);

    if (existing) {
      if (existing.payloadFingerprint !== payloadFingerprint) {
        throw new Error('idempotency_conflict');
      }

      return {
        value: await existing.promise,
        replayed: true,
      };
    }

    const promise = Promise.resolve().then(operation);
    const pending = { payloadFingerprint, promise };
    this.#operations.set(key, pending);

    try {
      return {
        value: await promise,
        replayed: false,
      };
    } catch (error) {
      if (this.#operations.get(key) === pending) {
        this.#operations.delete(key);
      }
      throw error;
    }
  }
}
