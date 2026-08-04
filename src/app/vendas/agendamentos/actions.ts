'use server';

import { revalidatePath } from 'next/cache';
import {
  fetchAgendamentos,
  fetchAgendamentosByDate,
  createAgendamento,
  converterAgendamentoEmPedido,
  cancelarAgendamento,
  retornarPedidoParaAgendamento,
  reagendarAgendamento,
  AgendamentoInput,
} from '@/services/agendamentos';
import { AgendamentoItem } from '@/models/types';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  addCalendarDays,
  formatBusinessDateLabel,
  getBusinessDateBounds,
  getSaoPauloDateKey,
  SchedulingCapacityDay,
  SchedulingControlSettings,
} from '@/lib/store-kits/scheduling-control';

export interface SchedulingControlInput {
  automatico_ativo: boolean;
  mesmo_dia_ativo: boolean;
  antecedencia_mesmo_dia_horas: number;
  limite_pedidos_dia: number | null;
}

export interface SchedulingControlActionResult {
  success: boolean;
  data?: SchedulingControlSettings;
  dias?: SchedulingCapacityDay[];
  error?: string;
}

async function requireActiveAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sessão inválida.');

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.ativo !== true || profile.role !== 'admin') {
    throw new Error('Acesso restrito a administradores ativos.');
  }

  return admin;
}

async function loadSchedulingCapacityDays(
  admin: ReturnType<typeof createAdminClient>,
  settings: SchedulingControlSettings,
): Promise<SchedulingCapacityDay[]> {
  const today = getSaoPauloDateKey();
  const dates = Array.from({ length: 6 }, (_, index) => addCalendarDays(today, index));
  const sameDayWindowOpen = getSaoPauloDateKey(
    new Date(Date.now() + settings.antecedencia_mesmo_dia_horas * 60 * 60 * 1000),
  ) === today;

  return Promise.all(dates.map(async (dateKey, index) => {
    const bounds = getBusinessDateBounds(dateKey);
    const { count, error } = await admin
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .gte('data_agendamento', bounds.start)
      .lt('data_agendamento', bounds.end)
      .neq('status', 'cancelado');

    if (error) throw error;

    const quantidade = count ?? 0;
    const restante = settings.limite_pedidos_dia === null
      ? null
      : Math.max(settings.limite_pedidos_dia - quantidade, 0);
    const capacidadeLivre = restante === null || restante > 0;
    const disponivel = settings.automatico_ativo
      && capacidadeLivre
      && (index > 0 || (settings.mesmo_dia_ativo && sameDayWindowOpen));

    return {
      value: dateKey,
      label: formatBusinessDateLabel(dateKey, index === 0, index === 1),
      quantidade,
      restante,
      disponivel,
      hoje: index === 0,
    };
  }));
}

export async function retornarPedidoParaAgendamentoAction(pedidoId: string, dataAgendamentoIso: string) {
  try {
    const data = await retornarPedidoParaAgendamento(pedidoId, dataAgendamentoIso);
    revalidatePath('/vendas/pedidos');
    revalidatePath('/vendas/agendamentos');
    revalidatePath('/estoque');
    revalidatePath('/');
    return data;
  } catch (error) {
    console.error('Erro ao retornar pedido para agendamento:', error);
    throw new Error('Falha ao retornar pedido para agendamento.');
  }
}

export async function getAgendamentosAction() {
  try {
    return await fetchAgendamentos();
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    throw new Error('Falha ao carregar agendamentos.');
  }
}

export async function getAgendamentosByDateAction(date: string) {
  try {
    return await fetchAgendamentosByDate(date);
  } catch (error) {
    console.error('Erro ao buscar agendamentos por data:', error);
    throw new Error('Falha ao carregar agendamentos da data.');
  }
}

export async function criarAgendamentoAction(
  agendamento: AgendamentoInput,
  itens: Omit<AgendamentoItem, 'produto'>[]
) {
  try {
    const data = await createAgendamento(agendamento, itens);
    revalidatePath('/vendas/agendamentos');
    revalidatePath('/');
    return data;
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    throw new Error('Falha ao criar agendamento.');
  }
}

export async function converterAgendamentoAction(agendamentoId: string) {
  try {
    const result = await converterAgendamentoEmPedido(agendamentoId);
    revalidatePath('/vendas/agendamentos');
    revalidatePath('/vendas/pedidos');
    revalidatePath('/estoque');
    revalidatePath('/');
    return result;
  } catch (error) {
    console.error('Erro ao converter agendamento:', error);
    throw new Error(error instanceof Error ? error.message : 'Falha ao converter agendamento em pedido.');
  }
}

export async function cancelarAgendamentoAction(agendamentoId: string) {
  try {
    const result = await cancelarAgendamento(agendamentoId);
    revalidatePath('/vendas/agendamentos');
    return result;
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    throw new Error('Falha ao cancelar agendamento.');
  }
}

export async function reagendarAgendamentoAction(agendamentoId: string, novaDataIso: string) {
  try {
    const result = await reagendarAgendamento(agendamentoId, novaDataIso);
    revalidatePath('/vendas/agendamentos');
    revalidatePath('/');
    return result;
  } catch (error) {
    console.error('Erro ao reagendar agendamento:', error);
    throw new Error('Falha ao reagendar agendamento.');
  }
}

export async function updateAgendamentoAction(
  agendamentoId: string,
  agendamento: AgendamentoInput,
  itens: Omit<AgendamentoItem, 'produto'>[]
) {
  try {
    const { updateAgendamento } = await import('@/services/agendamentos');
    const result = await updateAgendamento(agendamentoId, agendamento, itens);
    revalidatePath('/vendas/agendamentos');
    revalidatePath('/');
    return result;
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    throw new Error('Falha ao atualizar agendamento.');
  }
}

export async function converterAgendamentosEmLoteAction(agendamentoIds: string[]) {
  try {
    const results = [];
    const errors = [];
    for (const id of agendamentoIds) {
      try {
        const res = await converterAgendamentoEmPedido(id);
        results.push(res);
      } catch (err: any) {
        errors.push({ id, error: err.message || 'Erro ao converter' });
      }
    }
    revalidatePath('/vendas/agendamentos');
    revalidatePath('/vendas/pedidos');
    revalidatePath('/estoque');
    revalidatePath('/');
    return { success: true, convertedCount: results.length, errorCount: errors.length, errors };
  } catch (error) {
    console.error('Erro ao converter agendamentos em lote:', error);
    throw new Error('Falha ao converter agendamentos em lote.');
  }
}

export async function cancelarAgendamentosEmLoteAction(agendamentoIds: string[]) {
  try {
    let successCount = 0;
    for (const id of agendamentoIds) {
      try {
        await cancelarAgendamento(id);
        successCount++;
      } catch (err) {
        console.error(`Erro ao cancelar agendamento ${id}:`, err);
      }
    }
    revalidatePath('/vendas/agendamentos');
    return { success: true, canceledCount: successCount };
  } catch (error) {
    console.error('Erro ao cancelar agendamentos em lote:', error);
    throw new Error('Falha ao cancelar agendamentos em lote.');
  }
}

export async function getSchedulingControlAction(): Promise<SchedulingControlActionResult> {
  try {
    const admin = await requireActiveAdmin();
    const { data, error } = await admin
      .from('agendamento_controle')
      .select('*')
      .eq('singleton', true)
      .single();

    if (error || !data) throw error || new Error('Configuração de agendamento não encontrada.');

    const settings = data as SchedulingControlSettings;
    const dias = await loadSchedulingCapacityDays(admin, settings);
    return { success: true, data: settings, dias };
  } catch (error) {
    console.error('Erro ao buscar controle de agendamento:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao carregar o controle de agendamento.',
    };
  }
}

export async function updateSchedulingControlAction(
  input: SchedulingControlInput,
): Promise<SchedulingControlActionResult> {
  try {
    const admin = await requireActiveAdmin();
    if (typeof input.automatico_ativo !== 'boolean' || typeof input.mesmo_dia_ativo !== 'boolean') {
      throw new Error('As opções de ativação são inválidas.');
    }

    const sameDayHours = Number(input.antecedencia_mesmo_dia_horas);
    if (!Number.isInteger(sameDayHours) || sameDayHours < 1 || sameDayHours > 24) {
      throw new Error('A antecedência do mesmo dia deve estar entre 1 e 24 horas.');
    }

    const rawLimit = input.limite_pedidos_dia === null ? null : Number(input.limite_pedidos_dia);
    const dailyLimit = rawLimit === null || rawLimit === 0 ? null : rawLimit;
    if (dailyLimit !== null && (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 10000)) {
      throw new Error('O limite diário deve estar entre 1 e 10.000 pedidos.');
    }

    const { data, error } = await admin
      .from('agendamento_controle')
      .update({
        automatico_ativo: input.automatico_ativo,
        mesmo_dia_ativo: input.mesmo_dia_ativo,
        antecedencia_mesmo_dia_horas: sameDayHours,
        limite_pedidos_dia: dailyLimit,
        updated_at: new Date().toISOString(),
      })
      .eq('singleton', true)
      .select('*')
      .single();

    if (error || !data) throw error || new Error('Não foi possível salvar a configuração.');

    revalidatePath('/vendas/agendamentos');
    revalidatePath('/loja');
    const settings = data as SchedulingControlSettings;
    const dias = await loadSchedulingCapacityDays(admin, settings);
    return { success: true, data: settings, dias };
  } catch (error) {
    console.error('Erro ao atualizar controle de agendamento:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao salvar o controle de agendamento.',
    };
  }
}
