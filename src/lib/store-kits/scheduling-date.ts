const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const BRAZILIAN_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function isoAtBusinessNoon(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day, 15, 0, 0));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}

/**
 * The store asks for a delivery day, not a browser-local timestamp.
 * Persist noon in the business timezone (America/Sao_Paulo) so a runtime
 * running in UTC cannot move the selected day backwards or forwards.
 */
export function normalizeStoreSchedulingDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  const dateOnlyMatch = raw.match(DATE_ONLY_PATTERN);
  if (dateOnlyMatch) {
    return isoAtBusinessNoon(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]),
      Number(dateOnlyMatch[3]),
    );
  }

  const brazilianDateMatch = raw.match(BRAZILIAN_DATE_PATTERN);
  if (brazilianDateMatch) {
    return isoAtBusinessNoon(
      Number(brazilianDateMatch[3]),
      Number(brazilianDateMatch[2]),
      Number(brazilianDateMatch[1]),
    );
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
