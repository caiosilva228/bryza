import { notFound, redirect } from 'next/navigation';
import {
  CustomerAccountDataError,
  CustomerAccountNotLinkedError,
  CustomerAccountUnauthorizedError,
  getCustomerAccountOrderDetail,
  type CustomerAccountEntityType,
} from '@/lib/customer-account';
import { OrderDetailView } from '../../components';
import { toOrderDetail } from '../../view-model';

function parseOrderIdentity(value: string) {
  const separator = value.indexOf(':');
  if (separator <= 0) return null;
  const entityType = value.slice(0, separator);
  const entityId = value.slice(separator + 1);

  if (
    !['pedido', 'agendamento'].includes(entityType)
    || !entityId
  ) {
    return null;
  }

  return {
    entityType: entityType as CustomerAccountEntityType,
    entityId,
  };
}

async function loadOrderDetail(
  entityType: CustomerAccountEntityType,
  entityId: string,
  returnId: string,
) {
  try {
    return await getCustomerAccountOrderDetail(entityType, entityId);
  } catch (error) {
    if (error instanceof CustomerAccountUnauthorizedError) {
      redirect(
        `/loja?login=required&retorno=${encodeURIComponent(
          `/loja/minha-conta/pedidos/${returnId}`,
        )}`,
      );
    }
    if (error instanceof CustomerAccountNotLinkedError) {
      redirect('/loja/minha-conta?estado=sem-vinculo');
    }
    if (error instanceof CustomerAccountDataError) {
      notFound();
    }
    throw error;
  }
}

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const identity = parseOrderIdentity(id);
  if (!identity) notFound();

  const detail = await loadOrderDetail(
    identity.entityType,
    identity.entityId,
    id,
  );

  return <OrderDetailView order={toOrderDetail(detail)} />;
}
