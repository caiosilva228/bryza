import { createAdminClient } from '@/utils/supabase/admin';

export type CommissionPlan = {
  name: string;
  levels: Array<{
    level_number: number;
    name: string;
    percentage: number;
  }>;
};

const FALLBACK_PLAN: CommissionPlan = {
  name: 'Embaixador Multinível 4-2-1',
  levels: [
    { level_number: 1, name: 'Nível 1', percentage: 4 },
    { level_number: 2, name: 'Nível 2', percentage: 2 },
    { level_number: 3, name: 'Nível 3', percentage: 1 },
  ],
};

export async function getCurrentCommissionPlan(): Promise<CommissionPlan> {
  try {
    const admin = createAdminClient();
    const { data: settings } = await admin
      .from('ambassador_program_settings')
      .select('default_commission_plan_id')
      .eq('singleton', true)
      .maybeSingle();

    if (!settings?.default_commission_plan_id) return FALLBACK_PLAN;

    const { data: plan } = await admin
      .from('commission_plans')
      .select('id, name')
      .eq('id', settings.default_commission_plan_id)
      .eq('status', 'ativo')
      .maybeSingle();

    if (!plan) return FALLBACK_PLAN;

    const { data: levels } = await admin
      .from('commission_plan_levels')
      .select('level_number, name, percentage')
      .eq('commission_plan_id', plan.id)
      .eq('enabled', true)
      .order('level_number');

    if (!levels?.length) return FALLBACK_PLAN;
    return {
      name: plan.name,
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
