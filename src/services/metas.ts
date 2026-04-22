import { createClient } from '@/utils/supabase/server';
import { format, getDaysInMonth } from 'date-fns';

// Feriados nacionais fixos (MM-DD) + variáveis por ano
function getFeriadosNacionais(year: number): string[] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const pascoa = new Date(year, month - 1, day);
  const sextaSanta = new Date(pascoa); sextaSanta.setDate(pascoa.getDate() - 2);
  const carnaval = new Date(pascoa); carnaval.setDate(pascoa.getDate() - 47);
  const carnavalTerca = new Date(pascoa); carnavalTerca.setDate(pascoa.getDate() - 46);
  const corpusChristi = new Date(pascoa); corpusChristi.setDate(pascoa.getDate() + 60);

  const fmt = (d: Date) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  return [
    `${year}-01-01`,
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-12-25`,
    fmt(sextaSanta),
    fmt(carnaval),
    fmt(carnavalTerca),
    fmt(corpusChristi),
  ];
}

export function calcularDiasUteisRestantes(referenceDate: Date = new Date(), targetDate?: Date): {
  diasUteisTotal: number;
  diasUteisRestantes: number;
  diasUteisPassados: number;
} {
  // Se targetDate for fornecida, usamos ela para definir o mês/ano.
  // Caso contrário, usamos a referenceDate.
  const dateToUse = targetDate || referenceDate;
  const year = dateToUse.getFullYear();
  const month = dateToUse.getMonth();
  const totalDias = getDaysInMonth(dateToUse);
  const feriados = getFeriadosNacionais(year);

  // Determinamos o "dia atual" para comparação. 
  // Se referenceDate for de um mês anterior ao dateToUse, today é 0 (nada passado).
  // Se referenceDate for de um mês posterior ao dateToUse, today é totalDias + 1 (tudo passado).
  let todayPivot: number;
  
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  
  if (refYear < year || (refYear === year && refMonth < month)) {
    todayPivot = 0;
  } else if (refYear > year || (refYear === year && refMonth > month)) {
    todayPivot = totalDias + 1;
  } else {
    todayPivot = referenceDate.getDate();
  }

  let diasUteisTotal = 0;
  let diasUteisPassados = 0;

  for (let dia = 1; dia <= totalDias; dia++) {
    const data = new Date(year, month, dia);
    const dayOfWeek = data.getDay();
    const isSunday = dayOfWeek === 0;
    const dataStr = format(data, 'yyyy-MM-dd');
    const isFeriado = feriados.includes(dataStr);

    if (!isSunday && !isFeriado) {
      diasUteisTotal++;
      if (dia < todayPivot) diasUteisPassados++;
    }
  }

  const diasUteisRestantes = diasUteisTotal - diasUteisPassados;

  return { diasUteisTotal, diasUteisRestantes, diasUteisPassados };
}

export const MetasService = {
  async getMetaMensal(periodo?: string): Promise<number> {
    const supabase = await createClient();
    const p = periodo ?? format(new Date(), 'yyyy-MM');
    const { data, error } = await supabase
      .from('metas')
      .select('valor_meta')
      .eq('tipo_meta', 'faturamento')
      .eq('periodo', p)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar meta:', error.message);
      return 0;
    }

    return data?.valor_meta ?? 0;
  },

  async getMetasPeriodo(periodo?: string) {
    const supabase = await createClient();
    const p = periodo ?? format(new Date(), 'yyyy-MM');
    const { data } = await supabase
      .from('metas')
      .select('*')
      .eq('periodo', p);

    return data ?? [];
  },

  async salvarMeta(valor: number, periodo?: string): Promise<void> {
    const supabase = await createClient();
    const p = periodo ?? format(new Date(), 'yyyy-MM');
    const { error } = await supabase
      .from('metas')
      .upsert(
        { tipo_meta: 'faturamento', valor_meta: valor, periodo: p },
        { onConflict: 'tipo_meta,periodo' }
      );

    if (error) {
      console.error('Erro ao salvar meta:', error.message);
      throw new Error('Falha ao salvar meta: ' + error.message);
    }
  },
};
