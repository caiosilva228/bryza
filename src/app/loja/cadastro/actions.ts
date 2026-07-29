'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { getSyntheticEmail } from '@/utils/env';
import {
  findAmbassadorByCanonicalIdentity,
  normalizeCustomerIdentity,
  upsertPublicCustomerCanonical,
} from '@/lib/customers/canonical-identity';

export type StoreSponsor = {
  name: string;
  code: string;
  city: string | null;
};

export type StoreRegistrationInput = {
  sponsorCode?: string;
  fullName: string;
  phone: string;
  cpf: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  cep: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  complement?: string;
};

export type StoreRegistrationResult =
  | {
      success: true;
      signedIn: boolean;
      username: string;
      referralCode: string;
    }
  | { success: false; message: string };

export async function validateStoreSponsor(
  rawCode: string,
): Promise<
  | { success: true; sponsor: StoreSponsor }
  | { success: false; message: string }
> {
  const code = rawCode.toLowerCase().trim();
  if (!/^bryza[0-9]+$/.test(code)) {
    return { success: false, message: 'Informe um Código Bryza válido.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('ambassadors')
    .select('display_name, full_name, referral_code, city')
    .ilike('referral_code', code)
    .eq('status', 'ativo')
    .maybeSingle();

  if (error || !data) {
    return { success: false, message: 'Embaixador não encontrado ou inativo.' };
  }

  return {
    success: true,
    sponsor: {
      name: data.display_name || data.full_name || data.referral_code,
      code: data.referral_code,
      city: data.city || null,
    },
  };
}

export async function registerStoreCustomerAmbassador(
  input: StoreRegistrationInput,
): Promise<StoreRegistrationResult> {
  const admin = createAdminClient();
  const sponsorCode = (input.sponsorCode || '').toLowerCase().trim();
  const identity = normalizeCustomerIdentity({
    phone: input.phone,
    cpf: input.cpf,
    email: input.email,
  });
  const fullName = input.fullName.trim();
  const phone = identity.phone;
  const cpf = identity.cpf || '';
  const email = identity.email || '';
  const state = input.state.trim().toUpperCase();

  if (fullName.length < 3 || fullName.length > 200) {
    return { success: false, message: 'Informe seu nome completo.' };
  }
  if (!/^\d{10,11}$/.test(phone)) {
    return { success: false, message: 'Informe um telefone com DDD válido.' };
  }
  if (!/^\d{11}$/.test(cpf)) {
    return { success: false, message: 'Informe um CPF válido.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: 'Informe um e-mail válido.' };
  }
  if (input.password.length < 8 || input.password.length > 72) {
    return { success: false, message: 'A senha deve ter entre 8 e 72 caracteres.' };
  }
  if (input.password !== input.passwordConfirmation) {
    return { success: false, message: 'A confirmação da senha não confere.' };
  }
  if (
    input.cep.replace(/\D/g, '').length !== 8
    || !input.address.trim()
    || !input.number.trim()
    || !input.neighborhood.trim()
    || !input.city.trim()
    || !/^[A-Z]{2}$/.test(state)
  ) {
    return { success: false, message: 'Preencha o endereço completo.' };
  }

  let sponsor: { id: string; referral_code: string } | null = null;
  if (sponsorCode) {
    if (!/^bryza[0-9]+$/.test(sponsorCode)) {
      return { success: false, message: 'Código de indicação inválido.' };
    }
    const { data, error } = await admin
      .from('ambassadors')
      .select('id, referral_code')
      .ilike('referral_code', sponsorCode)
      .eq('status', 'ativo')
      .maybeSingle();
    if (error || !data) {
      return { success: false, message: 'Embaixador indicado não encontrado ou inativo.' };
    }
    sponsor = data;
  }

  const existingAmbassador = await findAmbassadorByCanonicalIdentity(admin, {
    cpf,
    phone,
  });
  if (existingAmbassador) {
    return {
      success: false,
      message: 'Este CPF ou telefone já possui cadastro. Use a opção Entrar.',
    };
  }

  try {
    const canonicalCustomer = await upsertPublicCustomerCanonical(admin, {
      fullName: fullName.toUpperCase(),
      phone,
      cpf,
      email,
      cep: input.cep,
      address: input.address,
      number: input.number,
      neighborhood: input.neighborhood,
      city: input.city,
      state,
      origin: 'cadastro_loja_cliente_embaixador',
      referralCode: sponsor?.referral_code,
      source: 'smart_link',
    });

    const { data: settings } = await admin
      .from('ambassador_program_settings')
      .select('default_commission_plan_id')
      .eq('singleton', true)
      .maybeSingle();

    // Reaproveitar qualquer cadastro sem Auth deixado por uma tentativa interrompida.
    // A falha pode acontecer depois de o embaixador já ter sido ativado.
    const { data: existingIncomplete } = await admin
      .from('ambassadors')
      .select('id, username, referral_code')
      .or(`cpf.eq.${cpf},phone.eq.${phone}`)
      .in('status', ['ativo', 'inativo'])
      .eq('lifecycle_status', 'active')
      .is('user_id', null)
      .limit(1)
      .maybeSingle();

    let ambassador: { id: string; username: string; referral_code: string } | null = null;

    if (existingIncomplete) {
      // Reativar o registro incompleto anterior com os dados atuais
      const { data: reactivated, error: reactivateError } = await admin
        .from('ambassadors')
        .update({
          person_id: canonicalCustomer.personId || null,
          full_name: fullName,
          display_name: fullName,
          phone,
          email,
          cpf,
          status: 'ativo',
          cep: input.cep,
          address: input.address.trim(),
          number: input.number.trim(),
          neighborhood: input.neighborhood.trim(),
          city: input.city.trim(),
          state,
          notes: sponsor
            ? `Cadastro reativado com indicação ${sponsor.referral_code}`
            : 'Cadastro reativado pela loja',
        })
        .eq('id', existingIncomplete.id)
        .select('id, username, referral_code')
        .single();

      if (reactivateError || !reactivated) {
        console.error('Falha ao reativar embaixador:', reactivateError);
        return { success: false, message: 'Não foi possível recuperar seu cadastro anterior.' };
      }
      ambassador = reactivated;
    } else {
      // Criar novo ambassador
      const { data: newAmbassador, error: ambassadorError } = await admin
        .from('ambassadors')
        .insert({
          person_id: canonicalCustomer.personId || null,
          full_name: fullName,
          display_name: fullName,
          phone,
          email,
          cpf,
          parent_ambassador_id: sponsor?.id || null,
          commission_plan_id: settings?.default_commission_plan_id || null,
          status: 'ativo',
          cep: input.cep,
          address: input.address.trim(),
          number: input.number.trim(),
          neighborhood: input.neighborhood.trim(),
          city: input.city.trim(),
          state,
          notes: sponsor
            ? `Cadastro realizado pela loja com indicação ${sponsor.referral_code}`
            : 'Cadastro realizado pela loja sem indicação',
        })
        .select('id, username, referral_code')
        .single();

      if (ambassadorError || !newAmbassador) {
        console.error('Falha ao criar embaixador pela loja:', ambassadorError);
        return { success: false, message: 'Não foi possível criar o cadastro de embaixador.' };
      }
      ambassador = newAmbassador;
    }


    await admin
      .from('clientes')
      .update({ own_ambassador_id: ambassador.id })
      .eq('id', canonicalCustomer.customerId);

    const syntheticEmail = getSyntheticEmail(ambassador.username);
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      password: input.password,
      email_confirm: true,
      user_metadata: { nome: fullName },
    });

    if (authError || !authData.user) {
      console.error('Falha ao criar acesso Auth pela loja:', authError);
      await admin
        .from('ambassadors')
        .update({ status: 'inativo' })
        .eq('id', ambassador.id)
        .is('user_id', null);
      return { success: false, message: 'Não foi possível criar seu acesso seguro.' };
    }

    // Função SQL dedicada que provisiona atomicamente:
    // person_business_roles (customer + ambassador), person_accounts,
    // profiles, person_access_permissions e atualiza ambassadors.user_id
    const { data: provisionData, error: provisionError } = await admin.rpc(
      'fn_service_provision_store_ambassador',
      {
        p_ambassador_id: ambassador.id,
        p_auth_user_id: authData.user.id,
        p_person_id: canonicalCustomer.personId,
      },
    );
    const provision = provisionData as { status?: string } | null;

    if (provisionError || provision?.status !== 'linked') {
      console.error('Falha no vínculo canônico do cadastro da loja:', {
        provisionError,
        provision,
      });
      await admin.auth.admin.deleteUser(authData.user.id);
      await admin
        .from('ambassadors')
        .update({ status: 'inativo' })
        .eq('id', ambassador.id)
        .is('user_id', null);
      return {
        success: false,
        message: 'O cadastro não pôde ser vinculado com segurança. Tente novamente.',
      };
    }

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: input.password,
    });

    if (signInError) {
      console.error('Cadastro concluído, mas a sessão automática falhou:', signInError);
      return {
        success: false,
        message: 'Seu cadastro foi concluído, mas não foi possível iniciar a sessão. Use a opção Entrar.',
      };
    }

    return {
      success: true,
      signedIn: true,
      username: ambassador.username,
      referralCode: ambassador.referral_code,
    };
  } catch (error) {
    console.error('Erro inesperado no cadastro cliente/embaixador da loja:', error);
    return { success: false, message: 'Não foi possível concluir o cadastro agora.' };
  }
}
