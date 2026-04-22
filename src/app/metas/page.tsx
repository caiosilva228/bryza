import { MainLayout } from '@/components/layout/MainLayout';
import { MetasService, calcularDiasUteisRestantes } from '@/services/metas';
import { MetasClientPage } from './MetasClientPage';
import { format, parseISO } from 'date-fns';

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ periodo?: string }>;
}

export default async function MetasPage({ searchParams }: PageProps) {
  const { periodo: paramPeriodo } = await searchParams;
  const periodoAtual = paramPeriodo ?? format(new Date(), 'yyyy-MM');

  const [metaAtual, metas] = await Promise.all([
    MetasService.getMetaMensal(periodoAtual),
    MetasService.getMetasPeriodo(periodoAtual),
  ]);

  const diasInfo = calcularDiasUteisRestantes(new Date(), new Date(`${periodoAtual}-15`));

  return (
    <MainLayout>
      <MetasClientPage
        periodoAtual={periodoAtual}
        metaAtual={metaAtual}
        diasUteisTotal={diasInfo.diasUteisTotal}
        diasUteisRestantes={diasInfo.diasUteisRestantes}
      />
    </MainLayout>
  );
}
