import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateKitPrice, calculateKitAvailability } from './kit-calculations.ts';

test('kit availability uses the limiting component', () => {
  assert.equal(calculateKitAvailability([
    { quantidade: 2, estoqueDisponivel: 10 },
    { quantidade: 1, estoqueDisponivel: 3 },
  ]), 3);
});

test('kit quantity two consumes the proportional component quantity', () => {
  assert.equal(calculateKitAvailability([
    { quantidade: 2, estoqueDisponivel: 3 },
    { quantidade: 3, estoqueDisponivel: 9 },
  ]), 1);
});

test('closed kit price allocation closes exactly after rounding', () => {
  const lines = allocateKitPrice([39.99, 19.99, 5], 49.9);
  assert.equal(Number(lines.reduce((sum, line) => sum + line.valorLiquido, 0).toFixed(2)), 49.9);
  assert.equal(Number(lines.reduce((sum, line) => sum + line.desconto, 0).toFixed(2)), 15.08);
});
