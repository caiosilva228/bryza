import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient as createAuthClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase service role key não configurada.');
  }

  return createSupabaseClient(url, serviceKey);
}

async function getCurrentUserId() {
  const authClient = await createAuthClient();
  const { data, error } = await authClient.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

async function getProfileByUserId(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as { id: string; role: 'admin' | 'vendedor' | 'logistica' };
}

async function hasDuplicateClient(nome: string, telefone: string, ignoreId?: string) {
  const supabase = createServiceClient();
  let query = supabase
    .from('clientes')
    .select('id')
    .eq('nome', nome)
    .eq('telefone', telefone);

  if (ignoreId) {
    query = query.neq('id', ignoreId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw error;
  }

  return (data?.length || 0) > 0;
}

function buildPayload(formData: FormData, profileRole: 'admin' | 'vendedor' | 'logistica', userId: string) {
  const vendedorResponsavelId = profileRole === 'vendedor'
    ? userId
    : formData.get('vendedor_responsavel_id')?.toString() || userId;

  return {
    nome: formData.get('nome')?.toString() || '',
    telefone: formData.get('telefone')?.toString() || '',
    cep: formData.get('cep')?.toString() || '',
    endereco: formData.get('endereco')?.toString() || '',
    numero: formData.get('numero')?.toString() || '',
    bairro: formData.get('bairro')?.toString() || '',
    cidade: formData.get('cidade')?.toString() || '',
    estado: formData.get('estado')?.toString() || '',
    origem: formData.get('origem')?.toString() || 'indicação',
    status_cliente: formData.get('status_cliente')?.toString() || 'lead',
    vendedor_responsavel_id: vendedorResponsavelId,
    latitude: formData.get('latitude') ? Number(formData.get('latitude')) : null,
    longitude: formData.get('longitude') ? Number(formData.get('longitude')) : null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Usuário não autenticado.' }, { status: 401 });
    }

    const profile = await getProfileByUserId(userId);
    if (!profile) {
      return NextResponse.json({ success: false, message: 'Perfil do usuário não encontrado.' }, { status: 403 });
    }

    const formData = await request.formData();
    const clienteId = formData.get('cliente_id')?.toString() || '';
    const payload = buildPayload(formData, profile.role, userId);

    const duplicate = await hasDuplicateClient(payload.nome, payload.telefone, clienteId || undefined);
    if (duplicate) {
      return NextResponse.json(
        { success: false, message: 'Já existe um cliente com esse nome e telefone.' },
        { status: 409 }
      );
    }

    const supabase = createServiceClient();

    if (clienteId) {
      const { error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', clienteId);

      if (error) {
        console.error('Erro ao atualizar cliente:', error);
        return NextResponse.json({ success: false, message: error.message || 'Falha ao atualizar o cliente.' }, { status: 500 });
      }

      revalidatePath('/clientes');
      revalidatePath('/');

      return NextResponse.json({ success: true, message: 'Cliente atualizado com sucesso.' });
    }

    const { error } = await supabase
      .from('clientes')
      .insert(payload);

    if (error) {
      console.error('Erro ao cadastrar cliente:', error);
      return NextResponse.json({ success: false, message: error.message || 'Falha ao cadastrar o cliente.' }, { status: 500 });
    }

    revalidatePath('/clientes');
    revalidatePath('/');

    return NextResponse.json({ success: true, message: 'Cliente cadastrado com sucesso.' });
  } catch (error) {
    console.error('Erro inesperado ao processar cliente:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Erro inesperado ao cadastrar o cliente.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Usuário não autenticado.' }, { status: 401 });
    }

    const profile = await getProfileByUserId(userId);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Apenas administradores podem excluir clientes.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get('id');

    if (!clienteId) {
      return NextResponse.json({ success: false, message: 'ID do cliente não fornecido.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Verificar se possui vendas vinculadas
    const { count: vendasCount, error: vendasError } = await supabase
      .from('vendas')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteId);

    if (vendasError) {
      console.error('Erro ao verificar vendas:', vendasError);
      return NextResponse.json({ success: false, message: 'Erro ao verificar vínculos do cliente.' }, { status: 500 });
    }

    if ((vendasCount || 0) > 0) {
      return NextResponse.json({ success: false, message: 'Este cliente possui vendas vinculadas e não pode ser excluído.' }, { status: 400 });
    }

    // 2. Excluir do funil_leads (pois não tem ON DELETE CASCADE)
    const { error: funilError } = await supabase
      .from('funil_leads')
      .delete()
      .eq('cliente_id', clienteId);

    if (funilError) {
      console.error('Erro ao excluir do funil de leads:', funilError);
      return NextResponse.json({ success: false, message: 'Erro ao excluir dados de funil do cliente.' }, { status: 500 });
    }

    // 3. Excluir do banco
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', clienteId);

    if (error) {
      console.error('Erro ao excluir cliente:', error);
      return NextResponse.json({ success: false, message: 'Erro ao excluir o cliente.' }, { status: 500 });
    }

    revalidatePath('/clientes');
    revalidatePath('/');

    return NextResponse.json({ success: true, message: 'Cliente excluído com sucesso.' });
  } catch (error) {
    console.error('Erro inesperado ao excluir cliente:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Erro inesperado ao excluir o cliente.' },
      { status: 500 }
    );
  }
}

