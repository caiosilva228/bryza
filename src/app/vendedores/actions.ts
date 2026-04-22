'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NivelComissao } from '@/models/types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function salvarVendedor(formData: FormData) {
  const id = formData.get('id') as string;
  const isEditing = !!id;

  const nome = formData.get('nome') as string;
  const email = formData.get('email') as string;
  const telefone = formData.get('telefone') as string;
  const cpf = formData.get('cpf') as string;
  const data_nascimento = formData.get('data_nascimento') as string;
  const endereco = formData.get('endereco') as string;
  const bairro = formData.get('bairro') as string;
  const cidade = formData.get('cidade') as string;
  const estado = formData.get('estado') as string;
  
  const regiao_atuacao = formData.get('regiao_atuacao') as string;
  const ativo = formData.get('ativo') === 'true';
  const data_entrada = formData.get('data_entrada') as string;
  const observacoes = formData.get('observacoes') as string;

  const nivel_comissao = formData.get('nivel_comissao') as NivelComissao;
  const percentual_comissao = parseFloat(formData.get('percentual_comissao') as string) || 8.00;
  const meta_diaria = parseInt(formData.get('meta_diaria') as string, 10) || 0;
  const meta_semanal = parseInt(formData.get('meta_semanal') as string, 10) || 0;
  const meta_mensal = parseInt(formData.get('meta_mensal') as string, 10) || 0;

  const supabase = await createClient();

  // Dados do Profile
  const profileData = {
    nome,
    email,
    telefone,
    cpf: cpf || null,
    data_nascimento: data_nascimento || null,
    endereco: endereco || null,
    bairro: bairro || null,
    cidade: cidade || null,
    estado: estado || null,
    regiao_atuacao: regiao_atuacao || null,
    ativo,
    data_entrada: data_entrada || null,
    observacoes: observacoes || null,
    nivel_comissao: nivel_comissao || 'Bronze',
    percentual_comissao,
    meta_diaria,
    meta_semanal,
    meta_mensal,
    role: 'vendedor',
  };

  if (isEditing) {
    const { error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar vendedor:', error);
      return { success: false, error: error.message };
    }
  } else {
    // Modo Inserção (Cria Auth + Profile)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { success: false, error: 'A Chave Service Role do Supabase (SUPABASE_SERVICE_ROLE_KEY) não está configurada no .env.local para criar usuários.' };
    }

    const adminAuthClient = createAdminClient();
    
    // Senha padrão temporária (ex: 123456)
    const temporaria = CypressOrTestFallback(cpf); // Apenas um fallback. Usaremos 'mudar123'
    const senhaInicial = 'mudar123'; 

    const { data: authData, error: authError } = await adminAuthClient.auth.admin.createUser({
      email,
      password: senhaInicial,
      email_confirm: true,
      user_metadata: {
        nome,
        role: 'vendedor'
      }
    });

    if (authError || !authData.user) {
      console.error('Erro ao criar usuário auth:', authError);
      return { success: false, error: authError?.message || 'Erro ao criar conta no Supabase Auth' };
    }

    // Com usuário inserido, a tabela profiles já recebe um gatilho de criação vazio lá no Supabase (se houver handle_new_user), 
    // portanto faremos um UPDATE ou upsert para preencher os dados de vendedor
    const { error: profileError } = await adminAuthClient
      .from('profiles')
      .upsert({ ...profileData, id: authData.user.id });

    if (profileError) {
      console.error('Erro ao salvar profile do vendedor:', profileError);
      return { success: false, error: profileError.message };
    }
  }

  revalidatePath('/vendedores');
  redirect('/vendedores');
}

function CypressOrTestFallback(cpf: string) {
  // Ignorar no escopo real
  return cpf ? cpf.replace(/\D/g, '').substring(0, 6) : 'mudar123';
}
