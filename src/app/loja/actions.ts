'use server';

import crypto from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { Produto } from '@/models/types';
import { createAgendamento } from '@/services/agendamentos';
import {
  configureSchedulingPayment,
  type PaymentStatus,
  type PaymentTiming,
} from '@/lib/payments/payment-intents';

export interface StoreCartItem {
  produto: Produto;
  quantidade: number;
}

export interface StoreOrderPayload {
  clientName?: string;
  clientPhone?: string;
  cpf?: string;
  address: string;
  number?: string;
  neighborhood: string;
  city: string;
  state?: string;
  cep?: string;
  scheduledDate: string;
  period: 'manhademanha' | 'tarde' | 'noite' | string;
  paymentMethod: string;
  paymentTiming: PaymentTiming;
  notes?: string;
  items: Array<{
    produto_id: string;
    quantidade: number;
    preco_unitario: number;
  }>;
}

// 1. Buscar produtos ativos disponíveis para a Loja Virtual (Público)
export async function getStoreProductsAction(): Promise<{
  success: boolean;
  produtos?: Produto[];
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
      return { success: false, error: 'Não foi possível carregar os produtos.' };
    }

    return { success: true, produtos: data as Produto[] };
  } catch (err: any) {
    console.error('Erro em getStoreProductsAction:', err);
    return { success: false, error: 'Falha técnica ao carregar produtos.' };
  }
}

// 2. Buscar informações do usuário logado (opcional - funciona sem estar logado)
export async function getStoreUserInfoAction(): Promise<{
  isLoggedIn: boolean;
  userData?: {
    full_name: string;
    phone: string;
    address: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    ambassador_id?: string;
  };
}> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { isLoggedIn: false };
    }

    const admin = createAdminClient();

    let amb: any = null;
    let prof: any = null;
    let cli: any = null;

    // 1. Tentar buscar embaixador pelo user_id ou email
    if (user.id) {
      const { data } = await admin
        .from('ambassadors')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      amb = data;
    }

    if (!amb && user.email) {
      const { data } = await admin
        .from('ambassadors')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      amb = data;
    }

    // 2. Buscar em profiles
    if (user.id) {
      const { data } = await admin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      prof = data;
    }

    // 3. Buscar em clientes por email, telefone, cpf ou own_ambassador_id
    const userPhone = amb?.phone || prof?.telefone;
    const userCpf = amb?.cpf || prof?.cpf;

    if (user.email) {
      const { data } = await admin
        .from('clientes')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      cli = data;
    }

    if (!cli && userPhone) {
      const { data } = await admin
        .from('clientes')
        .select('*')
        .eq('telefone', userPhone)
        .maybeSingle();
      cli = data;
    }

    if (!cli && userCpf) {
      const { data } = await admin
        .from('clientes')
        .select('*')
        .eq('cpf', userCpf)
        .maybeSingle();
      cli = data;
    }

    if (!cli && amb?.id) {
      const { data } = await admin
        .from('clientes')
        .select('*')
        .eq('own_ambassador_id', amb.id)
        .maybeSingle();
      cli = data;
    }

    const full_name = amb?.display_name || amb?.full_name || cli?.nome || prof?.nome || user.email || '';
    const phone = amb?.phone || cli?.telefone || prof?.telefone || '';
    const address = amb?.address || amb?.endereco || cli?.endereco || prof?.endereco || '';
    const number = amb?.number || amb?.numero || cli?.numero || prof?.numero || '';
    const neighborhood = amb?.neighborhood || amb?.bairro || cli?.bairro || prof?.bairro || '';
    const city = amb?.city || amb?.cidade || cli?.cidade || prof?.cidade || 'Brasília';
    const state = amb?.state || amb?.estado || cli?.estado || prof?.estado || 'DF';
    const cep = amb?.cep || cli?.cep || prof?.cep || '';

    return {
      isLoggedIn: true,
      userData: {
        full_name,
        phone,
        address,
        number,
        neighborhood,
        city,
        state,
        cep,
        ambassador_id: amb?.id,
      }
    };
  } catch (err) {
    return { isLoggedIn: false };
  }
}

// 3. Registrar o pedido realizado na Loja Virtual (suporta usuários logados e visitantes)
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

    // Verificar se há usuário logado
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let clientName = payload.clientName?.trim();
    let clientPhone = payload.clientPhone?.trim();
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
        if (!clientPhone) clientPhone = amb.phone;
      }
    }

    if (!clientName || !clientPhone) {
      return { success: false, error: 'Por favor, informe seu Nome Completo e Telefone / WhatsApp.' };
    }

    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: 'O carrinho está vazio.' };
    }
    if (!['agora', 'na_entrega'].includes(payload.paymentTiming)) {
      return { success: false, error: 'Selecione quando deseja realizar o pagamento.' };
    }

    // Criar ou atualizar cliente no cadastro público/loja
    let customerId: string | null = null;
    const { data: existingCustomer } = await admin
      .from('clientes')
      .select('id, own_ambassador_id')
      .eq('telefone', clientPhone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      if (ambassadorId && existingCustomer.own_ambassador_id !== ambassadorId) {
        await admin
          .from('clientes')
          .update({ own_ambassador_id: ambassadorId })
          .eq('id', existingCustomer.id);
      }
    } else {
      const { data: newCustomer } = await admin
        .from('clientes')
        .insert({
          nome: clientName,
          telefone: clientPhone,
          endereco: payload.address,
          numero: payload.number || null,
          bairro: payload.neighborhood,
          cidade: payload.city || 'Brasília',
          estado: payload.state || 'DF',
          cep: payload.cep || null,
          origem: 'loja_virtual_publica',
          status_cliente: 'lead',
          own_ambassador_id: ambassadorId,
        })
        .select('id')
        .single();

      if (newCustomer) {
        customerId = newCustomer.id;
      }
    }

    // Calcular totais
    let valorTotal = 0;
    const itensPedido = payload.items.map(item => {
      const subtotal = item.quantidade * item.preco_unitario;
      valorTotal += subtotal;
      return {
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        subtotal
      };
    });

    const fullEndereco = `${payload.address}${payload.number ? `, Nº ${payload.number}` : ''}`;
    const paymentMethodLower = (payload.paymentMethod || '').toLowerCase();
    let normalizedFormaPagamento: 'dinheiro' | 'pix' | 'cartao' = 'pix';
    if (paymentMethodLower.includes('dinheiro')) {
      normalizedFormaPagamento = 'dinheiro';
    } else if (paymentMethodLower.includes('cart') || paymentMethodLower.includes('débito') || paymentMethodLower.includes('crédito')) {
      normalizedFormaPagamento = 'cartao';
    } else {
      normalizedFormaPagamento = 'pix';
    }

    // Formatar data de agendamento válida (ISO string)
    let scheduledIsoDate = new Date().toISOString();
    if (payload.scheduledDate) {
      try {
        const parts = payload.scheduledDate.split('-');
        if (parts.length === 3) {
          scheduledIsoDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0).toISOString();
        } else {
          scheduledIsoDate = new Date(payload.scheduledDate).toISOString();
        }
      } catch {
        scheduledIsoDate = new Date().toISOString();
      }
    }

    const agendamentoData: any = {
      data_agendamento: scheduledIsoDate,
      cliente_id: customerId,
      vendedor_id: null,
      valor_total: valorTotal,
      forma_pagamento: normalizedFormaPagamento,
      attribution_source: 'smart_link',
      observacoes: payload.notes ? `[Loja Virtual - Período: ${payload.period}] ${payload.notes}` : `[Agendamento via Loja Virtual - Período: ${payload.period}]`,
      nome_cliente: clientName,
      telefone_cliente: clientPhone,
      endereco_entrega: fullEndereco,
      bairro: payload.neighborhood,
      cidade: payload.city || 'Brasília',
      estado: payload.state || 'DF',
      cep: payload.cep || '',
      // A compra do próprio embaixador não é uma autoindicação.
      ambassador_id: null,
    };

    const itensAgendamento = payload.items.map(item => ({
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      subtotal: item.quantidade * item.preco_unitario,
      desconto_aplicado: 0
    }));

    const result = await createAgendamento(agendamentoData, itensAgendamento, admin);
    const payment = await configureSchedulingPayment(
      admin,
      result.id,
      valorTotal,
      payload.paymentTiming,
    );

    revalidatePath('/loja');
    revalidatePath('/vendas/agendamentos');
    revalidatePath('/agendamento');

    // Gerar link formatado para o WhatsApp da Bryza
    const cleanPhone = '556132462117';
    const numAgendamento = (result as any).numero_agendamento || (result as any).id?.slice(0, 8) || 'NOVO';
    const message = `*NOVO AGENDAMENTO REALIZADO NA LOJA VIRTUAL BRYZA* ✨\n\n` +
      `• *Agendamento Nº:* #${numAgendamento}\n` +
      `• *Cliente:* ${clientName}\n` +
      `• *Telefone:* ${clientPhone}\n` +
      `• *Endereço:* ${fullEndereco} - ${payload.neighborhood}, ${payload.city}\n` +
      `• *Data Agendada:* ${payload.scheduledDate} (${payload.period})\n` +
      `• *Pagamento:* ${payload.paymentTiming === 'agora' ? 'Agora pelo Mercado Pago' : `Na entrega (${payload.paymentMethod})`}\n` +
      `• *Valor Total:* R$ ${valorTotal.toFixed(2).replace('.', ',')}\n\n` +
      `Gostaria de confirmar o agendamento da minha entrega!`;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    return {
      success: true,
      orderNumber: numAgendamento,
      orderId: result.id,
      whatsappUrl,
      checkoutToken: payment.checkoutToken,
      paymentTiming: payload.paymentTiming,
      paymentStatus: payment.paymentStatus,
    };
  } catch (err: any) {
    console.error('Erro ao criar pedido na loja:', err);
    return { success: false, error: err.message || 'Falha ao finalizar pedido na loja.' };
  }
}
