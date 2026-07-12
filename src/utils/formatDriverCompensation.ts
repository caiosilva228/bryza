import type { Driver, DriverCompensationModel } from '@/models/types';
import { formatCurrency } from './format';

export const COMPENSATION_MODEL_LABELS: Record<DriverCompensationModel, string> = {
  per_delivery:           'Por entrega concluída',
  per_route:              'Por rota concluída',
  daily:                  'Diária',
  per_delivery_plus_route:'Por entrega + valor fixo por rota',
};

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  motorcycle: 'Moto',
  car:        'Carro',
  utility:    'Utilitário',
  van:        'Van',
  other:      'Outro',
};

export const DRIVER_STATUS_LABELS: Record<string, string> = {
  active:   'Ativo',
  inactive: 'Inativo',
};

export const COMPENSATION_STATUS_LABELS: Record<string, string> = {
  open:     'Em aberto',
  approved: 'Aprovada',
  paid:     'Paga',
};

/**
 * Gera a string de exibição da regra de remuneração de um motorista.
 * Ex: "R$ 5,00 por entrega + R$ 2,00 por tentativa"
 */
export function formatCompensationRule(driver: Pick<
  Driver,
  | 'compensation_model'
  | 'amount_per_delivery'
  | 'amount_per_route'
  | 'daily_amount'
  | 'pay_failed_attempt'
  | 'amount_per_failed_attempt'
>): string {
  const { compensation_model } = driver;
  let main = '';

  switch (compensation_model) {
    case 'per_delivery':
      main = `${formatCurrency(driver.amount_per_delivery ?? 0)} por entrega`;
      break;
    case 'per_route':
      main = `${formatCurrency(driver.amount_per_route ?? 0)} por rota`;
      break;
    case 'daily':
      main = `${formatCurrency(driver.daily_amount ?? 0)} por dia`;
      break;
    case 'per_delivery_plus_route':
      main = `${formatCurrency(driver.amount_per_route ?? 0)} por rota + ${formatCurrency(driver.amount_per_delivery ?? 0)} por entrega`;
      break;
    default:
      main = '—';
  }

  if (driver.pay_failed_attempt && driver.amount_per_failed_attempt) {
    main += ` · ${formatCurrency(driver.amount_per_failed_attempt)} por tentativa`;
  }

  return main;
}

/**
 * Remove todos os caracteres não numéricos do telefone.
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Formata telefone para exibição: (XX) XXXXX-XXXX
 */
export function formatPhone(phone: string): string {
  const digits = sanitizePhone(phone);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Abre o WhatsApp para o número informado.
 */
export function openWhatsApp(phone: string, message?: string): void {
  const digits = sanitizePhone(phone);
  const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
  const url = `https://wa.me/${withDDI}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  window.open(url, '_blank');
}

/**
 * Converte string de valor monetário para número seguro.
 */
export function parseMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  const normalized = value
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = parseFloat(normalized);
  return isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}
