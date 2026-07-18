import type { Metadata } from 'next';
import { EarningsCalculator } from '@/app/calculadora-de-ganhos/EarningsCalculator';
import { MainLayout } from '@/components/layout/MainLayout';
import { getCurrentCommissionPlan } from '@/lib/ambassadors/current-commission-plan';

export const metadata: Metadata = {
  title: 'Calculadora de ganhos | Painel do embaixador',
};

export const revalidate = 300;

export default async function AmbassadorEarningsCalculatorPage() {
  const plan = await getCurrentCommissionPlan();

  return (
    <MainLayout>
      <EarningsCalculator
        embedded
        planName={plan.name}
        levels={plan.levels}
      />
    </MainLayout>
  );
}
