import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { verifyAndParseReferralCookie, COOKIE_NAME } from '@/lib/referral/cookie';
import { KitBryzaSalesPage } from '@/components/public/KitBryzaSalesPage';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PageProps {
  params: Promise<{
    code: string;
  }>;
}

export default async function PublicAmbassadorSalesPage({ params }: PageProps) {
  const { code } = await params;
  const rawCode = (code || '').toLowerCase().trim();

  // 1. Validar Regex Estrita. Se não corresponder, encerra a rota imediatamente em 404 seguro.
  if (!/^bryza[0-9]+$/.test(rawCode)) {
    notFound();
  }

  // 2. Checar Cookie HttpOnly no Servidor (Next 15/16 async cookies)
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(COOKIE_NAME)?.value;
  const verifiedReferral = verifyAndParseReferralCookie(rawCookie);

  // Se o cookie não existir ou for de outro código, redireciona UMA VEZ para /r/bryzaNN para gravar o cookie sem loop
  if (!verifiedReferral || verifiedReferral.referral_code !== rawCode) {
    redirect(`/r/${rawCode}`);
  }

  // 3. Buscar Dados Públicos do Embaixador via RPC pública restrita (sem expor status ou dados financeiros)
  const { data: ambRows, error: ambError } = await supabaseAdmin.rpc('fn_get_public_ambassador_by_code', {
    p_code: rawCode,
  });

  const ambassador = ambRows && ambRows[0];

  if (ambError || !ambassador) {
    notFound();
  }

  // 4. Buscar produto real da oferta. Nunca apresentar um ID fictício ao checkout.
  const { data: products, error: productsError } = await supabaseAdmin
    .from('produtos')
    .select('id, nome_produto, preco_venda')
    .eq('ativo', true)
    .gt('preco_venda', 0)
    .order('created_at', { ascending: true })
    .limit(1);

  if (productsError) {
    console.error('Erro ao carregar produto da oferta pública:', productsError.message);
  }

  return (
    <KitBryzaSalesPage
      ambassador={ambassador}
      products={products || []}
    />
  );
}
