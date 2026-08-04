import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoreSchedulingDate } from './scheduling-date.ts';

test('normalizes a store date-only value to business noon', () => {
  assert.equal(
    normalizeStoreSchedulingDate('2026-08-05'),
    '2026-08-05T15:00:00.000Z',
  );
});

test('accepts the displayed Brazilian date format', () => {
  assert.equal(
    normalizeStoreSchedulingDate('05/08/2026'),
    '2026-08-05T15:00:00.000Z',
  );
});

test('rejects empty and impossible calendar dates', () => {
  assert.equal(normalizeStoreSchedulingDate(''), null);
  assert.equal(normalizeStoreSchedulingDate('2026-02-30'), null);
  assert.equal(normalizeStoreSchedulingDate(undefined), null);
});
