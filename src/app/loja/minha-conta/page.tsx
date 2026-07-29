import { redirect } from 'next/navigation';
import {
  CustomerAccountNotLinkedError,
  CustomerAccountUnauthorizedError,
  getCustomerAccountSummary,
  listCustomerAccountOrders,
} from '@/lib/customer-account';
import { AccountDashboard } from './components';
import { AccountNotLinked } from './components';
import { toAccountSummary } from './view-model';

async function loadAccount() {
  try {
    return await Promise.all([
      getCustomerAccountSummary(),
      listCustomerAccountOrders({ limit: 3 }),
    ]);
  } catch (error) {
    if (error instanceof CustomerAccountUnauthorizedError) {
      redirect(
        '/loja?login=required&retorno=/loja/minha-conta',
      );
    }
    if (error instanceof CustomerAccountNotLinkedError) {
      return null;
    }
    throw error;
  }
}

export default async function CustomerAccountPage() {
  const account = await loadAccount();
  if (!account) return <AccountNotLinked />;
  const [summary, orders] = account;

  return (
    <AccountDashboard summary={toAccountSummary(summary, orders.items)} />
  );
}
