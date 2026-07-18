'use server';

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { verifyAndParseReferralCookie, COOKIE_NAME } from '@/lib/referral/cookie';

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
  idempotency_key: string;
  itens: Array<{ produto_id: string; quantidade: number }>;
}

export interface PublicSchedulingResult {
  agendamento_id: string;
  numero_agendamento: string;
  data_agendamento: string;
  valor_total: number;
  novo_referral_code: string;
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

function normalizeRpcResult(value: unknown): PublicSchedulingResult | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;

  const data = row as Record<string, unknown>;
  const agendamentoId = String(data.agendamento_id ?? data.id ?? '');
  const numeroAgendamento = String(data.numero_agendamento ?? data.codigo_agendamento ?? '');
  const dataAgendamento = String(data.data_agendamento ?? '');
  const novoReferralCode = String(
    data.novo_referral_code ?? data.ambassador_code ?? data.referral_code ?? ''
  );
  const valorTotal = Number(data.valor_total ?? 0);

  if (!agendamentoId || !numeroAgendamento || !dataAgendamento || !novoReferralCode || !Number.isFinite(valorTotal)) {
    return null;
  }

  return {
    agendamento_id: agendamentoId,
    numero_agendamento: numeroAgendamento,
    data_agendamento: dataAgendamento,
    valor_total: valorTotal,
    novo_referral_code: novoReferralCode,
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
    const cpf = onlyDigits(input.cpf);
    const telefone = onlyDigits(input.telefone);
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
    if (!UUID_PATTERN.test(input.idempotency_key)) {
      return { success: false, error: 'Não foi possível validar esta tentativa. Reabra o formulário.' };
    }
    if (!Array.isArray(input.itens) || input.itens.length < 1 || input.itens.length > 20) {
      return { success: false, error: 'A oferta não possui itens válidos.' };
    }

    const itens = input.itens.map((item) => ({
      produto_id: typeof item?.produto_id === 'string' ? item.produto_id : '',
      quantidade: Number(item?.quantidade),
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

    const { data: rpcData, error } = await supabaseAdmin.rpc('fn_criar_agendamento_publico', {
      p_cliente_data: {
        nome,
        cpf,
        telefone,
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
      console.error('Erro na RPC fn_criar_agendamento_publico:', {
        code: error.code,
        message: error.message,
      });
      return { success: false, error: 'Não foi possível agendar agora. Revise os dados e tente novamente.' };
    }

    const normalizedResult = normalizeRpcResult(rpcData);
    if (!normalizedResult) {
      console.error('Resposta inválida da RPC fn_criar_agendamento_publico.');
      return { success: false, error: 'O agendamento foi processado, mas a confirmação não pôde ser exibida. Entre em contato com a Bryza.' };
    }

    return { success: true, data: normalizedResult };
  } catch (error) {
    console.error('Erro ao criar agendamento público:', error instanceof Error ? error.message : 'erro desconhecido');
    return { success: false, error: 'Não foi possível processar o agendamento. Tente novamente.' };
  }
}

// Compatibilidade temporária com chamadas anteriores durante a evolução do fluxo público.
export const createPublicOrderAction = createPublicSchedulingAction;
