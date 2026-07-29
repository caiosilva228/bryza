import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IdempotencyCoordinator,
  normalizeCustomerCpf,
  normalizeCustomerPhone,
  resolveCustomerIdentity,
} from './identity-rules.ts';

test('normalizes Brazilian mobile and landline phones with or without masks', () => {
  assert.equal(
    normalizeCustomerPhone('(11) 98765-4321'),
    normalizeCustomerPhone('11987654321'),
  );
  assert.equal(
    normalizeCustomerPhone('(11) 3456-7890'),
    normalizeCustomerPhone('1134567890'),
  );
});

test('normalizes an explicit Brazilian country code and rejects invalid phone lengths', () => {
  assert.equal(
    normalizeCustomerPhone('+55 (11) 98765-4321'),
    '11987654321',
  );
  assert.throws(
    () => normalizeCustomerPhone('(11) 9876-543'),
    /invalid_customer_phone/,
  );
  assert.throws(
    () => normalizeCustomerPhone(null),
    /invalid_customer_phone/,
  );
});

test('normalizes CPF with or without a mask and preserves omission as null', () => {
  assert.equal(
    normalizeCustomerCpf('529.982.247-25'),
    normalizeCustomerCpf('52998224725'),
  );
  assert.equal(normalizeCustomerCpf(''), null);
  assert.equal(normalizeCustomerCpf(undefined), null);
  assert.throws(
    () => normalizeCustomerCpf('529.982.247-2'),
    /invalid_customer_cpf/,
  );
});

test('requires manual review for an unverified phone-only identity match', () => {
  assert.deepEqual(resolveCustomerIdentity({
    matches: [{ personId: 'person-a', identifier: 'phone' }],
  }), {
    outcome: 'manual_review_required',
    reason: 'unverified_identifier_matches_existing_person',
    candidatePersonIds: ['person-a'],
  });
});

test('reuses a single CPF-verified person and does not split masked identities', () => {
  const phoneA = normalizeCustomerPhone('(11) 98765-4321');
  const phoneB = normalizeCustomerPhone('11987654321');
  const cpfA = normalizeCustomerCpf('529.982.247-25');
  const cpfB = normalizeCustomerCpf('52998224725');

  assert.equal(phoneA, phoneB);
  assert.equal(cpfA, cpfB);
  assert.deepEqual(resolveCustomerIdentity({
    matches: [
      { personId: 'person-a', identifier: 'phone' },
      { personId: 'person-a', identifier: 'cpf' },
    ],
  }), {
    outcome: 'reuse_person',
    personId: 'person-a',
  });
});

test('sends conflicting identifiers to manual review instead of merging people', () => {
  assert.deepEqual(resolveCustomerIdentity({
    matches: [
      { personId: 'person-phone', identifier: 'phone' },
      { personId: 'person-cpf', identifier: 'cpf' },
    ],
  }), {
    outcome: 'manual_review_required',
    reason: 'identifiers_point_to_different_people',
    candidatePersonIds: ['person-cpf', 'person-phone'],
  });
});

test('prevents an update from moving a customer to another matched person', () => {
  assert.deepEqual(resolveCustomerIdentity({
    currentPersonId: 'current-person',
    matches: [{ personId: 'other-person', identifier: 'cpf' }],
  }), {
    outcome: 'manual_review_required',
    reason: 'identifier_conflicts_with_current_person',
    candidatePersonIds: ['other-person'],
  });
});

test('coalesces concurrent requests with the same key and normalized payload', async () => {
  const coordinator = new IdempotencyCoordinator<{ customerId: string }>();
  let executions = 0;
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const operation = async () => {
    executions += 1;
    await blocked;
    return { customerId: 'customer-a' };
  };

  const first = coordinator.run('request-key', 'normalized-payload', operation);
  const second = coordinator.run('request-key', 'normalized-payload', operation);
  release();

  assert.deepEqual(await Promise.all([first, second]), [
    { value: { customerId: 'customer-a' }, replayed: false },
    { value: { customerId: 'customer-a' }, replayed: true },
  ]);
  assert.equal(executions, 1);
});

test('rejects concurrent reuse of an idempotency key with a different payload', async () => {
  const coordinator = new IdempotencyCoordinator<string>();
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = coordinator.run('request-key', 'payload-a', async () => {
    await blocked;
    return 'created';
  });

  await assert.rejects(
    coordinator.run('request-key', 'payload-b', () => 'duplicate'),
    /idempotency_conflict/,
  );
  release();
  assert.deepEqual(await first, { value: 'created', replayed: false });
});

test('allows a failed idempotent operation to be retried', async () => {
  const coordinator = new IdempotencyCoordinator<string>();

  await assert.rejects(
    coordinator.run('request-key', 'payload', () => {
      throw new Error('temporary_failure');
    }),
    /temporary_failure/,
  );

  assert.deepEqual(
    await coordinator.run('request-key', 'payload', () => 'created'),
    { value: 'created', replayed: false },
  );
});
