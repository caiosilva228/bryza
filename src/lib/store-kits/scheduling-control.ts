export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

export type StoreSchedulingPeriod =
  | 'manhademanha'
  | 'tarde'
  | 'noite'
  | 'qualquer'
  | 'ate_3_horas';

export interface SchedulingControlSettings {
  singleton: true;
  automatico_ativo: boolean;
  mesmo_dia_ativo: boolean;
  antecedencia_mesmo_dia_horas: number;
  limite_pedidos_dia: number | null;
  updated_at?: string | null;
}

export interface SchedulingCapacityDay {
  value: string;
  label: string;
  quantidade: number;
  restante: number | null;
  disponivel: boolean;
  hoje: boolean;
}

export interface StoreSchedulingAvailability {
  success: boolean;
  automatico_ativo: boolean;
  mesmo_dia_ativo: boolean;
  antecedencia_mesmo_dia_horas: number;
  limite_pedidos_dia: number | null;
  dias: SchedulingCapacityDay[];
  error?: string;
}

export function getSaoPauloDateKey(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function formatBusinessDateLabel(dateKey: string, isToday = false, isTomorrow = false): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekDay = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(value);
  const prefix = isToday ? 'Hoje' : isTomorrow ? 'Amanhã' : `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  return `${prefix} (${weekDay})`;
}

export function getBusinessDateBounds(dateKey: string): { start: string; end: string } {
  const nextDateKey = addCalendarDays(dateKey, 1);
  return {
    start: `${dateKey}T00:00:00-03:00`,
    end: `${nextDateKey}T00:00:00-03:00`,
  };
}

export function getPeriodLabel(period: StoreSchedulingPeriod | string | null | undefined, hours = 3): string {
  switch (period) {
    case 'ate_3_horas': return `Hoje (entrega em até ${hours} horas)`;
    case 'manhademanha': return 'Manhã (09:00 - 12:00)';
    case 'tarde': return 'Tarde (14:00 - 18:00)';
    case 'noite': return 'Noite (18:30 - 21:00)';
    case 'qualquer': return 'Qualquer horário';
    default: return period || 'Horário Comercial';
  }
}
