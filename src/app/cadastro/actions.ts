'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { getSyntheticEmail } from '@/utils/env';

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
    const cleanPhone = (input.phone || '').replace(/\D/g, '');
    const cleanCpf = (input.cpf || '').replace(/\D/g, '');
    const cleanEmail = (input.email || '').trim().toLowerCase();
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
    const { data: existingAmb } = await adminClient
      .from('ambassadors')
      .select('id, phone, cpf')
      .or(`cpf.eq.${cleanCpf},phone.eq.${cleanPhone}`)
      .maybeSingle();

    if (existingAmb) {
      if (existingAmb.cpf === cleanCpf) {
        return { success: false, message: 'Este CPF já está cadastrado no Programa de Embaixadores.' };
      }
      return { success: false, message: 'Este número de telefone já está cadastrado no sistema.' };
    }

    // 3. Obter ou Criar Cliente Canônico com Vínculo ao Embaixador Patrocinador
    let customerId: string | null = null;
    const { data: existingCustomer } = await adminClient
      .from('clientes')
      .select('id')
      .or(`cpf.eq.${cleanCpf},telefone.eq.${cleanPhone}`)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Atualizar atribuição de indicação do patrocinador no cliente existente
      await adminClient
        .from('clientes')
        .update({
          ambassador_id: sponsorAmb.id,
          commissionable_ambassador_id: sponsorAmb.id,
          referral_code: sponsorAmb.referral_code,
          referral_source: 'smart_link',
          referral_attributed_at: new Date().toISOString(),
        })
        .eq('id', customerId);
    } else {
      const { data: newCustomer, error: createCustomerError } = await adminClient
        .from('clientes')
        .insert({
          nome: cleanFullName.toUpperCase(),
          telefone: cleanPhone,
          email: cleanEmail,
          cpf: cleanCpf,
          cep: input.cep || '',
          endereco: input.address || '',
          numero: input.number || '',
          bairro: input.neighborhood || '',
          cidade: input.city || '',
          estado: input.state ? input.state.toUpperCase() : '',
          origem: 'cadastro_convite_embaixador',
          status_cliente: 'lead',
          lifecycle_status: 'active',
          ambassador_id: sponsorAmb.id,
          commissionable_ambassador_id: sponsorAmb.id,
          referral_code: sponsorAmb.referral_code,
          referral_source: 'smart_link',
          referral_attributed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (createCustomerError || !newCustomer) {
        console.error('Erro ao criar cliente para novo embaixador:', createCustomerError);
        return { success: false, message: 'Não foi possível cadastrar seus dados de cliente.' };
      }
      customerId = newCustomer.id;
    }

    // 4. Inserir novo embaixador (com parent_ambassador_id vinculado ao patrocinador)
    const { data: newAmbassador, error: createAmbError } = await adminClient
      .from('ambassadors')
      .insert({
        full_name: cleanFullName,
        display_name: cleanFullName,
        phone: cleanPhone,
        email: cleanEmail,
        cpf: cleanCpf,
        parent_ambassador_id: sponsorAmb.id,
        status: 'ativo',
        cep: input.cep || null,
        address: input.address || null,
        number: input.number || null,
        neighborhood: input.neighborhood || null,
        city: input.city || null,
        state: input.state ? input.state.toUpperCase() : null,
        notes: `Cadastrado via link de convite do embaixador ${sponsorAmb.referral_code}`,
      })
      .select('id, username, referral_code')
      .single();

    if (createAmbError || !newAmbassador) {
      console.error('Erro ao criar registro de embaixador:', createAmbError);
      return { success: false, message: 'Falha ao registrar a conta de embaixador.' };
    }

    // Vincular cliente ao embaixador próprio (own_ambassador_id)
    if (customerId) {
      await adminClient
        .from('clientes')
        .update({ own_ambassador_id: newAmbassador.id })
        .eq('id', customerId);
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
      await adminClient.from('ambassadors').delete().eq('id', newAmbassador.id);
      return { success: false, message: 'Não foi possível provisionar o seu acesso inicial.' };
    }

    const authUserId = authData.user.id;

    // Vincular user_id no registro do embaixador
    await adminClient
      .from('ambassadors')
      .update({ user_id: authUserId })
      .eq('id', newAmbassador.id);

    // 6. Criar Perfil de Acesso em public.profiles
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: authUserId,
      nome: cleanFullName,
      email: syntheticEmail,
      telefone: cleanPhone,
      role: 'embaixador',
      username: newAmbassador.username,
      must_change_password: true,
      ativo: true,
    });

    if (profileError) {
      console.error('Erro ao criar profile do embaixador:', profileError);
    }

    // 7. Registrar Atribuição em customer_ambassador_assignments
    if (customerId) {
      try {
        await adminClient
          .schema('private')
          .from('customer_ambassador_assignments')
          .insert({
            customer_id: customerId,
            ambassador_id: sponsorAmb.id,
            source: 'smart_link',
            evidence_code: sponsorAmb.referral_code,
            status: 'active',
            is_validated: true,
            is_commissionable: true,
            assigned_by: sponsorAmb.id,
            reason: `Convite aceito via link /cadastro/${rawSponsorCode}`,
          })
          .select()
          .maybeSingle();
      } catch (assignErr) {
        console.error('Aviso ao registrar atribuição em private:', assignErr);
      }
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
