import { redirect } from 'next/navigation';
import {
  CustomerAccountNotLinkedError,
  CustomerAccountUnauthorizedError,
  listCustomerAccountOrders,
} from '@/lib/customer-account';
import { OrdersPageView } from '../components';
import {
  normalizeOrderStatus,
  normalizePaymentStatus,
  toOrderSummary,
} from '../view-model';

const allowedFilters = new Set([
  'todos',
  'ativos',
  'pagamento_pendente',
  'entregues',
]);

async function loadOrders() {
  try {
    return await listCustomerAccountOrders({ limit: 50 });
  } catch (error) {
    if (error instanceof CustomerAccountUnauthorizedError) {
      redirect(
        '/loja?login=required&retorno=/loja/minha-conta/pedidos',
      );
    }
    if (error instanceof CustomerAccountNotLinkedError) {
      redirect('/loja/minha-conta?estado=sem-vinculo');
    }
    throw error;
  }
}

export default async function CustomerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const query = await searchParams;
  const requested = Array.isArray(query.status) ? query.status[0] : query.status;
  const activeFilter = requested && allowedFilters.has(requested)
    ? requested
    : 'todos';
  const result = await loadOrders();
  const filtered = result.items.filter((order) => {
    const fulfillment = normalizeOrderStatus(order.fulfillment_status);
    const payment = normalizePaymentStatus(order.payment_status);

    if (activeFilter === 'ativos') {
      return !['entregue', 'cancelado'].includes(fulfillment);
    }
    if (activeFilter === 'pagamento_pendente') {
      return ['pendente', 'nao_iniciado'].includes(payment);
    }
    if (activeFilter === 'entregues') {
      return fulfillment === 'entregue';
    }
    return true;
  });

  return (
    <OrdersPageView
      activeFilter={activeFilter}
      orders={filtered.map(toOrderSummary)}
    />
  );
}
