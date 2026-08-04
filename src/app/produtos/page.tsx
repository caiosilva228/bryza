import { MainLayout } from '@/components/layout/MainLayout';
import { fetchKitsAction, fetchProdutos } from './actions';
import ProdutoClientPage from './ProdutoClientPage';

export const metadata = {
  title: 'Produtos | Bryza Gestão',
  description: 'Gerenciamento de catálogo de produtos, matérias-primas e embalagens.',
};

export const dynamic = 'force-dynamic';

export default async function ProdutosPage() {
  const [produtos, kitsResult] = await Promise.all([fetchProdutos(), fetchKitsAction()]);

  return (
    <MainLayout>
      <ProdutoClientPage initialProdutos={produtos} initialKits={kitsResult.data || []} />
    </MainLayout>
  );
}
