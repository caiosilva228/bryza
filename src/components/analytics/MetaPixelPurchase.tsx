'use client';

import { useEffect, useRef } from 'react';
import { trackMetaPurchase, type MetaPixelContent } from '@/lib/meta-pixel';

type MetaPixelPurchaseProps = {
  eventId: string | null | undefined;
  orderId: string | null | undefined;
  value: number | null | undefined;
  contentName: string;
  contents?: MetaPixelContent[];
  numItems?: number;
};

const RETRY_DELAY_MS = 250;
const MAX_RETRIES = 40;

export default function MetaPixelPurchase({
  eventId,
  orderId,
  value,
  contentName,
  contents,
  numItems,
}: MetaPixelPurchaseProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!eventId || !orderId || value === null || value === undefined) return;

    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attempt = () => {
      if (trackedRef.current) return;

      const tracked = trackMetaPurchase({
        eventId,
        orderId,
        value,
        contentName,
        contents,
        numItems,
      });

      if (tracked) {
        trackedRef.current = true;
        return;
      }

      if (retries < MAX_RETRIES) {
        retries += 1;
        retryTimer = setTimeout(attempt, RETRY_DELAY_MS);
      }
    };

    attempt();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [contentName, contents, eventId, numItems, orderId, value]);

  return null;
}
