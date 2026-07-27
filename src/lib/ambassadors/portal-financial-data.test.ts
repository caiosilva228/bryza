import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCommissionChartMaximum,
  getCurrentCommission,
  normalizeCommissionChart,
  removeGrossOrderValues,
} from './portal-financial-data.ts';

const months = [
  { mes: '2026-06', vendas_qtd: 0, vendas_valor: 0, comissao_valor: 0 },
  { mes: '2026-07', vendas_qtd: 2, vendas_valor: 114.8, comissao_valor: 4.59 },
];

test('usa a comissão, e não o faturamento, no resumo e no gráfico', () => {
  assert.equal(getCurrentCommission(months), 4.59);
  assert.equal(getCommissionChartMaximum(months), 4.59);
  assert.deepEqual(normalizeCommissionChart(months), [
    { mes: '2026-06', vendas_qtd: 0, comissao_valor: 0 },
    { mes: '2026-07', vendas_qtd: 2, comissao_valor: 4.59 },
  ]);
});

test('remove o valor bruto dos pedidos enviados ao portal', () => {
  assert.deepEqual(
    removeGrossOrderValues([
      {
        id: 'pedido-1',
        valor_total: 114.8,
        commission_amount: 4.59,
      },
    ]),
    [{ id: 'pedido-1', commission_amount: 4.59 }],
  );
});

test('mantém valores zerados quando ainda não há comissão', () => {
  assert.equal(getCurrentCommission([]), 0);
  assert.equal(getCommissionChartMaximum([]), 1);
});
