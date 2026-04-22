'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  
  const nome = formData.get('nome') as string;
  const telefone = formData.get('telefone') as string;

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      nome, 
      telefone,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (error) {
    console.error('Erro ao atualizar perfil:', error);
    return { success: false, error: 'Falha ao atualizar perfil' };
  }

  // Opcional: Atualizar metadados do auth também
  await supabase.auth.updateUser({
    data: { full_name: nome }
  });

  revalidatePath('/perfil');
  revalidatePath('/', 'layout'); // Para atualizar o sidebar em todas as páginas
  
  return { success: true };
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  
  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;

  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { success: false, error: 'Usuário não autenticado' };
  }

  // Primeiro verificamos a senha atual tentando logar
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return { success: false, error: 'Senha atual incorreta' };
  }

  // Se a senha atual está correta, procedemos com a atualização
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (updateError) {
    console.error('Erro ao atualizar senha:', updateError);
    return { success: false, error: 'Falha ao atualizar senha' };
  }

  return { success: true };
}
