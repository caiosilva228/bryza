'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { getSyntheticEmail } from '@/utils/env';
import {
  findAmbassadorByCanonicalIdentity,
  normalizeCustomerIdentity,
  upsertPublicCustomerCanonical,
} from '@/lib/customers/canonical-identity';

export interface CadastroEmbaixadorInput {
  sponsorCode: string;
  fullName: string;
  phone: string;
  cpf: string;
  email: string;
  cep?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  complement?: string;
}

export interface CadastroEmbaixadorResult {
  success: boolean;
  message?: string;
  cleanPhone?: string;
  username?: string;
  referralCode?: string;
}

export async function cadastrarEmbaixadorPorConvite(
  input: CadastroEmbaixadorInput
): Promise<CadastroEmbaixadorResult> {
  try {
    const adminClient = createAdminClient();

    const rawSponsorCode = (input.sponsorCode || '').toLowerCase().trim();
    if (!/^bryza[0-9]+$/.test(rawSponsorCode)) {
      return { success: false, message: 'Código de patrocinador inválido.' };
    }

    // 1. Localizar Embaixador Patrocinador Ativo
    const { data: sponsorAmb, error: sponsorError } = await adminClient
      .from('ambassadors')
      .select('id, referral_code, status, full_name')
      .ilike('referral_code', rawSponsorCode)
      .eq('status', 'ativo')
      .maybeSingle();

    if (sponsorError || !sponsorAmb) {
      return {
        success: false,
        message: 'Embaixador patrocinador não encontrado ou inativo.',
      };
    }

    // Sanitizar campos
    const identity = normalizeCustomerIdentity({
      phone: input.phone,
      cpf: input.cpf,
      email: input.email,
    });
    const cleanPhone = identity.phone;
    const cleanCpf = identity.cpf || '';
    const cleanEmail = identity.email || '';
    const cleanFullName = (input.fullName || '').trim();

    if (cleanFullName.length < 3) {
      return { success: false, message: 'Informe o nome completo.' };
    }
    if (!/^\d{10,11}$/.test(cleanPhone)) {
      return { success: false, message: 'Informe um telefone/WhatsApp válido com DDD (10 ou 11 dígitos).' };
    }
    if (!/^\d{11}$/.test(cleanCpf)) {
      return { success: false, message: 'Informe um CPF válido com 11 dígitos.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Informe um e-mail válido.' };
    }

    // 2. Verificar se CPF ou Telefone já estão em uso na tabela ambassadors
    const existingAmb = await findAmbassadorByCanonicalIdentity(adminClient, {
      cpf: cleanCpf,
      phone: cleanPhone,
    });

    if (existingAmb) {
      if (normalizeCustomerIdentity({ cpf: existingAmb.cpf }).cpf === cleanCpf) {
        return { success: false, message: 'Este CPF já está cadastrado no Programa de Embaixadores.' };
      }
      return { success: false, message: 'Este número de telefone já está cadastrado no sistema.' };
    }

    // 3. Obter ou criar cliente pelo resolvedor canônico, sem comparação raw de CPF/telefone.
    const canonicalCustomer = await upsertPublicCustomerCanonical(adminClient, {
      fullName: cleanFullName.toUpperCase(),
      phone: cleanPhone,
      cpf: cleanCpf,
      email: cleanEmail,
      cep: input.cep,
      address: input.address,
      number: input.number,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state,
      origin: 'cadastro_convite_embaixador',
      referralCode: sponsorAmb.referral_code,
      source: 'smart_link',
    });
    const customerId = canonicalCustomer.customerId;
    const personId = canonicalCustomer.personId;

    if (!personId) {
      return { success: false, message: 'Não foi possível vincular a identidade do cadastro.' };
    }

    // 3.5. Obter Plano de Comissão Padrão do Programa
    const { data: progSettings } = await adminClient
      .from('ambassador_program_settings')
      .select('default_commission_plan_id')
      .eq('singleton', true)
      .maybeSingle();

    const defaultPlanId = progSettings?.default_commission_plan_id || null;

    // 4. Reaproveitar com segurança uma tentativa interrompida ou criar o
    // embaixador já vinculado à pessoa canônica do cliente.
    const { data: existingIncomplete, error: incompleteError } = await adminClient
      .from('ambassadors')
      .select('id, username, referral_code, cpf, phone, email')
      .or(`cpf.eq.${cleanCpf},phone.eq.${cleanPhone}`)
      .in('status', ['ativo', 'inativo'])
      .eq('lifecycle_status', 'active')
      .is('user_id', null)
      .limit(1)
      .maybeSingle();

    if (incompleteError) {
      console.error('Erro ao consultar cadastro incompleto de embaixador:', incompleteError);
      return { success: false, message: 'Falha ao validar uma tentativa anterior de cadastro.' };
    }

    if (existingIncomplete) {
      const previousIdentity = normalizeCustomerIdentity({
        cpf: existingIncomplete.cpf,
        phone: existingIncomplete.phone,
        email: existingIncomplete.email,
      });
      if (
        previousIdentity.cpf !== cleanCpf
        || previousIdentity.phone !== cleanPhone
        || previousIdentity.email !== cleanEmail
      ) {
        return {
          success: false,
          message: 'Existe um cadastro incompleto com dados divergentes. Procure a gestão Bryza.',
        };
      }
    }

    const ambassadorWrite = {
      person_id: personId,
      parent_ambassador_id: sponsorAmb.id,
      commission_plan_id: defaultPlanId,
      status: 'ativo',
      cep: input.cep || null,
      address: input.address || null,
      number: input.number || null,
      neighborhood: input.neighborhood || null,
      city: input.city || null,
      state: input.state ? input.state.toUpperCase() : null,
      notes: `Cadastrado via link de convite do embaixador ${sponsorAmb.referral_code}`,
    };

    const ambassadorMutation = existingIncomplete
      ? adminClient
          .from('ambassadors')
          .update(ambassadorWrite)
          .eq('id', existingIncomplete.id)
      : adminClient
          .from('ambassadors')
          .insert({
            ...ambassadorWrite,
            full_name: cleanFullName,
            display_name: cleanFullName,
            phone: cleanPhone,
            email: cleanEmail,
            cpf: cleanCpf,
          });

    const { data: newAmbassador, error: createAmbError } = await ambassadorMutation
      .select('id, username, referral_code')
      .single();

    if (createAmbError || !newAmbassador) {
      console.error('Erro ao criar registro de embaixador:', createAmbError);
      return { success: false, message: 'Falha ao registrar a conta de embaixador.' };
    }

    // Vincular cliente ao embaixador próprio (own_ambassador_id)
    const { error: customerLinkError } = await adminClient
      .from('clientes')
      .update({ own_ambassador_id: newAmbassador.id })
      .eq('id', customerId);

    if (customerLinkError) {
      console.error('Erro ao vincular cliente ao embaixador:', customerLinkError);
      await adminClient
        .from('ambassadors')
        .update({ status: 'inativo' })
        .eq('id', newAmbassador.id)
        .is('user_id', null);
      return { success: false, message: 'Não foi possível concluir o vínculo do cadastro.' };
    }

    // 5. Criar Conta Auth no Supabase
    const syntheticEmail = getSyntheticEmail(newAmbassador.username);
    const { data: authData, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password: cleanPhone,
      email_confirm: true,
      user_metadata: { nome: cleanFullName },
    });

    if (createAuthError || !authData.user) {
      console.error('Erro ao criar conta Auth para o embaixador:', createAuthError);
      await adminClient
        .from('clientes')
        .update({ own_ambassador_id: null })
        .eq('id', customerId)
        .eq('own_ambassador_id', newAmbassador.id);
      await adminClient
        .from('ambassadors')
        .update({ status: 'inativo' })
        .eq('id', newAmbassador.id)
        .is('user_id', null);
      return { success: false, message: 'Não foi possível provisionar o seu acesso inicial.' };
    }

    const authUserId = authData.user.id;

    // 6. Provisionar de forma atômica perfil, conta canônica, permissão e
    // vínculo do embaixador. O convite exige troca de senha no primeiro acesso.
    const { data: provisionData, error: provisionError } = await adminClient.rpc(
      'fn_service_provision_invited_ambassador',
      {
        p_ambassador_id: newAmbassador.id,
        p_auth_user_id: authUserId,
        p_person_id: personId,
      }
    );
    const provision = provisionData as { status?: string } | null;

    if (provisionError || provision?.status !== 'linked') {
      console.error('Erro ao provisionar acesso canônico do embaixador:', {
        provisionError,
        provision,
      });
      await adminClient.auth.admin.deleteUser(authUserId);
      await adminClient
        .from('clientes')
        .update({ own_ambassador_id: null })
        .eq('id', customerId)
        .eq('own_ambassador_id', newAmbassador.id);
      await adminClient
        .from('ambassadors')
        .update({ status: 'inativo' })
        .eq('id', newAmbassador.id)
        .is('user_id', null);
      return { success: false, message: 'Não foi possível concluir o acesso seguro do embaixador.' };
    }

    return {
      success: true,
      cleanPhone,
      username: newAmbassador.username,
      referralCode: newAmbassador.referral_code,
    };
  } catch (err: any) {
    console.error('Erro inesperado no cadastro de embaixador:', err);
    return { success: false, message: 'Ocorreu um erro ao processar seu cadastro. Tente novamente.' };
  }
}
