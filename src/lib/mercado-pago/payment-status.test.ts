import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertPaymentMatchesIntent,
  validatePaymentStatusRequest,
} from './payment-status.ts';

const checkoutToken = '415799aa-f4a4-4cef-bff7-ace457b6b15c';
const externalReference = '43acead1-e670-4003-90db-1c2851c8984e';

test('accepts a checkout token without provider payment data', () => {
  assert.deepEqual(validatePaymentStatusRequest({ checkoutToken }), {
    checkoutToken,
    paymentId: null,
    externalReference: null,
  });
});

test('accepts the Mercado Pago return identity without session storage', () => {
  assert.deepEqual(validatePaymentStatusRequest({
    paymentId: '170147659307',
    externalReference,
  }), {
    checkoutToken: null,
    paymentId: '170147659307',
    externalReference,
  });
});

test('rejects incomplete or malformed identities', () => {
  assert.throws(
    () => validatePaymentStatusRequest({ paymentId: '170147659307' }),
    /missing_payment_identity/,
  );
  assert.throws(
    () => validatePaymentStatusRequest({
      paymentId: 'not-numeric',
      externalReference,
    }),
    /invalid_payment_id/,
  );
  assert.throws(
    () => validatePaymentStatusRequest({ checkoutToken: '../intent' }),
    /invalid_checkout_token/,
  );
});

test('requires provider payment id, reference, amount and currency to match', () => {
  const intent = {
    external_reference: externalReference,
    expected_amount: '2.00',
    currency: 'BRL',
  };
  const payment = {
    id: 170147659307,
    external_reference: externalReference,
    transaction_amount: 2,
    currency_id: 'BRL',
  };

  assert.doesNotThrow(() => {
    assertPaymentMatchesIntent(payment, '170147659307', intent);
  });
  assert.throws(
    () => assertPaymentMatchesIntent(
      { ...payment, external_reference: checkoutToken },
      '170147659307',
      intent,
    ),
    /payment_intent_mismatch/,
  );
  assert.throws(
    () => assertPaymentMatchesIntent(
      { ...payment, transaction_amount: 2.02 },
      '170147659307',
      intent,
    ),
    /payment_intent_mismatch/,
  );
  assert.throws(
    () => assertPaymentMatchesIntent(
      { ...payment, currency_id: 'USD' },
      '170147659307',
      intent,
    ),
    /payment_intent_mismatch/,
  );
});
