import { createAdminClient } from '@/utils/supabase/admin';
import type { FirstPurchaseBonusConfig } from './earnings-calculation';

export type CommissionPlan = {
  name: string;
  firstPurchaseBonus: FirstPurchaseBonusConfig;
  levels: Array<{
    level_number: number;
    name: string;
    percentage: number;
  }>;
};

const FALLBACK_PLAN: CommissionPlan = {
  name: 'Embaixador Multinível 4-2-1',
  firstPurchaseBonus: {
    enabled: false,
    minimumAmount: 0,
    amount: 0,
  },
  levels: [
    { level_number: 1, name: 'Nível 1', percentage: 4 },
    { level_number: 2, name: 'Nível 2', percentage: 2 },
    { level_number: 3, name: 'Nível 3', percentage: 1 },
  ],
};

export async function getCurrentCommissionPlan(): Promise<CommissionPlan> {
  try {
    const admin = createAdminClient();
    const { data: settings, error: settingsError } = await admin
      .from('ambassador_program_settings')
      .select(`
        default_commission_plan_id,
        first_purchase_bonus_enabled,
        first_purchase_minimum_amount,
        first_purchase_bonus_amount
      `)
      .eq('singleton', true)
      .maybeSingle();

    if (settingsError) throw settingsError;
    if (!settings?.default_commission_plan_id) return FALLBACK_PLAN;

    const { data: plan, error: planError } = await admin
      .from('commission_plans')
      .select('id, name')
      .eq('id', settings.default_commission_plan_id)
      .eq('status', 'ativo')
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) return FALLBACK_PLAN;

    const { data: levels, error: levelsError } = await admin
      .from('commission_plan_levels')
      .select('level_number, name, percentage')
      .eq('commission_plan_id', plan.id)
      .eq('enabled', true)
      .order('level_number');

    if (levelsError) throw levelsError;
    if (!levels?.length) return FALLBACK_PLAN;
    return {
      name: plan.name,
      firstPurchaseBonus: {
        enabled: Boolean(settings.first_purchase_bonus_enabled),
        minimumAmount: Number(settings.first_purchase_minimum_amount),
        amount: Number(settings.first_purchase_bonus_amount),
      },
      levels: levels.map((level) => ({
        level_number: Number(level.level_number),
        name: level.name,
        percentage: Number(level.percentage),
      })),
    };
  } catch (error) {
    console.error('Não foi possível carregar o plano da calculadora:', error);
    return FALLBACK_PLAN;
  }
}
