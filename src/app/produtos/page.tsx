import { MainLayout } from '@/components/layout/MainLayout';
import { fetchProdutos } from './actions';
import ProdutoClientPage from './ProdutoClientPage';

export const metadata = {
  title: 'Produtos | Bryza Gestão',
  description: 'Gerenciamento de catálogo de produtos, matérias-primas e embalagens.',
};

export default async function ProdutosPage() {
  const produtos = await fetchProdutos();

  return (
    <MainLayout>
      <ProdutoClientPage initialProdutos={produtos} />
    </MainLayout>
  );
}
