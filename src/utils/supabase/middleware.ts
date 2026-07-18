import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from './admin';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 1. Atualizar token de autenticação
  const {
    data: { user },
    error: getUserError
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api/');
  const isAuthRoute = pathname.startsWith('/login');
  const isPrimeiroAcesso = pathname.startsWith('/primeiro-acesso');
  const isPublicIndication = pathname.startsWith('/r/');
  
  // Ignorar assets estáticos comuns
  const isStaticAsset = pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/) || pathname.includes('_next/');

  if (isStaticAsset || isPublicIndication) {
    return supabaseResponse;
  }

  // 2. Se NÃO autenticado
  if (!user) {
    if (isApiRoute) {
      // Ignorar rotas de autenticação pública se houver
      if (pathname.startsWith('/api/auth/')) {
        return supabaseResponse;
      }
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    if (!isAuthRoute) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return supabaseResponse;
  }

  // 3. Se autenticado, verificar status e permissões no banco usando o cliente administrativo isolado
  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role, ativo, must_change_password')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Perfil não encontrado para o usuário autenticado:', profileError);
    // Deslogar usuário
    const response = NextResponse.redirect(new URL('/login?error=BlockedUser', request.url));
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');
    await supabase.auth.signOut();
    return response;
  }

  // A. Conta Inativa/Bloqueada
  if (!profile.ativo) {
    const response = NextResponse.redirect(new URL('/login?error=BlockedUser', request.url));
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');
    await supabase.auth.signOut();
    return response;
  }

  // B. Se for Embaixador, validar status específico na tabela ambassadors
  if (profile.role === 'embaixador') {
    const { data: amb, error: ambError } = await adminClient
      .from('ambassadors')
      .select('status')
      .eq('user_id', user.id)
      .single();

    if (ambError || !amb || amb.status !== 'ativo') {
      // Status pendente, inativo ou bloqueado
      const response = NextResponse.redirect(new URL('/login?error=BlockedUser', request.url));
      response.cookies.delete('sb-access-token');
      response.cookies.delete('sb-refresh-token');
      await supabase.auth.signOut();
      return response;
    }
  }

  // C. Primeiro Acesso Obrigatório (must_change_password = true)
  if (profile.must_change_password) {
    if (isApiRoute) {
      // Permitir apenas logout ou ações de primeiro acesso
      if (pathname.startsWith('/api/auth/logout') || pathname === '/api/primeiro-acesso') {
        return supabaseResponse;
      }
      return NextResponse.json({ error: 'Troca de senha obrigatória pendente.' }, { status: 403 });
    }

    if (!isPrimeiroAcesso && !isAuthRoute) {
      return NextResponse.redirect(new URL('/primeiro-acesso', request.url));
    }
    return supabaseResponse;
  }

  // D. Se must_change_password = false e tentar ir para /primeiro-acesso, redirecionar
  if (isPrimeiroAcesso) {
    let dashboardUrl = '/';
    if (profile.role === 'embaixador') {
      dashboardUrl = '/embaixador/dashboard';
    } else if (profile.role === 'logistica') {
      dashboardUrl = '/logistica';
    }
    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  // E. Se tentar ir para a tela de login já estando autenticado
  if (isAuthRoute) {
    let dashboardUrl = '/';
    if (profile.role === 'embaixador') {
      dashboardUrl = '/embaixador/dashboard';
    } else if (profile.role === 'logistica') {
      dashboardUrl = '/logistica';
    }
    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  // F. Redirecionamentos na Rota Raiz (/) para evitar loops
  if (pathname === '/') {
    if (profile.role === 'embaixador') {
      return NextResponse.redirect(new URL('/embaixador/dashboard', request.url));
    }
    if (profile.role === 'logistica') {
      return NextResponse.redirect(new URL('/logistica', request.url));
    }
    // Admin e Vendedor continuam em "/" sem redirecionar
    return supabaseResponse;
  }

  // G. Restrições de Acesso por Papel (RBAC) - Camada de Roteamento
  if (profile.role === 'embaixador') {
    const isRestrictedPath = [
      '/vendas',
      '/vendedores',
      '/clientes',
      '/estoque',
      '/produtos',
      '/rotas',
      '/motoristas',
      '/logistica',
      '/metas'
    ].some(prefix => pathname.startsWith(prefix));

    if (isRestrictedPath) {
      return NextResponse.redirect(new URL('/embaixador/dashboard', request.url));
    }
  }

  return supabaseResponse;
}
