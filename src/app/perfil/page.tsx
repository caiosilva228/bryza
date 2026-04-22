import { MainLayout } from '@/components/layout/MainLayout';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { PerfilClient } from './PerfilClient';
import { Profile } from '@/models/types';

export const metadata = {
  title: 'Meu Perfil | BRYZA',
};

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profileData) {
    redirect('/login');
  }

  const profile = profileData as Profile;

  return (
    <MainLayout>
      <PerfilClient profile={profile} />
    </MainLayout>
  );
}
