'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

// Helper de validação do usuário logado
async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Sessão inválida');
  }
  return { supabase, user };
}

// 1. Dashboard e Métricas do Embaixador
export async function getPortalDashboardData() {
  const { supabase } = await getAuthenticatedUser();
  const { data, error } = await supabase.rpc('fn_get_embaixador_dashboard_metrics');

  if (error) {
    console.error('Erro na RPC de dashboard do embaixador:', error);
    throw new Error(error.message || 'Erro ao carregar métricas do painel');
  }

  return data;
}

// 2. Minhas Indicações Paginadas
export async function getMinhasIndicacoes(params?: { page?: number; limit?: number; status?: string }) {
  const { supabase } = await getAuthenticatedUser();
  const limit = Math.min(Math.max(params?.limit || 10, 1), 50);
  const page = Math.max(params?.page || 1, 1);
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc('fn_get_embaixador_indicacoes', {
    p_limit: limit,
    p_offset: offset,
    p_status: params?.status || null
  });

  if (error) {
    console.error('Erro na RPC de indicações:', error);
    throw new Error(error.message || 'Erro ao carregar indicações');
  }

  return data as { items: any[]; total: number };
}

// 3. Minhas Vendas Paginadas
export async function getMinhasVendas(params?: { page?: number; limit?: number; status?: string }) {
  const { supabase } = await getAuthenticatedUser();
  const limit = Math.min(Math.max(params?.limit || 10, 1), 50);
  const page = Math.max(params?.page || 1, 1);
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc('fn_get_embaixador_vendas', {
    p_limit: limit,
    p_offset: offset,
    p_status_pedido: params?.status || null
  });

  if (error) {
    console.error('Erro na RPC de vendas:', error);
    throw new Error(error.message || 'Erro ao carregar vendas');
  }

  return data as { items: any[]; total: number };
}

// 4. Minhas Comissões Paginadas
export async function getMinhasComissoes(params?: { page?: number; limit?: number; status?: string }) {
  const { supabase } = await getAuthenticatedUser();
  const limit = Math.min(Math.max(params?.limit || 10, 1), 50);
  const page = Math.max(params?.page || 1, 1);
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc('fn_get_embaixador_comissoes', {
    p_limit: limit,
    p_offset: offset,
    p_status: params?.status || null
  });

  if (error) {
    console.error('Erro na RPC de comissões:', error);
    throw new Error(error.message || 'Erro ao carregar comissões');
  }

  return data as { items: any[]; total: number };
}

// 5. Meus Pagamentos Paginados
export async function getMeusPagamentos(params?: { page?: number; limit?: number }) {
  const { supabase } = await getAuthenticatedUser();
  const limit = Math.min(Math.max(params?.limit || 10, 1), 50);
  const page = Math.max(params?.page || 1, 1);
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc('fn_get_embaixador_pagamentos', {
    p_limit: limit,
    p_offset: offset
  });

  if (error) {
    console.error('Erro na RPC de pagamentos:', error);
    throw new Error(error.message || 'Erro ao carregar pagamentos');
  }

  return data as { items: any[]; total: number };
}

// 6. Signed URL de Comprovante de Pagamento (Com Validação Estrita em Cascata no Banco)
export async function getComprovantePaymentUrl(paymentId: string) {
  const { supabase, user } = await getAuthenticatedUser();

  // Validação em cascata no banco: paymentId pertence ao ambassador do user.id?
  const { data: cp, error: cpError } = await supabase
    .from('commission_payments')
    .select(`
      id,
      receipt_path,
      ambassador:ambassador_id!inner(user_id)
    `)
    .eq('id', paymentId)
    .single();

  if (cpError || !cp || !cp.receipt_path) {
    throw new Error('Comprovante não encontrado ou acesso não autorizado');
  }

  const ambUserId = (cp.ambassador as any)?.user_id;
  if (ambUserId !== user.id) {
    throw new Error('Acesso não autorizado ao comprovante');
  }

  // Gerar signed URL temporária de 5 minutos no storage privado payment-receipts
  const adminClient = createAdminClient();
  const { data, error: urlError } = await adminClient.storage
    .from('payment-receipts')
    .createSignedUrl(cp.receipt_path, 300);

  if (urlError || !data?.signedUrl) {
    throw new Error('Erro ao gerar link de acesso ao comprovante');
  }

  return data.signedUrl;
}

// 7. Atualização do Perfil Próprio do Embaixador (Somente campos autorizados)
export async function atualizarMeuPerfil(payload: {
  phone?: string;
  instagram?: string;
  city?: string;
  state?: string;
  pix_type?: string;
  pix_key?: string;
  photo_path?: string;
}) {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase.rpc('fn_update_meu_perfil', {
    p_phone: payload.phone || null,
    p_instagram: payload.instagram || null,
    p_city: payload.city || null,
    p_state: payload.state || null,
    p_pix_type: payload.pix_type || null,
    p_pix_key: payload.pix_key || null,
    p_photo_path: payload.photo_path || null
  });

  if (error) {
    console.error('Erro ao atualizar perfil do embaixador:', error);
    throw new Error(error.message || 'Falha ao atualizar perfil');
  }

  revalidatePath('/embaixador/perfil');
  revalidatePath('/embaixador/dashboard');
  return data;
}

// 8. Signed URL de Foto Própria do Embaixador
export async function getSignedProfilePhotoUrl(photoPath: string) {
  const { user } = await getAuthenticatedUser();

  if (!photoPath.startsWith(`${user.id}/`) && !photoPath.includes(user.id)) {
    // Validação de diretório de foto própria
    const adminClient = createAdminClient();
    const { data: amb } = await adminClient
      .from('ambassadors')
      .select('photo_path')
      .eq('user_id', user.id)
      .single();

    if (!amb || amb.photo_path !== photoPath) {
      throw new Error('Acesso negado à foto solicitada');
    }
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.storage
    .from('ambassador-photos')
    .createSignedUrl(photoPath, 300);

  if (error || !data) return null;
  return data.signedUrl;
}
