import { EmbaixadorGlassLogin } from '@/components/auth/EmbaixadorGlassLogin';

interface PageProps {
  searchParams: Promise<{ error?: string; identifier?: string }>;
}

export default async function EmbaixadorLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = params.error;
  const initialIdentifier = /^\d{10,11}$/.test(params.identifier || '')
    ? params.identifier
    : '';

  let errorMessage = '';
  if (error === 'InvalidCredentials') {
    errorMessage = 'Usuário ou senha inválidos.';
  } else if (error === 'BlockedUser') {
    errorMessage = 'Sua conta está inativa ou bloqueada. Entre em contato com o suporte.';
  } else if (error === 'RateLimit') {
    errorMessage = 'Muitas tentativas de login. Tente novamente mais tarde.';
  }

  return <EmbaixadorGlassLogin errorMessage={errorMessage} initialIdentifier={initialIdentifier} />;
}
