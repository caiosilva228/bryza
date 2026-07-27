import test from 'node:test';
import assert from 'node:assert/strict';
import { canRecognizeOrderPayment } from './payment-check.ts';

test('permite conferir pagamento pendente de pedido entregue', () => {
  assert.equal(canRecognizeOrderPayment({
    status_pedido: 'entregue',
    payment_check_status: 'pendente',
  }), true);
});

test('permite reconhecer pagamento pendente de pedido finalizado', () => {
  assert.equal(canRecognizeOrderPayment({
    status_pedido: 'finalizado',
    payment_check_status: 'pendente',
  }), true);
});

test('não permite conferir novamente um pagamento confirmado', () => {
  assert.equal(canRecognizeOrderPayment({
    status_pedido: 'finalizado',
    payment_check_status: 'confirmado',
  }), false);
});

test('não permite conferir pagamento antes da entrega', () => {
  assert.equal(canRecognizeOrderPayment({
    status_pedido: 'em_rota',
    payment_check_status: 'pendente',
  }), false);
});
