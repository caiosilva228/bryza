import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateEarnings } from './earnings-calculation.ts';

const levels = [
  { percentage: 4 },
  { percentage: 2 },
  { percentage: 1 },
];

test('calcula o bônus de primeira compra separado da comissão mensal', () => {
  const result = calculateEarnings({
    goal: 1000,
    months: 6,
    monthlyVolume: 100,
    duplication: 5,
    levels,
    firstPurchaseBonus: { enabled: true, minimumAmount: 79, amount: 7 },
  });

  assert.equal(result.directReferrals, 26);
  assert.deepEqual(result.people, [26, 130, 650]);
  assert.equal(result.projectedMonthly, 1014);
  assert.equal(result.firstPurchaseBonusEligible, true);
  assert.equal(result.firstPurchaseBonusTotal, 182);
  assert.equal(result.firstPurchaseBonusMonthlyAverage, 182 / 6);
});

test('não projeta bônus quando o volume está abaixo da compra mínima', () => {
  const result = calculateEarnings({
    goal: 1000,
    months: 6,
    monthlyVolume: 50,
    duplication: 5,
    levels,
    firstPurchaseBonus: { enabled: true, minimumAmount: 79, amount: 7 },
  });

  assert.equal(result.firstPurchaseBonusEligible, false);
  assert.equal(result.firstPurchaseBonusTotal, 0);
  assert.equal(result.firstPurchaseBonusMonthlyAverage, 0);
});

test('não projeta bônus quando a configuração está desativada', () => {
  const result = calculateEarnings({
    goal: 1000,
    months: 6,
    monthlyVolume: 100,
    duplication: 5,
    levels,
    firstPurchaseBonus: { enabled: false, minimumAmount: 79, amount: 7 },
  });

  assert.equal(result.firstPurchaseBonusEligible, false);
  assert.equal(result.firstPurchaseBonusTotal, 0);
});
