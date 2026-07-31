import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { createClient } from '@/utils/supabase/server';
import { NotificationCenter } from './NotificationCenter';

export const metadata: Metadata = {
  title: 'Central de notificações | Bryza',
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.ativo || profile.role !== 'admin') redirect('/');

  return (
    <MainLayout>
      <NotificationCenter />
    </MainLayout>
  );
}
