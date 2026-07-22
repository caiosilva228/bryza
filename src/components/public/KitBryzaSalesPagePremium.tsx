'use client';

import { useCallback, useState } from 'react';
import { KitBryzaLanding } from './KitBryzaLanding';
import { KitBryzaOrderModal } from './KitBryzaOrderModal';
import type { KitBryzaSalesPageProps } from './kit-bryza-types';

export function KitBryzaSalesPagePremium({ ambassador, products }: KitBryzaSalesPageProps) {
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const product = products[0];
  const openOrder = useCallback(() => { if (product) setIsOrderOpen(true); }, [product]);
  const closeOrder = useCallback(() => setIsOrderOpen(false), []);

  return (
    <>
      <KitBryzaLanding ambassador={ambassador} productAvailable={Boolean(product)} onOrder={openOrder} />
      {isOrderOpen && product && <KitBryzaOrderModal ambassador={ambassador} product={product} onClose={closeOrder} />}
    </>
  );
}

