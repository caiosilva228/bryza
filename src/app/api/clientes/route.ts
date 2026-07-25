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
    cpf: formData.get('cpf')?.toString().replace(/\D/g, '') || null,
    email: formData.get('email')?.toString().trim().toLowerCase() || null,
    latitude: formData.get('latitude') ? Number(formData.get('latitude')) : null,
    longitude: formData.get('longitude') ? Number(formData.get('longitude')) : null,
    ambassador_id: formData.get('ambassador_id')?.toString() || null,
    assignment_reason: formData.get('assignment_reason')?.toString() || null,
    idempotency_key: formData.get('idempotency_key')?.toString() || crypto.randomUUID(),
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

    const authClient = await createAuthClient();
    const { data, error } = await authClient.rpc('fn_upsert_customer_canonical', {
      p_customer_id: clienteId || null,
      p_full_name: payload.nome,
      p_phone: payload.telefone,
      p_email: payload.email,
      p_cpf: payload.cpf,
      p_cep: payload.cep,
      p_address: payload.endereco,
      p_number: payload.numero,
      p_neighborhood: payload.bairro,
      p_city: payload.cidade,
      p_state: payload.estado,
      p_origin: payload.origem,
      p_customer_status: payload.status_cliente,
      p_commercial_profile_id: payload.vendedor_responsavel_id,
      p_latitude: Number.isFinite(payload.latitude) ? payload.latitude : null,
      p_longitude: Number.isFinite(payload.longitude) ? payload.longitude : null,
      p_ambassador_id: profile.role === 'admin' ? payload.ambassador_id : null,
      p_assignment_reason: payload.assignment_reason,
      p_idempotency_key: payload.idempotency_key,
    });

    if (error) {
      console.error('Erro na escrita canônica do cliente:', {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { success: false, message: error.message || 'Falha ao salvar o cliente.' },
        { status: error.code === '42501' ? 403 : 500 }
      );
    }

    const result = data as {
      status?: string;
      entity_id?: string;
      review_id?: string;
      replayed?: boolean;
    } | null;

    if (result?.status === 'manual_review_required') {
      return NextResponse.json(
        {
          success: false,
          status: result.status,
          reviewId: result.review_id,
          message: 'Os identificadores informados entram em conflito com outro cadastro. O caso foi encaminhado para revisão administrativa e nenhum cadastro foi alterado.',
        },
        { status: 409 }
      );
    }

    if (result?.status === 'existing_customer') {
      return NextResponse.json(
        {
          success: false,
          status: result.status,
          customerId: result.entity_id,
          message: 'Esta pessoa já possui um cadastro de cliente. Abra o cadastro existente em vez de criar outro.',
        },
        { status: 409 }
      );
    }

    if (result?.status === 'idempotency_conflict') {
      return NextResponse.json(
        {
          success: false,
          status: result.status,
          message: 'A chave desta operação foi reutilizada com dados diferentes. Recarregue o formulário e tente novamente.',
        },
        { status: 409 }
      );
    }

    if (!result || !['created', 'updated'].includes(result.status || '')) {
      return NextResponse.json(
        { success: false, message: 'O banco não confirmou a gravação do cliente.' },
        { status: 500 }
      );
    }

    revalidatePath('/clientes');
    revalidatePath('/');

    return NextResponse.json({
      success: true,
      customerId: result.entity_id,
      replayed: Boolean(result.replayed),
      message: result.status === 'updated'
        ? 'Cliente atualizado com sucesso.'
        : 'Cliente cadastrado com sucesso.',
    });
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
      return NextResponse.json({ success: false, message: 'Apenas administradores podem arquivar clientes.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get('id');

    if (!clienteId) {
      return NextResponse.json({ success: false, message: 'ID do cliente não fornecido.' }, { status: 400 });
    }

    const authClient = await createAuthClient();
    const { data, error } = await authClient.rpc('fn_archive_customer', {
      p_customer_id: clienteId,
      p_reason: 'Arquivamento confirmado no cadastro administrativo',
    });

    if (error) {
      console.error('Erro ao arquivar cliente:', {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ success: false, message: 'Erro ao arquivar o cliente.' }, { status: 500 });
    }

    const result = data as { status?: string } | null;
    if (!result || !['archived'].includes(result.status || '')) {
      return NextResponse.json(
        { success: false, message: 'Cliente não encontrado para arquivamento.' },
        { status: 404 }
      );
    }

    revalidatePath('/clientes');
    revalidatePath('/');

    return NextResponse.json({
      success: true,
      message: 'Cliente arquivado com sucesso. Pedidos, atribuições e auditorias foram preservados.',
    });
  } catch (error) {
    console.error('Erro inesperado ao arquivar cliente:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Erro inesperado ao arquivar o cliente.' },
      { status: 500 }
    );
  }
}
