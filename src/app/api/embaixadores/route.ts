import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// Validador de CPF padrão (algoritmo dos dígitos verificadores)
function isValidCPF(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCpf)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCpf.substring(i - 1, i), 10) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.substring(9, 10), 10)) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCpf.substring(i - 1, i), 10) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.substring(10, 11), 10)) return false;

  return true;
}

export async function POST(req: NextRequest) {
  // 1. Obter sessão real do cookie (sem confiar em cabeçalhos client-side)
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  // 2. Obter perfil e verificar se é admin ativo no banco
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.ativo || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado. Apenas administradores ativos.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { 
      full_name, 
      display_name, 
      cpf, 
      phone, 
      email, 
      instagram, 
      city, 
      state, 
      pix_type, 
      pix_key, 
      commission_plan_id, 
      parent_ambassador_id, 
      status, 
      notes, 
      photo_path,
      cep,
      address,
      number,
      neighborhood,
      latitude,
      longitude 
    } = body;

    // Validações básicas
    if (!full_name || !cpf || !email) {
      return NextResponse.json({ error: 'Nome completo, CPF e E-mail são obrigatórios.' }, { status: 400 });
    }

    const normalizedCpf = cpf.replace(/\D/g, '');
    if (!isValidCPF(normalizedCpf)) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
    }

    const contactEmail = email.trim().toLowerCase();

    // Normalização rigorosa de Estado (UF) para atender a constraint chk_ambassador_state
    const normalizedState = state && state.trim() ? state.trim().toUpperCase() : null;
    if (normalizedState && !/^[A-Z]{2}$/.test(normalizedState)) {
      return NextResponse.json({ error: 'Estado (UF) deve conter exatamente 2 letras (ex: SP, GO).' }, { status: 400 });
    }

    // Normalização de Tipo de Chave Pix para atender a constraint ambassadors_pix_key_type_check
    let normalizedPixType: string | null = pix_type || null;
    if (normalizedPixType === 'pix' || normalizedPixType === 'outro') {
      normalizedPixType = 'chave_aleatoria';
    }

    // 3. Validação de Duplicidades e Idempotência (Chave Natural: CPF)
    const { data: existingAmbCpf } = await supabase
      .from('ambassadors')
      .select('id, username')
      .eq('cpf', normalizedCpf)
      .maybeSingle();

    if (existingAmbCpf) {
      const adminClient = createAdminClient();
      await adminClient.from('audit_logs').insert({
        actor_id: user.id,
        actor_role: 'admin',
        action: 'create_ambassador_duplicate_attempt',
        entity_type: 'ambassadors',
        entity_id: existingAmbCpf.id,
        metadata: { cpf: normalizedCpf, username: existingAmbCpf.username }
      });

      return NextResponse.json({
        success: true,
        message: 'Embaixador já cadastrado (idempotência).',
        data: existingAmbCpf
      });
    }

    // Verificar se o e-mail de contato já está cadastrado para outro embaixador
    const { data: existingAmbEmail } = await supabase
      .from('ambassadors')
      .select('id')
      .eq('email', contactEmail)
      .maybeSingle();

    if (existingAmbEmail) {
      return NextResponse.json({ error: 'E-mail de contato já cadastrado para outro embaixador.' }, { status: 409 });
    }

    // 4. Fluxo de Transação Compensatória (Evitar órfãos)
    const adminClient = createAdminClient();
    let resolvedCommissionPlanId = commission_plan_id || null;
    if (!resolvedCommissionPlanId) {
      const { data: programSettings, error: settingsError } = await adminClient
        .from('ambassador_program_settings')
        .select('default_commission_plan_id')
        .eq('singleton', true)
        .single();
      if (settingsError || !programSettings?.default_commission_plan_id) {
        return NextResponse.json({ error: 'Plano padrão do programa não configurado.' }, { status: 500 });
      }
      resolvedCommissionPlanId = programSettings.default_commission_plan_id;
    }
    
    // Inserção inicial em public.ambassadors com user_id nulo para gerar o username bryzaNN
    const { data: newAmb, error: ambInsertError } = await adminClient
      .from('ambassadors')
      .insert({
        full_name,
        display_name: display_name || full_name,
        cpf: normalizedCpf,
        phone: phone || null,
        email: contactEmail,
        instagram: instagram || null,
        city: city ? city.trim() : null,
        state: normalizedState,
        pix_key_type: normalizedPixType,
        pix_key: pix_key ? pix_key.trim() : null,
        commission_plan_id: resolvedCommissionPlanId,
        parent_ambassador_id: parent_ambassador_id || null,
        status: status || 'pendente',
        notes: notes || null,
        photo_path: photo_path || null,
        cep: cep || null,
        address: address || null,
        number: number || null,
        neighborhood: neighborhood || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        user_id: null
      })
      .select()
      .single();

    if (ambInsertError || !newAmb) {
      console.error('Erro ao inserir embaixador:', ambInsertError);
      return NextResponse.json({ 
        error: `Erro ao iniciar cadastro: ${ambInsertError?.message || ambInsertError?.details || 'Erro ao inserir registro no banco.'}` 
      }, { status: 500 });
    }

    // Gerar e-mail sintético e criar conta auth
    const syntheticEmail = `${newAmb.username}@usuarios.bryza.internal`;

    const { data: authData, error: createUserError } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password: normalizedCpf,
      email_confirm: true,
      user_metadata: {
        nome: full_name,
        role: 'embaixador'
      }
    });

    if (createUserError || !authData.user) {
      console.error('Erro ao criar usuário auth:', createUserError);
      
      // COMPENSAÇÃO 1: Deletar registro de embaixador criado
      await adminClient.from('ambassadors').delete().eq('id', newAmb.id);

      return NextResponse.json({ error: `Erro ao criar credenciais: ${createUserError?.message || 'Erro desconhecido'}` }, { status: 500 });
    }

    // Atualizar user_id no embaixador
    const { error: ambUpdateError } = await adminClient
      .from('ambassadors')
      .update({ user_id: authData.user.id })
      .eq('id', newAmb.id);

    if (ambUpdateError) {
      console.error('Erro ao vincular user_id no embaixador:', ambUpdateError);

      // COMPENSAÇÃO 2: Excluir usuário auth e embaixador
      await adminClient.auth.admin.deleteUser(authData.user.id);
      await adminClient.from('ambassadors').delete().eq('id', newAmb.id);

      return NextResponse.json({ error: `Erro ao associar credenciais: ${ambUpdateError.message}` }, { status: 500 });
    }

    // Inserir profile correspondente manualmente (já que não há triggers automáticos no auth.users)
    const { error: profileInsertError } = await adminClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        nome: full_name,
        email: syntheticEmail,
        role: 'embaixador',
        ativo: (status === 'ativo'),
        must_change_password: true
      });

    if (profileInsertError) {
      console.error('Erro ao criar perfil do embaixador:', profileInsertError);

      // COMPENSAÇÃO 3: Excluir usuário auth e embaixador
      await adminClient.auth.admin.deleteUser(authData.user.id);
      await adminClient.from('ambassadors').delete().eq('id', newAmb.id);

      return NextResponse.json({ error: `Erro ao criar perfil operacional: ${profileInsertError.message}` }, { status: 500 });
    }

    // Registrar log de auditoria
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      actor_role: 'admin',
      action: 'create_ambassador',
      entity_type: 'ambassadors',
      entity_id: newAmb.id,
      metadata: {
        username: newAmb.username,
        commission_plan_id: newAmb.commission_plan_id
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Embaixador cadastrado com sucesso.',
      data: {
        id: newAmb.id,
        username: newAmb.username,
        email: contactEmail,
        status: newAmb.status
      }
    });

  } catch (err: any) {
    console.error('Erro não tratado na API:', err);
    return NextResponse.json({ error: `Erro interno do servidor: ${err?.message || err}` }, { status: 500 });
  }
}
