import type { Metadata } from 'next';
import { getCurrentCommissionPlan } from '@/lib/ambassadors/current-commission-plan';
import { EarningsCalculator } from './EarningsCalculator';

export const metadata: Metadata = {
  title: 'Calculadora de ganhos | Bryza',
  description: 'Simule sua meta de ganhos e veja quantas pessoas sua rede precisa ter em cada nível.',
};

// Mantém os percentuais alinhados ao plano padrão sem consultar o banco a cada acesso.
export const revalidate = 300;

export default async function EarningsCalculatorPage() {
  const plan = await getCurrentCommissionPlan();

  return (
    <EarningsCalculator
      planName={plan.name}
      levels={plan.levels}
    />
  );
}
