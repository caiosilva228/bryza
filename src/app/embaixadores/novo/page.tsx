import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';
import { getNovoEmbaixadorOptions } from '../actions';
import { NovoEmbaixadorForm } from './NovoEmbaixadorForm';

export default async function NewAmbassadorPage() {
  const options = await getNovoEmbaixadorOptions();

  return (
    <MainLayout>
      <div className="page-wrapper">
        <div className="page-header">
          <div className="page-header-text">
            <h1>Novo Embaixador</h1>
            <p>O sistema reutiliza um cliente existente ou cria o perfil de cliente automaticamente.</p>
          </div>
          <div className="page-header-actions">
            <Link href="/embaixadores" className="btn-secondary">Voltar</Link>
          </div>
        </div>
        <NovoEmbaixadorForm options={options} />
      </div>
    </MainLayout>
  );
}
