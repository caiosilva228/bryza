export type AmbassadorCommissionMonth = {
  mes: string;
  vendas_qtd?: number | string;
  comissao_valor: number | string;
};

export function normalizeCommissionChart(
  months: AmbassadorCommissionMonth[] | null | undefined,
) {
  return (months || []).map((month) => ({
    mes: month.mes,
    vendas_qtd: Number(month.vendas_qtd || 0),
    comissao_valor: Number(month.comissao_valor || 0),
  }));
}

export function getCurrentCommission(
  months: AmbassadorCommissionMonth[] | null | undefined,
) {
  const chart = normalizeCommissionChart(months);
  return chart.at(-1)?.comissao_valor || 0;
}

export function getCommissionChartMaximum(
  months: AmbassadorCommissionMonth[] | null | undefined,
) {
  return Math.max(
    ...normalizeCommissionChart(months).map((month) => month.comissao_valor),
    1,
  );
}

export function removeGrossOrderValues<T extends Record<string, unknown>>(
  items: T[] | null | undefined,
) {
  return (items || []).map((item) => {
    const sanitized = { ...item };
    Reflect.deleteProperty(sanitized, 'valor_total');
    return sanitized;
  });
}
