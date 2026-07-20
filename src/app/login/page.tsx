import styles from './login.module.css';
import { login } from './actions';
import { headers } from 'next/headers';
import { getSubdomainType } from '@/utils/subdomain';
import { EmbaixadorGlassLogin } from '@/components/auth/EmbaixadorGlassLogin';
import { AdminGlassLogin } from '@/components/auth/AdminGlassLogin';

interface PageProps {
  searchParams: Promise<{ error?: string; type?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = params.error;
  const typeParam = params.type;

  const reqHeaders = await headers();
  const host = reqHeaders.get('host');
  const subdomain = getSubdomainType(host);

  let errorMessage = '';
  if (error === 'InvalidCredentials') {
    errorMessage = 'Usuário ou senha inválidos.';
  } else if (error === 'BlockedUser') {
    errorMessage = 'Sua conta está inativa ou bloqueada. Entre em contato com o suporte.';
  } else if (error === 'RateLimit') {
    errorMessage = 'Muitas tentativas de login. Tente novamente mais tarde.';
  }

  // Renderiza EV Embaixadores
  if (subdomain === 'ev' || typeParam === 'ev') {
    return <EmbaixadorGlassLogin errorMessage={errorMessage} />;
  }

  // Default: Central Administrativa
  return <AdminGlassLogin errorMessage={errorMessage} />;
}
