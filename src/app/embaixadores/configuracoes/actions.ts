'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export type CommissionLevelConfig = {
  id?: string;
  level_number: number;
  name: string;
  percentage: number;
  enabled: boolean;
};

export type ProgramSettingsData = {
  programStatus: 'ativo' | 'pausado' | 'encerrado';
  referralAttributionDays: number;
  referralDestinationUrl: string;
  whatsappNumber: string;
  whatsappMessageTemplate: string;
  minimumPaymentAmount: number;
  paymentFrequency: 'semanal' | 'quinzenal' | 'mensal';
  allowPixEdit: boolean;
  requirePixChangeApproval: boolean;
  monthlyActivationEnabled: boolean;
  monthlyActivationAmount: number;
  activationGraceDays: number;
  activationBasis: 'vendas_pessoais' | 'compras_pessoais';
  firstPurchaseBonusEnabled: boolean;
  firstPurchaseMinimumAmount: number;
  firstPurchaseBonusAmount: number;
  defaultPlan: {
    id: string;
    name: string;
    commissionBase: 'valor_final' | 'valor_bruto' | 'valor_liquido';
    levels: CommissionLevelConfig[];
  };
};

export type ProgramSettingsInput = Omit<ProgramSettingsData, 'defaultPlan'> & {
  defaultPlan: Omit<ProgramSettingsData['defaultPlan'], 'id'> & { id: string };
};

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Sessão inválida.');

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .single();

  if (!profile?.ativo || profile.role !== 'admin') {
    throw new Error('Acesso restrito a administradores.');
  }

  return { admin, user };
}

function numberInRange(value: unknown, label: string, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
    throw new Error(`${label} deve estar entre ${min} e ${max}.`);
  }
  return numberValue;
}

function strictBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} deve ser verdadeiro ou falso.`);
  return value;
}

function decimal(value: unknown, label: string, min: number, max: number) {
  return Math.round(numberInRange(value, label, min, max) * 100) / 100;
}

function normalizeInput(input: ProgramSettingsInput): ProgramSettingsInput {
  const programStatuses = ['ativo', 'pausado', 'encerrado'] as const;
  const frequencies = ['semanal', 'quinzenal', 'mensal'] as const;
  const activationBases = ['vendas_pessoais', 'compras_pessoais'] as const;
  const commissionBases = ['valor_final', 'valor_bruto', 'valor_liquido'] as const;

  if (!input || !input.defaultPlan || !Array.isArray(input.defaultPlan.levels)) throw new Error('Configurações incompletas.');
  if (!programStatuses.includes(input.programStatus)) throw new Error('Status do programa inválido.');
  if (!frequencies.includes(input.paymentFrequency)) throw new Error('Frequência de pagamento inválida.');
  if (!activationBases.includes(input.activationBasis)) throw new Error('Base de ativação inválida.');
  if (!commissionBases.includes(input.defaultPlan.commissionBase)) throw new Error('Base de comissão inválida.');

  const levels = input.defaultPlan.levels.map((level, index) => ({
    level_number: index + 1,
    name: String(level.name || `Nível ${index + 1}`).trim().slice(0, 60),
    percentage: decimal(level.percentage, `Percentual do nível ${index + 1}`, 0, 100),
    enabled: strictBoolean(level.enabled, `Situação do nível ${index + 1}`),
  }));

  if (levels.length < 1 || levels.length > 10) throw new Error('O plano deve ter entre 1 e 10 níveis.');
  if (!levels[0].enabled || levels[0].percentage <= 0) throw new Error('O nível 1 deve estar ativo e possuir percentual maior que zero.');
  if (levels.some((level, index) => index > 0 && level.enabled && !levels[index - 1].enabled)) {
    throw new Error('Os níveis ativos devem ser sequenciais, sem intervalos.');
  }
  const totalPercentage = levels.filter((level) => level.enabled).reduce((total, level) => total + level.percentage, 0);
  if (totalPercentage > 100) throw new Error('A soma das comissões não pode ultrapassar 100%.');

  const planName = String(input.defaultPlan.name || '').trim().slice(0, 100);
  if (!planName) throw new Error('Informe o nome do plano de comissão.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(input.defaultPlan.id))) {
    throw new Error('Plano de comissão inválido.');
  }

  const referralDestinationUrl = String(input.referralDestinationUrl || '').trim();
  if (referralDestinationUrl) {
    let parsedUrl: URL;
    try { parsedUrl = new URL(referralDestinationUrl); } catch { throw new Error('URL de destino inválida.'); }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('A URL de destino deve usar HTTP ou HTTPS.');
  }
  const whatsappNumber = String(input.whatsappNumber || '').replace(/[\s()-]/g, '');
  if (whatsappNumber && !/^\+?[1-9]\d{9,14}$/.test(whatsappNumber)) throw new Error('Número de WhatsApp inválido.');

  const monthlyActivationEnabled = strictBoolean(input.monthlyActivationEnabled, 'Ativação mensal');
  const monthlyActivationAmount = decimal(input.monthlyActivationAmount, 'Ativação mensal', 0, 1_000_000);
  if (monthlyActivationEnabled && monthlyActivationAmount <= 0) {
    throw new Error('Informe um valor maior que zero para a ativação mensal.');
  }

  const firstPurchaseBonusEnabled = strictBoolean(input.firstPurchaseBonusEnabled, 'Bônus da primeira compra');
  const firstPurchaseMinimumAmount = decimal(input.firstPurchaseMinimumAmount, 'Valor mínimo da primeira compra', 0, 1_000_000);
  const firstPurchaseBonusAmount = decimal(input.firstPurchaseBonusAmount, 'Bônus fixo da primeira compra', 0, 1_000_000);
  if (firstPurchaseBonusEnabled && firstPurchaseMinimumAmount <= 0) {
    throw new Error('Informe um valor mínimo maior que zero para a primeira compra.');
  }
  if (firstPurchaseBonusEnabled && firstPurchaseBonusAmount <= 0) {
    throw new Error('Informe um bônus fixo maior que zero para a primeira compra.');
  }

  return {
    programStatus: input.programStatus,
    referralAttributionDays: Math.round(numberInRange(input.referralAttributionDays, 'Janela de atribuição', 1, 3650)),
    referralDestinationUrl: referralDestinationUrl.slice(0, 2048),
    whatsappNumber,
    whatsappMessageTemplate: String(input.whatsappMessageTemplate || '').trim().slice(0, 2000),
    minimumPaymentAmount: decimal(input.minimumPaymentAmount, 'Pagamento mínimo', 0, 1_000_000),
    paymentFrequency: input.paymentFrequency,
    allowPixEdit: strictBoolean(input.allowPixEdit, 'Edição de Pix'),
    requirePixChangeApproval: strictBoolean(input.requirePixChangeApproval, 'Aprovação de Pix'),
    monthlyActivationEnabled,
    monthlyActivationAmount,
    activationGraceDays: Math.round(numberInRange(input.activationGraceDays, 'Carência da ativação', 0, 90)),
    activationBasis: input.activationBasis,
    firstPurchaseBonusEnabled,
    firstPurchaseMinimumAmount,
    firstPurchaseBonusAmount,
    defaultPlan: {
      id: String(input.defaultPlan.id),
      name: planName,
      commissionBase: input.defaultPlan.commissionBase,
      levels,
    },
  };
}

export async function getAmbassadorProgramSettings(): Promise<ProgramSettingsData> {
  const { admin } = await requireAdmin();
  const { data: settings, error: settingsError } = await admin
    .from('ambassador_program_settings')
    .select('*')
    .eq('singleton', true)
    .single();

  if (settingsError || !settings?.default_commission_plan_id) {
    throw new Error('Configurações do programa não encontradas.');
  }

  const [{ data: plan, error: planError }, { data: levels, error: levelsError }] = await Promise.all([
    admin.from('commission_plans').select('id, name, commission_base').eq('id', settings.default_commission_plan_id).single(),
    admin.from('commission_plan_levels').select('id, level_number, name, percentage, enabled').eq('commission_plan_id', settings.default_commission_plan_id).order('level_number'),
  ]);

  if (planError || !plan || levelsError) throw new Error('Plano de comissão padrão não encontrado.');

  return {
    programStatus: settings.program_status,
    referralAttributionDays: Number(settings.referral_attribution_days),
    referralDestinationUrl: settings.referral_destination_url || '',
    whatsappNumber: settings.whatsapp_number || '',
    whatsappMessageTemplate: settings.whatsapp_message_template || '',
    minimumPaymentAmount: Number(settings.minimum_payment_amount),
    paymentFrequency: settings.payment_frequency,
    allowPixEdit: Boolean(settings.allow_pix_edit),
    requirePixChangeApproval: Boolean(settings.require_pix_change_approval),
    monthlyActivationEnabled: Boolean(settings.monthly_activation_enabled),
    monthlyActivationAmount: Number(settings.monthly_activation_amount),
    activationGraceDays: Number(settings.activation_grace_days),
    activationBasis: settings.activation_basis,
    firstPurchaseBonusEnabled: Boolean(settings.first_purchase_bonus_enabled),
    firstPurchaseMinimumAmount: Number(settings.first_purchase_minimum_amount),
    firstPurchaseBonusAmount: Number(settings.first_purchase_bonus_amount),
    defaultPlan: {
      id: plan.id,
      name: plan.name,
      commissionBase: plan.commission_base,
      levels: (levels || []).map((level) => ({
        id: level.id,
        level_number: Number(level.level_number),
        name: level.name,
        percentage: Number(level.percentage),
        enabled: Boolean(level.enabled),
      })),
    },
  };
}

export async function saveAmbassadorProgramSettings(input: ProgramSettingsInput) {
  const { admin, user } = await requireAdmin();
  const normalized = normalizeInput(input);
  const { error } = await admin.rpc('fn_admin_save_ambassador_program_settings', {
    p_actor_id: user.id,
    p_payload: normalized,
  });

  if (error) {
    console.error('Erro ao salvar configurações do programa:', error);
    throw new Error(error.message || 'Não foi possível salvar as configurações.');
  }

  revalidatePath('/embaixadores/configuracoes');
  revalidatePath('/calculadora-de-ganhos');
  revalidatePath('/embaixador/calculadora-de-ganhos');
  return { success: true as const };
}
