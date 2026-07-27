type PaymentCheckableOrder = {
  status_pedido: string;
  payment_check_status?: string | null;
};

export function canRecognizeOrderPayment(order: PaymentCheckableOrder): boolean {
  const supportsPaymentCheck = ['entregue', 'finalizado'].includes(order.status_pedido);
  const paymentAlreadyConfirmed = order.payment_check_status === 'confirmado';

  return supportsPaymentCheck && !paymentAlreadyConfirmed;
}
