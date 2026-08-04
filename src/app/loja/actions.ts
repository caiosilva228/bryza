'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { KitItem, Produto, StoreKit } from '@/models/types';
import { calculateKitAvailability } from '@/lib/store-kits/kit-calculations';
import { normalizeStoreSchedulingDate } from '@/lib/store-kits/scheduling-date';
import {
  addCalendarDays,
  formatBusinessDateLabel,
  getBusinessDateBounds,
  getSaoPauloDateKey,
  StoreSchedulingAvailability,
} from '@/lib/store-kits/scheduling-control';
import {
  configureSchedulingPayment,
  type PaymentStatus,
  type PaymentTiming,
} from '@/lib/payments/payment-intents';
import {
  findCustomerByCanonicalIdentity,
  normalizeCustomerCpf,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  upsertPublicCustomerCanonical,
} from '@/lib/customers/canonical-identity';

export type StoreCartItem =
  | { kind: 'produto'; produto: Produto; quantidade: number }
  | { kind: 'kit'; kit: StoreKit; quantidade: number };

export interface StoreOrderItemInput {
  produto_id?: string;
  kit_id?: string;
  quantidade: number;
}

export interface StoreOrderPayload {
  clientName?: string;
  clientPhone?: string;
  email?: string;
  cpf?: string;
  address: string;
  number?: string;
  neighborhood: string;
  city: string;
  state?: string;
  cep?: string;
  scheduledDate: string;
  period: 'manhademanha' | 'tarde' | 'noite' | 'qualquer' | 'ate_3_horas' | string;
  paymentMethod: string;
  paymentTiming: PaymentTiming;
  notes?: string;
  items: StoreOrderItemInput[];
  idempotencyKey?: string;
}

export async function getStoreProductsAction(): Promise<{
  success: boolean;
  produtos?: Produto[];
  kits?: StoreKit[];
  error?: string;
}> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .not('ativo_loja', 'eq', false)
      .order('categoria', { ascending: true })
      .order('nome_produto', { ascending: true });

    if (error) {
      console.error('Erro ao buscar produtos da loja:', error);
      return { success: false, error: 'Nao foi possivel carregar os produtos.' };
    }

    const produtos = (data as Produto[]).map(produto => ({
      ...produto,
      estoque_disponivel: Math.max(
        0,
        Number(produto.estoque_atual || 0) - Number(produto.estoque_reservado || 0),
      ),
    }));

    const hoje = new Date().toISOString().slice(0, 10);
    const { data: kitRows, error: kitsError } = await admin
      .from('kits')
      .select(`
        *,
        itens:kit_itens(
          *,
          produto:produtos(*)
        )
      `)
      .eq('ativo', true)
      .eq('ativo_loja', true)
      .or(`vigencia_inicio.is.null,vigencia_inicio.lte.${hoje}`)
      .or(`vigencia_fim.is.null,vigencia_fim.gte.${hoje}`)
      .order('nome', { ascending: true });

    if (kitsError) {
      console.error('Erro ao buscar kits da loja:', kitsError);
      return { success: false, error: 'Nao foi possivel carregar os kits promocionais.' };
    }

    const kits = (kitRows as Array<Record<string, unknown>>).map(row => {
      const itens = (row.itens as KitItem[] | undefined) || [];
      const estoqueDisponivel = calculateKitAvailability(itens.map(item => ({
        quantidade: Number(item.quantidade),
        estoqueDisponivel: Math.max(
          0,
          Number(item.produto?.estoque_atual || 0) - Number(item.produto?.estoque_reservado || 0),
        ),
      })));

      return {
        ...row,
        itens,
        estoque_disponivel: estoqueDisponivel,
        disponivel: estoqueDisponivel > 0,
      } as StoreKit;
    });

    return { success: true, produtos, kits };
  } catch (error) {
    console.error('Erro em getStoreProductsAction:', error);
    return { success: false, error: 'Falha tecnica ao carregar produtos.' };
  }
}

export async function getStoreSchedulingAvailabilityAction(): Promise<StoreSchedulingAvailability> {
  const unavailable = (error: string): StoreSchedulingAvailability => ({
    success: false,
    automatico_ativo: false,
    mesmo_dia_ativo: false,
    antecedencia_mesmo_dia_horas: 3,
    limite_pedidos_dia: null,
    dias: [],
    error,
  });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('agendamento_controle')
      .select('automatico_ativo, mesmo_dia_ativo, antecedencia_mesmo_dia_horas, limite_pedidos_dia')
      .eq('singleton', true)
      .single();

    if (error || !data) {
      console.error('Erro ao buscar disponibilidade de agendamento:', error);
      return unavailable('Não foi possível carregar a disponibilidade de entrega.');
    }

    const today = getSaoPauloDateKey();
    const sameDayHours = Number(data.antecedencia_mesmo_dia_horas || 3);
    const sameDayWindowOpen = getSaoPauloDateKey(
      new Date(Date.now() + sameDayHours * 60 * 60 * 1000),
    ) === today;
    const dates = Array.from({ length: 6 }, (_, index) => addCalendarDays(today, index));
    const limit = data.limite_pedidos_dia === null ? null : Number(data.limite_pedidos_dia);

    const dias = await Promise.all(dates.map(async (dateKey, index) => {
      const bounds = getBusinessDateBounds(dateKey);
      const { count, error: countError } = await admin
        .from('agendamentos')
        .select('id', { count: 'exact', head: true })
        .gte('data_agendamento', bounds.start)
        .lt('data_agendamento', bounds.end)
        .neq('status', 'cancelado');

      if (countError) throw countError;

      const quantidade = count ?? 0;
      const restante = limit === null ? null : Math.max(limit - quantidade, 0);
      const capacidadeLivre = restante === null || restante > 0;
      const disponivel = Boolean(data.automatico_ativo)
        && capacidadeLivre
        && (index > 0 || (Boolean(data.mesmo_dia_ativo) && sameDayWindowOpen));

      return {
        value: dateKey,
        label: formatBusinessDateLabel(dateKey, index === 0, index === 1),
        quantidade,
        restante,
        disponivel,
        hoje: index === 0,
      };
    }));

    return {
      success: true,
      automatico_ativo: Boolean(data.automatico_ativo),
      mesmo_dia_ativo: Boolean(data.mesmo_dia_ativo),
      antecedencia_mesmo_dia_horas: sameDayHours,
      limite_pedidos_dia: limit,
      dias,
    };
  } catch (error) {
    console.error('Erro ao calcular disponibilidade de agendamento:', error);
    return unavailable('Não foi possível calcular os horários de entrega.');
  }
}

export async function getStoreUserInfoAction(): Promise<{
  isLoggedIn: boolean;
  userData?: {
    full_name: string;
    phone: string;
    cpf?: string;
    address: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    ambassador_id?: string;
    is_ambassador?: boolean;
  };
}> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { isLoggedIn: false };

    const admin = createAdminClient();
    let amb: any = null;
    let prof: any = null;
    let cli: any = null;

    const { data: ambassador } = await admin
      .from('ambassadors')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    amb = ambassador;

    if (!amb && user.email) {
      const { data } = await admin
        .from('ambassadors')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      amb = data;
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    prof = profile;

    if (user.email) {
      const { data } = await admin
        .from('clientes')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      cli = data;
    }
    const userPhone = amb?.phone || prof?.telefone;
    const userCpf = amb?.cpf || prof?.cpf;
    if (!cli && (userPhone || userCpf)) {
      cli = await findCustomerByCanonicalIdentity(admin, { phone: userPhone, cpf: userCpf });
    }
    if (!cli && amb?.id) {
      const { data } = await admin
        .from('clientes')
        .select('*')
        .eq('own_ambassador_id', amb.id)
        .maybeSingle();
      cli = data;
    }

    return {
      isLoggedIn: true,
      userData: {
        full_name: amb?.display_name || amb?.full_name || cli?.nome || prof?.nome || user.email || '',
        phone: amb?.phone || cli?.telefone || prof?.telefone || '',
        cpf: amb?.cpf || cli?.cpf || prof?.cpf || undefined,
        address: amb?.address || amb?.endereco || cli?.endereco || prof?.endereco || '',
        number: amb?.number || amb?.numero || cli?.numero || prof?.numero || '',
        neighborhood: amb?.neighborhood || amb?.bairro || cli?.bairro || prof?.bairro || '',
        city: amb?.city || amb?.cidade || cli?.cidade || prof?.cidade || 'Brasilia',
        state: amb?.state || amb?.estado || cli?.estado || prof?.estado || 'DF',
        cep: amb?.cep || cli?.cep || prof?.cep || '',
        ambassador_id: amb?.id,
        is_ambassador: !!amb || prof?.role === 'embaixador',
      },
    };
  } catch {
    return { isLoggedIn: false };
  }
}

export async function createStoreOrderAction(payload: StoreOrderPayload): Promise<{
  success: boolean;
  orderNumber?: string;
  orderId?: string;
  whatsappUrl?: string;
  checkoutToken?: string | null;
  paymentTiming?: PaymentTiming;
  paymentStatus?: PaymentStatus;
  error?: string;
}> {
  try {
    const admin = createAdminClient();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let clientName = payload.clientName?.trim();
    let clientPhone = normalizeCustomerPhone(payload.clientPhone);
    let ambassadorId: string | null = null;

    if (user) {
      const { data: amb } = await admin
        .from('ambassadors')
        .select('id, full_name, phone')
        .eq('user_id', user.id)
        .maybeSingle();
      if (amb) {
        ambassadorId = amb.id;
        if (!clientName) clientName = amb.full_name;
        if (!clientPhone) clientPhone = normalizeCustomerPhone(amb.phone);
      }
    }

    if (!clientName || !clientPhone) {
      return { success: false, error: 'Por favor, informe seu Nome Completo e Telefone / WhatsApp.' };
    }
    if (!/^\d{10,11}$/.test(clientPhone)) {
      return { success: false, error: 'Informe um telefone valido com DDD.' };
    }
    const clientCpf = normalizeCustomerCpf(payload.cpf);
    if (payload.cpf && !/^\d{11}$/.test(clientCpf || '')) {
      return { success: false, error: 'Informe um CPF valido com 11 digitos.' };
    }
    const clientEmail = normalizeCustomerEmail(payload.email);
    if (payload.email && (!clientEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail))) {
      return { success: false, error: 'Informe um e-mail valido.' };
    }
    if (!payload.items?.length || payload.items.length > 50) {
      return { success: false, error: 'O carrinho esta vazio ou excede o limite.' };
    }
    if (payload.items.some(item => {
      const hasProduto = Boolean(item.produto_id);
      const hasKit = Boolean(item.kit_id);
      return hasProduto === hasKit
        || !Number.isInteger(item.quantidade)
        || item.quantidade < 1
        || item.quantidade > 100;
    })) {
      return { success: false, error: 'Os itens do carrinho sao invalidos.' };
    }
    if (!['agora', 'na_entrega'].includes(payload.paymentTiming)) {
      return { success: false, error: 'Selecione quando deseja realizar o pagamento.' };
    }

    const normalizedPeriod = String(payload.period || '').trim().toLowerCase();
    if (!['manhademanha', 'tarde', 'noite', 'qualquer', 'ate_3_horas'].includes(normalizedPeriod)) {
      return { success: false, error: 'Selecione um período de entrega válido.' };
    }

    const scheduledIsoDate = normalizeStoreSchedulingDate(payload.scheduledDate);
    if (!scheduledIsoDate) {
      return { success: false, error: 'Selecione uma data de entrega valida.' };
    }

    const canonicalCustomer = await upsertPublicCustomerCanonical(admin, {
      fullName: clientName,
      phone: clientPhone,
      email: user?.email_confirmed_at ? user.email : clientEmail || undefined,
      cpf: clientCpf,
      address: payload.address,
      number: payload.number,
      neighborhood: payload.neighborhood,
      city: payload.city || 'Brasilia',
      state: payload.state || 'DF',
      cep: payload.cep,
      origin: 'loja_virtual_publica',
      source: 'smart_link',
    });
    const customerId = canonicalCustomer.customerId;

    if (user?.email_confirmed_at) {
      const { error: accountLinkError } = await admin.rpc(
        'fn_service_link_customer_auth_account',
        { p_auth_user_id: user.id },
      );
      if (accountLinkError) console.error('Falha ao vincular conta do cliente:', accountLinkError.message);
    }
    if (ambassadorId) {
      await admin.from('clientes').update({ own_ambassador_id: ambassadorId }).eq('id', customerId);
    }

    const fullEndereco = `${payload.address}${payload.number ? `, N ${payload.number}` : ''}`;
    const paymentMethodLower = (payload.paymentMethod || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const normalizedFormaPagamento: 'dinheiro' | 'pix' | 'cartao' = paymentMethodLower.includes('dinheiro')
      ? 'dinheiro'
      : paymentMethodLower.includes('cart') || paymentMethodLower.includes('debito') || paymentMethodLower.includes('credito')
        ? 'cartao'
        : 'pix';

    const { data: storeResult, error: storeError } = await admin.rpc(
      'fn_create_store_agendamento_with_control',
      {
        p_agendamento_data: {
          data_agendamento: scheduledIsoDate,
          periodo: normalizedPeriod,
          cliente_id: customerId,
          vendedor_id: null,
          forma_pagamento: normalizedFormaPagamento,
          observacoes: payload.notes
            ? `[Loja Virtual - Periodo: ${normalizedPeriod}] ${payload.notes}`
            : `[Agendamento via Loja Virtual - Periodo: ${normalizedPeriod}]`,
          nome_cliente: clientName,
          telefone_cliente: clientPhone,
          endereco_entrega: fullEndereco,
          bairro: payload.neighborhood,
          cidade: payload.city || 'Brasilia',
          estado: payload.state || 'DF',
          cep: payload.cep || '',
        },
        p_items_data: payload.items.map(item => ({
          ...(item.produto_id ? { produto_id: item.produto_id } : { kit_id: item.kit_id }),
          quantidade: item.quantidade,
        })),
        p_idempotency_key: payload.idempotencyKey || crypto.randomUUID(),
      },
    );

    if (storeError || !storeResult?.sucesso || !storeResult.agendamento_id) {
      throw new Error(storeError?.message || 'Nao foi possivel criar o agendamento da loja.');
    }

    const result = {
      id: String(storeResult.agendamento_id),
      numero_agendamento: storeResult.numero_agendamento,
    };
    const valorTotal = Number(storeResult.valor_total || 0);
    const payment = await configureSchedulingPayment(admin, result.id, valorTotal, payload.paymentTiming);

    revalidatePath('/loja');
    revalidatePath('/vendas/agendamentos');
    revalidatePath('/agendamento');

    const cleanPhone = '556132462117';
    const numAgendamento = result.numero_agendamento || result.id.slice(0, 8) || 'NOVO';
    const message = `*NOVO AGENDAMENTO REALIZADO NA LOJA VIRTUAL BRYZA*\n\n`
      + `*Agendamento N:* #${numAgendamento}\n`
      + `*Cliente:* ${clientName}\n`
      + `*Telefone:* ${clientPhone}\n`
      + `*Endereco:* ${fullEndereco} - ${payload.neighborhood}, ${payload.city}\n`
      + `*Data Agendada:* ${payload.scheduledDate} (${normalizedPeriod})\n`
      + `*Pagamento:* ${payload.paymentTiming === 'agora' ? 'Agora pelo Mercado Pago' : `Na entrega (${payload.paymentMethod})`}\n`
      + `*Valor Total:* R$ ${valorTotal.toFixed(2).replace('.', ',')}\n\n`
      + 'Gostaria de confirmar o agendamento da minha entrega!';

    return {
      success: true,
      orderNumber: numAgendamento,
      orderId: result.id,
      whatsappUrl: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      checkoutToken: payment.checkoutToken,
      paymentTiming: payload.paymentTiming,
      paymentStatus: payment.paymentStatus,
    };
  } catch (error: any) {
    console.error('Erro ao criar pedido na loja:', error);
    if (String(error?.message || '').includes('customer_identity_review_required')) {
      return {
        success: false,
        error: 'Os dados de CPF e telefone pertencem a cadastros diferentes. Fale com a equipe Bryza para revisar seu cadastro.',
      };
    }
    const errorMessage = String(error?.message || '');
    if (errorMessage.includes('scheduling_daily_limit_reached')) {
      return { success: false, error: 'A data escolhida atingiu o limite máximo de pedidos. Selecione outra data.' };
    }
    if (errorMessage.includes('scheduling_paused')) {
      return { success: false, error: 'Os agendamentos online estão temporariamente pausados. Tente novamente mais tarde.' };
    }
    if (errorMessage.includes('same_day_scheduling_disabled') || errorMessage.includes('same_day_window_closed')) {
      return { success: false, error: 'A entrega no mesmo dia não está mais disponível. Selecione uma data futura.' };
    }
    return { success: false, error: error?.message || 'Falha ao finalizar pedido na loja.' };
  }
}
