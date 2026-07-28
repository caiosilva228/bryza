'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { Produto } from '@/models/types';
import { createPedido } from '@/services/pedidos';

export interface StoreCartItem {
  produto: Produto;
  quantidade: number;
}

export interface StoreOrderPayload {
  clientName?: string;
  clientPhone?: string;
  address: string;
  number?: string;
  neighborhood: string;
  city: string;
  state?: string;
  cep?: string;
  scheduledDate: string;
  period: 'manhademanha' | 'tarde' | 'noite' | string;
  paymentMethod: string;
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

    // Tentar buscar como embaixador
    const { data: amb } = await admin
      .from('ambassadors')
      .select('id, full_name, phone, address, number, neighborhood, city, state, cep')
      .eq('user_id', user.id)
      .maybeSingle();

    if (amb) {
      return {
        isLoggedIn: true,
        userData: {
          full_name: amb.full_name || '',
          phone: amb.phone || '',
          address: amb.address || '',
          number: amb.number || '',
          neighborhood: amb.neighborhood || '',
          city: amb.city || 'Brasília',
          state: amb.state || 'DF',
          cep: amb.cep || '',
          ambassador_id: amb.id,
        }
      };
    }

    // Caso não seja embaixador, buscar perfil
    const { data: prof } = await admin
      .from('profiles')
      .select('nome, telefone')
      .eq('id', user.id)
      .maybeSingle();

    return {
      isLoggedIn: true,
      userData: {
        full_name: prof?.nome || user.email || '',
        phone: prof?.telefone || '',
        address: '',
        number: '',
        neighborhood: '',
        city: 'Brasília',
        state: 'DF',
        cep: '',
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

    // Criar ou atualizar cliente no cadastro público/loja
    let customerId: string | null = null;
    const { data: existingCustomer } = await admin
      .from('clientes')
      .select('id')
      .eq('telefone', clientPhone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
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
          status_cliente: 'lead'
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
    const idempotencyKey = `store_${user?.id || 'guest'}_${Date.now()}`;

    const pedidoData: any = {
      cliente_id: customerId,
      nome_cliente: clientName,
      telefone_cliente: clientPhone,
      endereco: fullEndereco,
      cidade: payload.city,
      bairro: payload.neighborhood,
      estado: payload.state || 'DF',
      cep: payload.cep || '',
      ambassador_id: ambassadorId,
      valor_total: valorTotal,
      forma_pagamento: payload.paymentMethod,
      data_agendamento: payload.scheduledDate,
      periodo_agendamento: payload.period,
      status_pedido: 'aguardando_preparacao',
      observacoes: payload.notes ? `[Loja Virtual] ${payload.notes}` : '[Pedido via Loja Virtual Público]',
    };

    const result = await createPedido(pedidoData, itensPedido, idempotencyKey);

    revalidatePath('/loja');
    revalidatePath('/vendas/pedidos');

    // Gerar link formatado para o WhatsApp da Bryza
    const cleanPhone = '556132462117';
    const numPedido = result.order_number || result.order_id || 'NOVO';
    const message = `*NOVO PEDIDO REALIZADO NA LOJA VIRTUAL BRYZA* ✨\n\n` +
      `• *Pedido Nº:* #${numPedido}\n` +
      `• *Cliente:* ${clientName}\n` +
      `• *Telefone:* ${clientPhone}\n` +
      `• *Endereço:* ${fullEndereco} - ${payload.neighborhood}, ${payload.city}\n` +
      `• *Agendamento:* ${payload.scheduledDate} (${payload.period})\n` +
      `• *Pagamento:* ${payload.paymentMethod}\n` +
      `• *Valor Total:* R$ ${valorTotal.toFixed(2).replace('.', ',')}\n\n` +
      `Aguardando confirmação e separação!`;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    return {
      success: true,
      orderNumber: numPedido,
      orderId: result.order_id,
      whatsappUrl
    };
  } catch (err: any) {
    console.error('Erro ao criar pedido na loja:', err);
    return { success: false, error: err.message || 'Falha ao finalizar pedido na loja.' };
  }
}
