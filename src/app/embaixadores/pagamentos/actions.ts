'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import type {
  AmbassadorCommissionGroup,
  CreateCommissionPaymentInput,
  PaymentActionResult,
  ReleasedCommission,
  ReleasedCommissionsData,
  CommissionType,
} from './types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

async function requireActiveAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Sessão expirada. Entre novamente para continuar.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin' || profile.ativo !== true) {
    throw new Error('Acesso restrito a administradores ativos.');
  }

  return supabase;
}

function normalizeCommission(value: unknown): ReleasedCommission | null {
  const item = record(value);
  const status = text(item.status || item.commission_status).toLowerCase();
  const id = text(item.id || item.commission_id);

  if (!UUID_PATTERN.test(id) || (status && status !== 'liberada')) {
    return null;
  }

  const rawCommissionType = text(item.commission_type || item.type).toLowerCase();
  const commissionType: CommissionType = rawCommissionType === 'first_purchase_bonus'
    ? 'first_purchase_bonus'
    : 'network_percentage';

  return {
    id,
    orderNumber: text(item.order_number || item.numero_pedido || item.order_id, 'Pedido'),
    createdAt: text(item.created_at || item.available_at) || null,
    level: Math.max(1, Math.min(10, Math.trunc(numberValue(item.commission_level || item.nivel) || 1))),
    commissionType,
    amount: Math.max(0, numberValue(item.commission_amount || item.amount || item.valor)),
  };
}

function normalizeGroup(value: unknown, globalMinimum: number): AmbassadorCommissionGroup | null {
  const group = record(value);
  const ambassador = record(group.ambassador || group.embaixador);
  const ambassadorId = text(group.ambassador_id || ambassador.id || group.id);

  if (!UUID_PATTERN.test(ambassadorId)) {
    return null;
  }

  const commissions = array(group.commissions || group.comissoes || group.commission_items || group.items)
    .map(normalizeCommission)
    .filter((item): item is ReleasedCommission => item !== null);
  const releasedAmount = commissions.length > 0
    ? commissions.reduce((total, item) => total + item.amount, 0)
    : Math.max(0, numberValue(group.released_amount || group.total_liberado || group.available_amount));
  const minimumPaymentAmount = Math.max(
    0,
    numberValue(group.minimum_payment_amount || group.valor_minimo_pagamento) || globalMinimum,
  );

  return {
    ambassadorId,
    name: text(group.ambassador_name || group.full_name || ambassador.full_name || ambassador.name, 'Embaixador'),
    username: text(group.username || group.referral_code || ambassador.username || ambassador.referral_code, '—'),
    pixType: text(group.pix_key_type || group.pix_type || ambassador.pix_key_type, 'Pix'),
    pixMasked: text(group.pix_key_masked || group.pix_masked || ambassador.pix_key_masked, 'Não cadastrado'),
    releasedAmount,
    minimumPaymentAmount,
    meetsMinimum: booleanValue(
      group.meets_minimum || group.atingiu_minimo,
      releasedAmount >= minimumPaymentAmount,
    ),
    commissions,
  };
}

function normalizeReleasedCommissions(payload: unknown): ReleasedCommissionsData {
  const root = record(Array.isArray(payload) ? payload[0] : payload);
  const summary = record(root.summary || root.resumo);
  const minimumPaymentAmount = Math.max(
    0,
    numberValue(summary.minimum_payment_amount || summary.valor_minimo_pagamento || root.minimum_payment_amount),
  );
  const groups = array(root.ambassadors || root.grupos || root.groups)
    .map((item) => normalizeGroup(item, minimumPaymentAmount))
    .filter((item): item is AmbassadorCommissionGroup => item !== null && item.commissions.length > 0);

  const releasedAmount = groups.reduce((total, group) => total + group.releasedAmount, 0);
  const commissionCount = groups.reduce((total, group) => total + group.commissions.length, 0);

  return {
    summary: {
      releasedAmount: numberValue(summary.released_amount || summary.total_liberado || summary.total_amount) || releasedAmount,
      commissionCount: numberValue(summary.commission_count || summary.total_commissions || summary.quantidade_comissoes) || commissionCount,
      ambassadorCount: numberValue(summary.ambassador_count || summary.total_ambassadors || summary.quantidade_embaixadores) || groups.length,
      minimumPaymentAmount,
    },
    groups,
  };
}

export async function listReleasedCommissionsAction(): Promise<ReleasedCommissionsData> {
  const supabase = await requireActiveAdmin();
  const { data, error } = await supabase.rpc('fn_admin_listar_comissoes_liberadas');

  if (error) {
    console.error('Falha ao listar comissões liberadas:', error.code);
    throw new Error('Não foi possível carregar as comissões liberadas.');
  }

  return normalizeReleasedCommissions(data);
}

export async function createCommissionPaymentAction(
  input: CreateCommissionPaymentInput,
): Promise<PaymentActionResult> {
  const supabase = await requireActiveAdmin();
  const ambassadorId = input.ambassadorId?.trim();
  const commissionIds = [...new Set(input.commissionIds || [])];
  const paymentReference = input.paymentReference?.trim();
  const notes = input.notes?.trim() || null;
  const overrideReason = input.overrideReason?.trim() || null;

  if (!UUID_PATTERN.test(ambassadorId)) {
    return { success: false, message: 'Embaixador inválido.' };
  }
  if (commissionIds.length < 1 || commissionIds.length > 500 || commissionIds.some((id) => !UUID_PATTERN.test(id))) {
    return { success: false, message: 'Selecione entre 1 e 500 comissões válidas.' };
  }
  if (!paymentReference || paymentReference.length > 120) {
    return { success: false, message: 'Informe uma referência de pagamento com até 120 caracteres.' };
  }
  if (notes && notes.length > 1000) {
    return { success: false, message: 'As observações devem ter até 1.000 caracteres.' };
  }
  if (input.overrideMinimum && (!overrideReason || overrideReason.length < 10 || overrideReason.length > 500)) {
    return { success: false, message: 'O override exige uma justificativa entre 10 e 500 caracteres.' };
  }

  // Revalida a seleção no servidor. A RPC de criação continua sendo a autoridade
  // transacional, mas não confiamos nos IDs ou no total enviados pelo navegador.
  const { data: releasedPayload, error: releasedError } = await supabase.rpc(
    'fn_admin_listar_comissoes_liberadas',
  );
  if (releasedError) {
    console.error('Falha ao validar comissões liberadas:', releasedError.code);
    return { success: false, message: 'Não foi possível validar as comissões selecionadas.' };
  }

  const currentGroup = normalizeReleasedCommissions(releasedPayload).groups
    .find((group) => group.ambassadorId === ambassadorId);
  const allowedIds = new Set(currentGroup?.commissions.map((commission) => commission.id) || []);
  if (!currentGroup || commissionIds.some((id) => !allowedIds.has(id))) {
    return { success: false, message: 'A seleção contém comissão indisponível ou de outro embaixador.' };
  }

  const selectedAmount = currentGroup.commissions
    .filter((commission) => commissionIds.includes(commission.id))
    .reduce((total, commission) => total + commission.amount, 0);
  if (selectedAmount < currentGroup.minimumPaymentAmount && !input.overrideMinimum) {
    return { success: false, message: 'O total selecionado está abaixo do mínimo configurado.' };
  }

  const { data, error } = await supabase.rpc('fn_admin_criar_pagamento_comissoes', {
    p_ambassador_id: ambassadorId,
    p_commission_ids: commissionIds,
    p_payment_reference: paymentReference,
    p_notes: notes,
    p_override_minimum: input.overrideMinimum === true,
    p_override_reason: input.overrideMinimum ? overrideReason : null,
  });

  if (error) {
    console.error('Falha ao criar pagamento de comissões:', error.code);
    return { success: false, message: error.message || 'Não foi possível registrar o pagamento.' };
  }

  const result = record(data);
  const success = result.success !== false && result.sucesso !== false;
  if (!success) {
    return {
      success: false,
      message: text(result.message || result.mensagem || result.error || result.erro, 'O pagamento não foi registrado.'),
    };
  }

  revalidatePath('/embaixadores/pagamentos');
  revalidatePath('/embaixadores');

  return {
    success: true,
    message: text(result.message || result.mensagem, 'Pagamento registrado com sucesso.'),
    paymentId: text(result.payment_id || result.pagamento_id) || undefined,
  };
}
