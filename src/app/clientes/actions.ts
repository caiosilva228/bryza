'use server';

import { createCliente, updateCliente } from '@/services/clientes';
import { getCurrentProfile } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ClienteActionState {
  success: boolean;
  message: string;
}

export const initialClienteActionState: ClienteActionState = {
  success: false,
  message: '',
};

export async function salvarCliente(
  _prevState: ClienteActionState,
  formData: FormData
): Promise<ClienteActionState> {
  try {
    const profile = await getCurrentProfile();

    if (!profile) {
      return {
        success: false,
        message: 'Usuário não autenticado ou sem perfil mapeado.',
      };
    }

    let vendedorId = formData.get('vendedor_responsavel_id')?.toString();

    if (profile.role === 'vendedor') {
      vendedorId = profile.id;
    }

    const payload = {
      nome: formData.get('nome')?.toString() || '',
      telefone: formData.get('telefone')?.toString() || '',
      cep: formData.get('cep')?.toString() || '',
      endereco: formData.get('endereco')?.toString() || '',
      numero: formData.get('numero')?.toString() || '',
      bairro: formData.get('bairro')?.toString() || '',
      cidade: formData.get('cidade')?.toString() || '',
      estado: formData.get('estado')?.toString() || '',
      origem: formData.get('origem')?.toString() || 'indicação',
      status_cliente: 'lead' as any,
      vendedor_responsavel_id: vendedorId || profile.id,
    };

    const duplicate = await hasDuplicateCliente(payload.nome, payload.telefone);
    if (duplicate) {
      return {
        success: false,
        message: 'Já existe um cliente com esse nome e telefone. Verifique antes de salvar novamente.',
      };
    }

    const newClient = await createCliente(payload);

    if (!newClient) {
      return {
        success: false,
        message: 'Houve uma falha ao cadastrar o cliente na base de dados.',
      };
    }

    revalidatePath('/clientes');
    revalidatePath('/');

    return {
      success: true,
      message: 'Cliente cadastrado com sucesso.',
    };
  } catch (error) {
    console.error('Erro ao salvar cliente:', error);
    return {
      success: false,
      message: 'Erro inesperado ao cadastrar o cliente.',
    };
  }
}

export async function atualizarCliente(
  clienteId: string,
  _prevState: ClienteActionState,
  formData: FormData
): Promise<ClienteActionState> {
  try {
    const profile = await getCurrentProfile();

    if (!profile) {
      return {
        success: false,
        message: 'Usuário não autenticado ou sem perfil mapeado.',
      };
    }

    const payload = {
      nome: formData.get('nome')?.toString() || '',
      telefone: formData.get('telefone')?.toString() || '',
      cep: formData.get('cep')?.toString() || '',
      endereco: formData.get('endereco')?.toString() || '',
      numero: formData.get('numero')?.toString() || '',
      bairro: formData.get('bairro')?.toString() || '',
      cidade: formData.get('cidade')?.toString() || '',
      estado: formData.get('estado')?.toString() || '',
      origem: formData.get('origem')?.toString() || 'indicação',
      status_cliente: formData.get('status_cliente')?.toString() as any,
      vendedor_responsavel_id: formData.get('vendedor_responsavel_id')?.toString() || undefined,
    };

    const updated = await updateCliente(clienteId, payload);

    if (!updated) {
      return {
        success: false,
        message: 'Houve uma falha ao atualizar o cliente na base de dados.',
      };
    }

    revalidatePath('/clientes');
    revalidatePath('/');

    return {
      success: true,
      message: 'Cliente atualizado com sucesso.',
    };
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    return {
      success: false,
      message: 'Erro inesperado ao atualizar o cliente.',
    };
  }
}

export async function excluirClienteAction(clienteId: string): Promise<ClienteActionState> {
  try {
    const profile = await getCurrentProfile();

    if (!profile || profile.role !== 'admin') {
      return {
        success: false,
        message: 'Apenas administradores podem excluir clientes.',
      };
    }

    const supabase = await createClient();

    const { count: vendasCount, error: vendasError } = await supabase
      .from('vendas')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteId);

    if (vendasError) {
      console.error('Erro ao verificar vendas vinculadas ao cliente:', vendasError);
      return {
        success: false,
        message: 'Não foi possível verificar vínculos do cliente.',
      };
    }

    if ((vendasCount || 0) > 0) {
      return {
        success: false,
        message: 'Este cliente possui vendas vinculadas e não pode ser excluído.',
      };
    }

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', clienteId);

    if (error) {
      console.error('Erro ao excluir cliente:', error);
      return {
        success: false,
        message: 'Erro ao excluir o cliente.',
      };
    }

    revalidatePath('/clientes');
    revalidatePath('/');

    return {
      success: true,
      message: 'Cliente excluído com sucesso.',
    };
  } catch (error) {
    console.error('Erro inesperado ao excluir cliente:', error);
    return {
      success: false,
      message: 'Erro inesperado ao excluir o cliente.',
    };
  }
}

export async function getVendasPorClienteAction(clienteId: string) {
  const { getVendasByCliente } = await import('@/services/vendas');
  return await getVendasByCliente(clienteId);
}

async function hasDuplicateCliente(nome: string, telefone: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clientes')
    .select('id')
    .eq('nome', nome)
    .eq('telefone', telefone)
    .limit(1);

  if (error) {
    console.error('Erro ao verificar duplicidade do cliente:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}
