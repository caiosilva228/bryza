import { MainLayout } from '@/components/layout/MainLayout';
import { getItensEstoque, getEstoqueStats } from '@/services/estoque';
import { EstoqueClientPage } from './EstoqueClientPage';

export const revalidate = 0;

export default async function EstoquePage() {
  const [produtos, stats] = await Promise.all([
    getItensEstoque(),
    getEstoqueStats()
  ]);

  return (
    <MainLayout>
      <EstoqueClientPage produtos={produtos} stats={stats} />
    </MainLayout>
  );
}
