export interface KitStockComponent {
  quantidade: number;
  estoqueDisponivel: number;
}
export interface KitPriceAllocationLine {
  valorBruto: number;
  valorLiquido: number;
  desconto: number;
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Quantos kits completos podem ser montados a partir do estoque atual. */
export function calculateKitAvailability(components: KitStockComponent[]): number {
  if (components.length === 0) return 0;

  return Math.max(
    0,
    Math.floor(
      Math.min(...components.map(component => {
        if (component.quantidade <= 0 || component.estoqueDisponivel <= 0) return 0;
        return component.estoqueDisponivel / component.quantidade;
      })),
    ),
  );
}

/** Distribui o preco fechado por valor bruto e fecha o residuo no ultimo item. */
export function allocateKitPrice(
  componentGrossValues: number[],
  kitTotal: number,
): KitPriceAllocationLine[] {
  if (componentGrossValues.length === 0) return [];

  const totalGross = roundMoney(componentGrossValues.reduce((sum, value) => sum + value, 0));
  const result: KitPriceAllocationLine[] = [];
  let allocatedNet = 0;

  componentGrossValues.forEach((grossValue, index) => {
    const bruto = roundMoney(grossValue);
    const isLast = index === componentGrossValues.length - 1;
    const liquido = isLast
      ? roundMoney(kitTotal - allocatedNet)
      : totalGross === 0
        ? 0
        : roundMoney(bruto * kitTotal / totalGross);
    const desconto = roundMoney(bruto - liquido);
    result.push({ valorBruto: bruto, valorLiquido: liquido, desconto });
    allocatedNet = roundMoney(allocatedNet + liquido);
  });

  return result;
}
