import type { Metadata } from 'next';
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const rawCode = (code || '').toLowerCase().trim();

  return {
    metadataBase: new URL('https://bryza.com.br'),
    title: 'Kit Bryza Casa Perfumada | 10L + 2 Panos Premium Grátis',
    description: 'Leve 10 litros de Sabão Líquido e Amaciante Bryza por R$ 79,80, ganhe 2 Panos Premium e pague somente na entrega.',
    alternates: {
      canonical: `https://bryza.com.br/${rawCode}`,
    },
    icons: {
      icon: '/fiveicon.svg',
      shortcut: '/fiveicon.svg',
      apple: '/fiveicon.svg',
    },
    openGraph: {
      title: 'Kit Bryza Casa Perfumada | 10L + 2 Panos Premium Grátis',
      description: '10 litros por apenas R$ 7,99 o litro. Frete grátis nas regiões atendidas e pagamento somente na entrega.',
      url: `https://bryza.com.br/${rawCode}`,
      siteName: 'Bryza',
      locale: 'pt_BR',
      type: 'website',
      images: [
        {
          url: 'https://bryza.com.br/og-kit-bryza.png',
          width: 1200,
          height: 630,
          alt: 'Kit Bryza Casa Perfumada com 10 litros e 2 Panos Premium grátis',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Kit Bryza Casa Perfumada | 10L + 2 Panos Premium Grátis',
      description: '10 litros por R$ 79,80. Frete grátis nas regiões atendidas e pagamento somente na entrega.',
      images: ['https://bryza.com.br/og-kit-bryza.png'],
    },
  };
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
