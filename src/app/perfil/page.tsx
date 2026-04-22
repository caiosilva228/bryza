import { createClient } from '@/utils/supabase/server';
import { PerfilClient } from './PerfilClient';
import { redirect } from 'next/navigation';

export default async function PerfilPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return <div>Perfil não encontrado.</div>;
  }

  return <PerfilClient profile={profile} />;
}
