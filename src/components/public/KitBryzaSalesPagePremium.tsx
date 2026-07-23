'use client';

import { useCallback, useRef, useState } from 'react';
import { KitBryzaLanding } from './KitBryzaLanding';
import { KitBryzaOrderModal } from './KitBryzaOrderModal';
import type { KitBryzaSalesPageProps } from './kit-bryza-types';

export function KitBryzaSalesPagePremium({ ambassador, products }: KitBryzaSalesPageProps) {
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const product = products[0];
  const openOrder = useCallback(() => {
    if (!product) return;
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOrderOpen(true);
  }, [product]);
  const closeOrder = useCallback(() => {
    setIsOrderOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  return (
    <>
      <KitBryzaLanding ambassador={ambassador} productAvailable={Boolean(product)} onOrder={openOrder} />
      {isOrderOpen && product && <KitBryzaOrderModal ambassador={ambassador} product={product} onClose={closeOrder} />}
    </>
  );
}
