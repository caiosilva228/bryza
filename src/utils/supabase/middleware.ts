import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from './admin';
import { getSubdomainType, getSubdomainUrl } from '../subdomain';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            const finalOptions = cookieDomain ? { ...options, domain: cookieDomain } : options;
            supabaseResponse.cookies.set(name, value, finalOptions);
          });
        },
      },
    }
  );

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const subdomain = getSubdomainType(host);
  const pathname = request.nextUrl.pathname;

  const isApiRoute = pathname.startsWith('/api/');
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/embaixador/login');
  const isPrimeiroAcesso = pathname.startsWith('/primeiro-acesso');
  const isPublicIndication = pathname.startsWith('/r/');
  const isPublicSalesPage = /^\/bryza[0-9]+$/.test(pathname.toLowerCase());
  const isPublicEarningsCalculator = pathname === '/calculadora-de-ganhos';
  
  // Ignorar assets estáticos comuns
  const isStaticAsset = pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/) || pathname.includes('_next/');

  if (isStaticAsset || isPublicIndication || isPublicSalesPage || isPublicEarningsCalculator) {
    return supabaseResponse;
  }

  // Sem um cookie de sessão não há usuário autenticado para redirecionar.
  // Evita uma chamada remota antes de renderizar a primeira tela de login.
  const hasAuthCookie = request.cookies.getAll().some(({ name }) =>
    name.startsWith('sb-') && name.includes('auth-token')
  );

  if (!hasAuthCookie) {
    if (isApiRoute) {
      if (pathname.startsWith('/api/auth/')) {
        return supabaseResponse;
      }
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    if (isAuthRoute || (subdomain === 'public' && pathname === '/')) {
      return supabaseResponse;
    }

    const loginTarget = getSubdomainUrl(subdomain === 'ev' ? 'ev' : 'admin', '/login', host);
    return NextResponse.redirect(new URL(loginTarget, request.url));
  }

  // 1. Atualizar token de autenticação
  const { data: claimsData, error: getClaimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  // 2. Se houver erro de autenticação ou se NÃO estiver autenticado
  if (getClaimsError || !userId) {
    // Apagar cookies inválidos se o token estiver corrompido
    const allCookies = request.cookies.getAll();
    allCookies.forEach(({ name }) => {
      if (name.startsWith('sb-') || name.includes('auth-token')) {
        supabaseResponse.cookies.delete(name);
      }
    });

    if (isApiRoute) {
      if (pathname.startsWith('/api/auth/')) {
        return supabaseResponse;
      }
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    // Se estiver no domínio público (bryza.com.br) e na raiz (/), permitir visualizar a Landing Page
    if (subdomain === 'public' && pathname === '/') {
      return supabaseResponse;
    }

    if (!isAuthRoute) {
      const loginTarget = getSubdomainUrl(subdomain === 'ev' ? 'ev' : 'admin', '/login', host);
      const redirectRes = NextResponse.redirect(new URL(loginTarget, request.url));
      allCookies.forEach(({ name }) => {
        if (name.startsWith('sb-') || name.includes('auth-token')) {
          redirectRes.cookies.delete(name);
        }
      });
      return redirectRes;
    }
    return supabaseResponse;
  }

  // 3. Se autenticado, verificar status e permissões no banco usando o cliente administrativo
  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role, ativo, must_change_password')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Perfil não encontrado para o usuário autenticado:', profileError);
    const loginTarget = getSubdomainUrl(subdomain === 'ev' ? 'ev' : 'admin', '/login?error=BlockedUser', host);
    const response = NextResponse.redirect(new URL(loginTarget, request.url));
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');
    await supabase.auth.signOut();
    return response;
  }

  // A. Conta Inativa/Bloqueada
  if (!profile.ativo) {
    const loginTarget = getSubdomainUrl(subdomain === 'ev' ? 'ev' : 'admin', '/login?error=BlockedUser', host);
    const response = NextResponse.redirect(new URL(loginTarget, request.url));
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
      .eq('user_id', userId)
      .single();

    if (ambError || !amb || amb.status !== 'ativo') {
      const loginTarget = getSubdomainUrl('ev', '/login?error=BlockedUser', host);
      const response = NextResponse.redirect(new URL(loginTarget, request.url));
      response.cookies.delete('sb-access-token');
      response.cookies.delete('sb-refresh-token');
      await supabase.auth.signOut();
      return response;
    }
  }

  // C. Primeiro Acesso Obrigatório (must_change_password = true)
  if (profile.must_change_password) {
    if (isApiRoute) {
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
    let dashboardPath = '/';
    let targetSubdomain: 'ev' | 'admin' = 'admin';
    if (profile.role === 'embaixador') {
      dashboardPath = '/embaixador/dashboard';
      targetSubdomain = 'ev';
    } else if (profile.role === 'logistica') {
      dashboardPath = '/logistica';
    }
    const redirectUrl = getSubdomainUrl(targetSubdomain, dashboardPath, host);
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  // E. Se tentar ir para a tela de login já estando autenticado
  if (isAuthRoute) {
    let dashboardPath = '/';
    let targetSubdomain: 'ev' | 'admin' = 'admin';
    if (profile.role === 'embaixador') {
      dashboardPath = '/embaixador/dashboard';
      targetSubdomain = 'ev';
    } else if (profile.role === 'logistica') {
      dashboardPath = '/logistica';
    }
    const redirectUrl = getSubdomainUrl(targetSubdomain, dashboardPath, host);
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  // Se estiver no domínio público (bryza.com.br) e na raiz (/), permitir visualizar a Landing Page mesmo logado
  if (subdomain === 'public' && pathname === '/') {
    return supabaseResponse;
  }

  // F. Proteção Cross-Subdomain e RBAC
  if (profile.role === 'embaixador') {
    // Embaixadores devem estar no subdomínio EV
    if (subdomain === 'admin') {
      const redirectUrl = getSubdomainUrl('ev', '/embaixador/dashboard', host);
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // Se estiver na raiz de qualquer domínio ou tentando acessar rotas administrativas restritas
    const isRestrictedAdminPath = [
      '/vendas',
      '/vendedores',
      '/clientes',
      '/estoque',
      '/produtos',
      '/rotas',
      '/motoristas',
      '/logistica',
      '/metas',
      '/embaixadores'
    ].some(prefix => pathname.startsWith(prefix));

    if (pathname === '/' || isRestrictedAdminPath) {
      const redirectUrl = getSubdomainUrl('ev', '/embaixador/dashboard', host);
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
  } else {
    // Admin, Vendedor, Logística devem estar no subdomínio ADMIN ou público
    if (subdomain === 'ev') {
      const targetPath = profile.role === 'logistica' ? '/logistica' : '/';
      const redirectUrl = getSubdomainUrl('admin', targetPath, host);
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    if (pathname.startsWith('/embaixador/')) {
      const targetPath = profile.role === 'logistica' ? '/logistica' : '/';
      const redirectUrl = getSubdomainUrl('admin', targetPath, host);
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
  }

  return supabaseResponse;
}
