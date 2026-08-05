'use server';

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { verifyAndParseReferralCookie, COOKIE_NAME } from '@/lib/referral/cookie';
import { getSyntheticEmail } from '@/utils/env';
import {
  findAmbassadorByCanonicalIdentity,
  normalizeCustomerIdentity,
  normalizeValidCustomerEmail,
} from '@/lib/customers/canonical-identity';
import {
  configureSchedulingPayment,
  type PaymentStatus,
  type PaymentTiming,
} from '@/lib/payments/payment-intents';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BRAZILIAN_STATES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface PublicSchedulingInput {
  nome: string;
  cpf: string;
  telefone: string;
  email?: string;
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  data: string;
  hora: string;
  forma_pagamento: 'dinheiro' | 'pix' | 'cartao';
  payment_timing: PaymentTiming;
  idempotency_key: string;
  itens: Array<{ produto_id: string; quantidade: number }>;
}

export interface PublicSchedulingResult {
  agendamento_id: string;
  numero_agendamento: string;
  data_agendamento: string;
  valor_total: number;
  program_invitation_available: boolean;
  ambassador_access: {
    available: boolean;
    login: string | null;
    temporary_password_is_phone: boolean;
  };
  payment_timing: PaymentTiming;
  payment_status: PaymentStatus;
  checkout_token: string | null;
}

export type PublicSchedulingActionResult =
  | { success: true; data: PublicSchedulingResult }
  | { success: false; error: string };

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function onlyDigits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number) => {
    let total = 0;
    for (let index = 0; index < length; index += 1) {
      total += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
}

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

type BaseSchedulingResult = Omit<
  PublicSchedulingResult,
  'ambassador_access' | 'payment_timing' | 'payment_status' | 'checkout_token'
>;

function normalizeRpcResult(value: unknown): BaseSchedulingResult | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;

  const data = row as Record<string, unknown>;
  const agendamentoId = String(data.agendamento_id ?? data.id ?? '');
  const numeroAgendamento = String(data.numero_agendamento ?? data.codigo_agendamento ?? '');
  const dataAgendamento = String(data.data_agendamento ?? '');
  const valorTotal = Number(data.valor_total ?? 0);
  const status = String(data.status ?? '');

  if (status === 'manual_review_required' || status === 'idempotency_conflict') {
    return null;
  }
  if (!agendamentoId || !numeroAgendamento || !dataAgendamento || !Number.isFinite(valorTotal)) {
    return null;
  }

  return {
    agendamento_id: agendamentoId,
    numero_agendamento: numeroAgendamento,
    data_agendamento: dataAgendamento,
    valor_total: valorTotal,
    program_invitation_available: data.program_invitation_available === true,
  };
}

export async function createPublicSchedulingAction(
  input: PublicSchedulingInput
): Promise<PublicSchedulingActionResult> {
  try {
    if (!input || typeof input !== 'object') {
      return { success: false, error: 'Dados do agendamento inválidos.' };
    }

    const nome = cleanText(input.nome, 160);
    const identity = normalizeCustomerIdentity({
      cpf: input.cpf,
      phone: input.telefone,
      email: input.email,
    });
    const cpf = identity.cpf || '';
    const telefone = identity.phone;
    const email = identity.email;
    const validEmail = normalizeValidCustomerEmail(email);
    const endereco = cleanText(input.endereco, 200);
    const numero = cleanText(input.numero, 20);
    const complemento = cleanText(input.complemento, 100);
    const bairro = cleanText(input.bairro, 100);
    const cidade = cleanText(input.cidade, 100);
    const estado = cleanText(input.estado, 2).toUpperCase();
    const cep = onlyDigits(input.cep);
    const data = cleanText(input.data, 10);
    const hora = cleanText(input.hora, 5);

    if (nome.length < 3 || !nome.includes(' ')) {
      return { success: false, error: 'Informe seu nome completo.' };
    }
    if (!isValidCpf(cpf)) {
      return { success: false, error: 'Informe um CPF válido.' };
    }
    if (!/^\d{10,11}$/.test(telefone)) {
      return { success: false, error: 'Informe um telefone válido com DDD.' };
    }
    if (input.email && (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
      return { success: false, error: 'Informe um e-mail válido.' };
    }
    if (input.payment_timing === 'agora' && !validEmail) {
      return { success: false, error: 'Informe um e-mail válido para concluir o pagamento online.' };
    }
    if (endereco.length < 3 || !numero || bairro.length < 2 || cidade.length < 2) {
      return { success: false, error: 'Preencha o endereço completo para entrega.' };
    }
    if (!BRAZILIAN_STATES.has(estado)) {
      return { success: false, error: 'Informe uma UF válida.' };
    }
    if (!/^\d{8}$/.test(cep)) {
      return { success: false, error: 'Informe um CEP válido.' };
    }
    if (!isRealDate(data) || !TIME_PATTERN.test(hora)) {
      return { success: false, error: 'Informe uma data e um horário válidos.' };
    }

    const scheduledAt = new Date(`${data}T${hora}:00-03:00`);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 30 * 60 * 1000) {
      return { success: false, error: 'Escolha um horário com pelo menos 30 minutos de antecedência.' };
    }

    if (!['dinheiro', 'pix', 'cartao'].includes(input.forma_pagamento)) {
      return { success: false, error: 'Selecione uma forma de pagamento válida.' };
    }
    if (!['agora', 'na_entrega'].includes(input.payment_timing)) {
      return { success: false, error: 'Selecione quando deseja realizar o pagamento.' };
    }
    if (!UUID_PATTERN.test(input.idempotency_key)) {
      return { success: false, error: 'Não foi possível validar esta tentativa. Reabra o formulário.' };
    }
    if (!Array.isArray(input.itens) || input.itens.length < 1 || input.itens.length > 20) {
      return { success: false, error: 'A oferta não possui itens válidos.' };
    }

    const itens = input.itens.map((item) => ({
      produto_id: typeof item?.produto_id === 'string' ? item.produto_id : '',
      quantidade: Number(item?.quantidade),
      // Descontos da oferta são definidos no banco. Nunca confie em valores
      // enviados pelo navegador para calcular o total do checkout público.
      desconto_aplicado: 0,
    }));
    if (itens.some((item) => !UUID_PATTERN.test(item.produto_id)
      || !Number.isInteger(item.quantidade)
      || item.quantidade < 1
      || item.quantidade > 100)) {
      return { success: false, error: 'A oferta contém um item inválido.' };
    }

    const { data: programSettings, error: programSettingsError } = await supabaseAdmin
      .from('ambassador_program_settings')
      .select('program_status')
      .eq('singleton', true)
      .single();
    if (programSettingsError || !programSettings) {
      return { success: false, error: 'O programa de embaixadores está temporariamente indisponível.' };
    }
    if (programSettings.program_status !== 'ativo') {
      return { success: false, error: 'O programa de embaixadores está pausado para novas operações.' };
    }

    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(COOKIE_NAME)?.value;
    const verifiedReferral = verifyAndParseReferralCookie(rawCookie);
    if (!verifiedReferral) {
      return { success: false, error: 'Sua indicação expirou. Recarregue a página e tente novamente.' };
    }

    const { data: rpcData, error } = await supabaseAdmin.rpc('fn_criar_agendamento_publico_kit', {
      p_cliente_data: {
        nome,
        cpf,
        telefone,
        email: validEmail,
        endereco,
        numero,
        complemento: complemento || null,
        bairro,
        cidade,
        estado,
        cep,
        data_agendamento: scheduledAt.toISOString(),
        forma_pagamento: input.forma_pagamento,
      },
      p_itens_data: itens,
      p_atribuicao: {
        referral_code: verifiedReferral.referral_code,
        visit_id: verifiedReferral.visit_id ?? null,
        source: verifiedReferral.source ?? 'smart_link',
      },
      p_idempotency_key: input.idempotency_key,
    });

    if (error) {
      console.error('Erro na RPC fn_criar_agendamento_publico_kit:', {
        code: error.code,
        message: error.message,
      });
      return { success: false, error: 'Não foi possível agendar agora. Revise os dados e tente novamente.' };
    }

    const rawResult = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as Record<string, unknown> | null;
    if (rawResult?.status === 'manual_review_required') {
      return {
        success: false,
        error: 'Seus dados precisam de uma revisão administrativa antes do agendamento. A equipe Bryza dará continuidade ao atendimento.',
      };
    }
    if (rawResult?.status === 'idempotency_conflict') {
      return {
        success: false,
        error: 'Esta tentativa já foi utilizada com dados diferentes. Feche o formulário e tente novamente.',
      };
    }

    const normalizedResult = normalizeRpcResult(rpcData);
    if (!normalizedResult) {
      console.error('Resposta inválida da RPC fn_criar_agendamento_publico_kit.');
      return { success: false, error: 'O agendamento foi processado, mas a confirmação não pôde ser exibida. Entre em contato com a Bryza.' };
    }

    const payment = await configureSchedulingPayment(
      supabaseAdmin,
      normalizedResult.agendamento_id,
      normalizedResult.valor_total,
      input.payment_timing,
    );
    let ambassadorAccess: PublicSchedulingResult['ambassador_access'] = {
      available: false,
      login: null,
      temporary_password_is_phone: false,
    };

    // O front-end só recebe o acesso depois que Auth, perfil e permissão de
    // embaixador foram confirmados. O pedido continua válido se essa etapa
    // acessória precisar de revisão operacional.
    try {
      const { data: schedulingLink, error: schedulingLinkError } = await supabaseAdmin
        .from('agendamentos')
        .select('cliente_id')
        .eq('id', normalizedResult.agendamento_id)
        .single();
      if (schedulingLinkError || !schedulingLink?.cliente_id) {
        throw new Error('scheduling_customer_missing');
      }

      const { data: customer, error: customerError } = await supabaseAdmin
        .from('clientes')
        .select('id, person_id, own_ambassador_id')
        .eq('id', schedulingLink.cliente_id)
        .single();
      if (customerError || !customer?.person_id) {
        throw new Error('canonical_customer_missing');
      }

      type AccessAmbassador = {
        id: string;
        username: string;
        referral_code: string | null;
        user_id: string | null;
        person_id: string | null;
      };

      let ambassador: AccessAmbassador | null = null;
      let createdAmbassador = false;

      if (customer.own_ambassador_id) {
        const { data } = await supabaseAdmin
          .from('ambassadors')
          .select('id, username, referral_code, user_id, person_id')
          .eq('id', customer.own_ambassador_id)
          .eq('status', 'ativo')
          .maybeSingle();
        ambassador = data as AccessAmbassador | null;
      }

      if (!ambassador) {
        const { data } = await supabaseAdmin
          .from('ambassadors')
          .select('id, username, referral_code, user_id, person_id')
          .eq('person_id', customer.person_id)
          .eq('status', 'ativo')
          .limit(1)
          .maybeSingle();
        ambassador = data as AccessAmbassador | null;
      }

      if (!ambassador) {
        const legacyAmbassador = await findAmbassadorByCanonicalIdentity(supabaseAdmin, {
          cpf,
          phone: telefone,
        });
        if (legacyAmbassador) {
          ambassador = {
            id: legacyAmbassador.id,
            username: legacyAmbassador.username,
            referral_code: legacyAmbassador.referral_code,
            user_id: legacyAmbassador.user_id,
            person_id: legacyAmbassador.person_id,
          };
        }
      }

      if (!ambassador) {
        const [{ data: sponsorAmb }, { data: progSettings }] = await Promise.all([
          supabaseAdmin
            .from('ambassadors')
            .select('id')
            .ilike('referral_code', verifiedReferral.referral_code)
            .maybeSingle(),
          supabaseAdmin
            .from('ambassador_program_settings')
            .select('default_commission_plan_id')
            .eq('singleton', true)
            .maybeSingle(),
        ]);

        const { data: newAmbassador, error: newAmbassadorError } = await supabaseAdmin
          .from('ambassadors')
          .insert({
            person_id: customer.person_id,
            full_name: nome,
            display_name: nome,
            phone: telefone,
            email: `${cpf}@cliente.bryza`,
            cpf,
            parent_ambassador_id: sponsorAmb?.id || null,
            commission_plan_id: progSettings?.default_commission_plan_id || null,
            status: 'ativo',
            cep: cep || null,
            address: endereco || null,
            number: numero || null,
            neighborhood: bairro || null,
            city: cidade || null,
            state: estado || null,
            notes: 'Cadastrado automaticamente como embaixador ativo via agendamento Kit Bryza.',
          })
          .select('id, username, referral_code, user_id, person_id')
          .single();
        if (newAmbassadorError || !newAmbassador) {
          throw new Error(`ambassador_create_failed:${newAmbassadorError?.code || 'unknown'}`);
        }
        ambassador = newAmbassador as AccessAmbassador;
        createdAmbassador = true;
      }

      const { error: customerLinkError } = await supabaseAdmin
        .from('clientes')
        .update({ own_ambassador_id: ambassador.id })
        .eq('id', customer.id);
      if (customerLinkError) throw new Error(`customer_link_failed:${customerLinkError.code}`);

      if (ambassador.user_id) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role, ativo, must_change_password')
          .eq('id', ambassador.user_id)
          .maybeSingle();
        if (profile?.role === 'embaixador' && profile.ativo) {
          ambassadorAccess = {
            available: true,
            login: telefone,
            temporary_password_is_phone: profile.must_change_password === true,
          };
        }
      } else {
        const syntheticEmail = getSyntheticEmail(ambassador.username);
        const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
          email: syntheticEmail,
          password: telefone,
          email_confirm: true,
          user_metadata: { nome },
        });
        if (createAuthError || !authData.user) {
          throw new Error(`auth_create_failed:${createAuthError?.code || 'unknown'}`);
        }

        const { data: provisionData, error: provisionError } = await supabaseAdmin.rpc(
          'fn_service_provision_store_ambassador',
          {
            p_ambassador_id: ambassador.id,
            p_auth_user_id: authData.user.id,
            p_person_id: customer.person_id,
          },
        );
        const provision = provisionData as { status?: string } | null;
        if (provisionError || provision?.status !== 'linked') {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          if (createdAmbassador) {
            await supabaseAdmin
              .from('ambassadors')
              .update({ status: 'inativo' })
              .eq('id', ambassador.id)
              .is('user_id', null);
          }
          throw new Error(`access_provision_failed:${provisionError?.code || provision?.status || 'unknown'}`);
        }

        const { error: firstAccessError } = await supabaseAdmin
          .from('profiles')
          .update({ must_change_password: true })
          .eq('id', authData.user.id);
        if (firstAccessError) {
          throw new Error(`first_access_flag_failed:${firstAccessError.code}`);
        }

        ambassadorAccess = {
          available: true,
          login: telefone,
          temporary_password_is_phone: true,
        };
      }
    } catch (ambErr) {
      console.error('Aviso ao provisionar embaixador ativo no agendamento público:', ambErr);
    }

    const resultWithPayment: PublicSchedulingResult = {
      ...normalizedResult,
      ambassador_access: ambassadorAccess,
      payment_timing: input.payment_timing,
      payment_status: payment.paymentStatus,
      checkout_token: payment.checkoutToken,
    };

    return { success: true, data: resultWithPayment };
  } catch (error) {
    console.error('Erro ao criar agendamento público:', error instanceof Error ? error.message : 'erro desconhecido');
    return { success: false, error: 'Não foi possível processar o agendamento. Tente novamente.' };
  }
}

// Compatibilidade temporária com chamadas anteriores durante a evolução do fluxo público.
export const createPublicOrderAction = createPublicSchedulingAction;
