'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { Profile } from '@/models/types';

/**
 * Busca a lista de usuários com o cargo 'vendedor' que estejam ativos.
 * Isso servirá para alimentar o combobox de vendedores no cadastro de clientes.
 */
export const getVendedores = async (): Promise<Profile[]> => {
  const supabase = await createClient();
  
  // Como admin pode ver todos os profiles e vendedor também pode ver os ativos,
  // isso deve retornar de acordo com a RLS "Vendedor/Logistica podem ver perfis ativos"
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'vendedor')
    .eq('ativo', true)
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao buscar vendedores:', error);
    return [];
  }

  return data as Profile[];
};

/**
 * Retorna o profile do usuário atualmente logado.
 */
export const getCurrentProfile = async (): Promise<Profile | null> => {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return null;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) {
      console.error('Erro ao buscar perfil atual:', error);
      return null;
    }

    return data as Profile;
  } catch (err) {
    console.error('Erro em getCurrentProfile:', err);
    return null;
  }
};

