export const META_PIXEL_ID =
  (process.env.NEXT_PUBLIC_META_PIXEL_ID || '2102937713973469').replace(/\D/g, '')
  || '2102937713973469';

export type MetaPixelContent = {
  id: string;
  quantity: number;
  item_price?: number;
};

type MetaPixelFunction = (
  command: 'track' | 'trackCustom',
  eventName: string,
  parameters?: Record<string, unknown>,
  options?: { eventID?: string },
) => void;

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
  }
}

export type MetaPurchaseInput = {
  eventId: string;
  orderId: string;
  value: number;
  contentName: string;
  contents?: MetaPixelContent[];
  numItems?: number;
};

const PURCHASE_DEDUPE_PREFIX = 'bryza:meta-purchase:';

function wasPurchaseTracked(eventId: string): boolean {
  try {
    return window.sessionStorage.getItem(`${PURCHASE_DEDUPE_PREFIX}${eventId}`) === '1';
  } catch {
    return false;
  }
}

function markPurchaseAsTracked(eventId: string): void {
  try {
    window.sessionStorage.setItem(`${PURCHASE_DEDUPE_PREFIX}${eventId}`, '1');
  } catch {
    // The in-memory guard in MetaPixelPurchase still protects this mount.
  }
}

export function trackMetaPurchase(input: MetaPurchaseInput): boolean {
  if (typeof window === 'undefined' || !input.eventId || !input.orderId) return false;
  if (!Number.isFinite(input.value) || input.value <= 0) return false;
  if (wasPurchaseTracked(input.eventId)) return true;

  const fbq = window.fbq;
  if (typeof fbq !== 'function') return false;

  const contents = (input.contents || [])
    .filter((content) => (
      Boolean(content.id)
      && Number.isFinite(content.quantity)
      && content.quantity > 0
    ))
    .map((content) => ({
      id: content.id,
      quantity: content.quantity,
      ...(Number.isFinite(content.item_price) && content.item_price !== undefined
        ? { item_price: content.item_price }
        : {}),
    }));

  const contentIds = [...new Set(contents.map((content) => content.id))];
  const parameters: Record<string, unknown> = {
    value: Number(input.value.toFixed(2)),
    currency: 'BRL',
    content_name: input.contentName,
    content_type: 'product',
    order_id: input.orderId,
  };

  if (contentIds.length > 0) parameters.content_ids = contentIds;
  if (contents.length > 0) parameters.contents = contents;
  if (input.numItems && input.numItems > 0) parameters.num_items = input.numItems;

  try {
    fbq('track', 'Purchase', parameters, { eventID: input.eventId });
    markPurchaseAsTracked(input.eventId);
    return true;
  } catch {
    return false;
  }
}
