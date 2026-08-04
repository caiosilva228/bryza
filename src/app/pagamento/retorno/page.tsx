import PaymentReturnClient from './PaymentReturnClient';
import { MetaPixelScript } from '@/components/analytics/MetaPixelScript';

type ReturnSearchParams = {
  status?: string;
  collection_status?: string;
  payment_id?: string;
  collection_id?: string;
  external_reference?: string;
};

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<ReturnSearchParams>;
}) {
  const params = await searchParams;

  return (
    <>
      <MetaPixelScript />
      <PaymentReturnClient
        initialStatus={params.collection_status || params.status || 'pending'}
        paymentId={params.payment_id || params.collection_id || null}
        externalReference={params.external_reference || null}
      />
    </>
  );
}
