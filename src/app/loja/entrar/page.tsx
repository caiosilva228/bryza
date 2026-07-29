import { redirect } from 'next/navigation';
import CustomerAccessForm from './CustomerAccessForm';

type AccessPageProps = {
  searchParams: Promise<{
    modo?: string | string[];
    retorno?: string | string[];
    erro?: string | string[];
  }>;
};

function safePath(value: string | string[] | undefined): string {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return '/loja/minha-conta';
  }
  return path;
}

export default async function CustomerAccessPage({ searchParams }: AccessPageProps) {
  const query = await searchParams;
  const mode = query.modo === 'cadastro' ? 'cadastro' : 'entrar';
  const returnPath = safePath(query.retorno);

  if (mode === 'entrar') {
    redirect(
      `/loja?login=required&retorno=${encodeURIComponent(returnPath)}`,
    );
  }

  return (
    <CustomerAccessForm
      mode={mode}
      returnPath={returnPath}
      invalidLink={query.erro === 'link_invalido'}
    />
  );
}
