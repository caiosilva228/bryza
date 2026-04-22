'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return { success: false, error: 'Usuário não autenticado.' }
  }

  const nome = formData.get('nome') as string
  const telefone = formData.get('telefone') as string

  if (!nome || nome.trim() === '') {
    return { success: false, error: 'O nome é obrigatório.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      nome: nome.trim(), 
      telefone: telefone.trim() || null
    })
    .eq('id', user.id)

  if (error) {
    console.error('Erro ao atualizar perfil:', error)
    return { success: false, error: 'Falha ao atualizar perfil no banco de dados.' }
  }

  revalidatePath('/perfil')
  revalidatePath('/', 'layout') // Atualiza a sidebar se necessário
  
  return { success: true }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  
  const currentPassword = formData.get('currentPassword') as string
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' }
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: 'As senhas não coincidem.' }
  }

  // Primeiro reautenticamos o usuário com a senha atual para garantir que ele sabe a senha atual
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  
  if (!currentUser?.email) {
    return { success: false, error: 'Usuário não autenticado.' }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: currentUser.email,
    password: currentPassword,
  })

  if (signInError) {
    return { success: false, error: 'A senha atual está incorreta.' }
  }

  // Atualizar a senha
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword
  })

  if (updateError) {
    return { success: false, error: 'Erro ao atualizar a senha.' }
  }

  return { success: true }
}
