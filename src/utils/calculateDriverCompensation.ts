import type { CompensationCalculationResult, DriverCompensationModel } from '@/models/types';

interface CalcParams {
  compensation_model: DriverCompensationModel;
  completed_deliveries: number;
  paid_failed_attempts: number;
  amount_per_delivery?: number | null;
  amount_per_route?: number | null;
  daily_amount?: number | null;
  pay_failed_attempt: boolean;
  amount_per_failed_attempt?: number | null;
  manual_adjustment?: number;
}

export function calculateDriverCompensation(params: CalcParams): CompensationCalculationResult {
  const {
    compensation_model,
    completed_deliveries,
    paid_failed_attempts,
    amount_per_delivery = 0,
    amount_per_route = 0,
    daily_amount = 0,
    pay_failed_attempt,
    amount_per_failed_attempt = 0,
    manual_adjustment = 0,
  } = params;

  const deliveryRate   = amount_per_delivery   ?? 0;
  const routeRate      = amount_per_route      ?? 0;
  const dailyRate      = daily_amount          ?? 0;
  const failedRate     = amount_per_failed_attempt ?? 0;

  let base_amount        = 0;
  let deliveries_amount  = 0;

  switch (compensation_model) {
    case 'per_delivery':
      base_amount       = 0;
      deliveries_amount = completed_deliveries * deliveryRate;
      break;

    case 'per_route':
      base_amount       = routeRate;
      deliveries_amount = 0;
      break;

    case 'daily':
      base_amount       = dailyRate;
      deliveries_amount = 0;
      break;

    case 'per_delivery_plus_route':
      base_amount       = routeRate;
      deliveries_amount = completed_deliveries * deliveryRate;
      break;
  }

  const failed_attempts_amount = pay_failed_attempt
    ? paid_failed_attempts * failedRate
    : 0;

  const calculated_amount =
    base_amount + deliveries_amount + failed_attempts_amount;

  const final_amount = calculated_amount + manual_adjustment;

  return {
    compensation_model,
    completed_deliveries,
    paid_failed_attempts,
    base_amount,
    deliveries_amount,
    failed_attempts_amount,
    calculated_amount,
    manual_adjustment,
    final_amount,
  };
}
