'use server';

import { createCliente, updateCliente } from '@/services/clientes';
import { getCurrentProfile } from '@/services/profiles';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function salvarCliente(formData: FormData) {
  const profile = await getCurrentProfile();
  
  if (!profile) {
    throw new Error('Usuário não autenticado ou sem perfil mapeado.');
  }

  // Se o perfil logado for um vendedor, obrigatoriamente ele será o vendedor atrelado (mesmo se tentar burlar client-side).
  // Se for admin, pega o que vier do form
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
    status_cliente: 'lead' as any, // definindo o status inicial default
    vendedor_responsavel_id: vendedorId || profile.id, // Fallback p/ quem está criando, caso falhe.
  };

  const newClient = await createCliente(payload);

  if (!newClient) {
    throw new Error('Houve uma falha ao cadastrar o cliente na base de dados.');
  }

  // Reflete a atualização visual no Dashboard
  revalidatePath('/clientes');
  // Envia usuário para listagem
  redirect('/clientes');
}

export async function atualizarCliente(clienteId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  
  if (!profile) {
    throw new Error('Usuário não autenticado ou sem perfil mapeado.');
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
    throw new Error('Houve uma falha ao atualizar o cliente na base de dados.');
  }

  revalidatePath('/clientes');
  redirect('/clientes');
}

export async function getVendasPorClienteAction(clienteId: string) {
  const { getVendasByCliente } = await import('@/services/vendas');
  return await getVendasByCliente(clienteId);
}
