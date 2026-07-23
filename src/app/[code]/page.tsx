import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { verifyAndParseReferralCookie, COOKIE_NAME } from '@/lib/referral/cookie';
import { KitBryzaSalesPagePremium } from '@/components/public/KitBryzaSalesPagePremium';
import { faqs } from '@/components/public/kit-bryza-content';

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
    title: 'Kit Bryza 10 Litros + 2 Panos Premium | Entrega Grátis',
    description: 'Leve Sabão Líquido Bryza 5L, Amaciante Microencapsulado 5L e ganhe 2 Panos Premium Xadrez. Kit por R$79,80, com frete grátis e pagamento na entrega.',
    alternates: {
      canonical: `https://bryza.com.br/${rawCode}`,
    },
    icons: {
      icon: '/fiveicon.svg',
      shortcut: '/fiveicon.svg',
      apple: '/fiveicon.svg',
    },
    openGraph: {
      title: 'Kit Bryza 10 Litros + 2 Panos Premium | Entrega Grátis',
      description: 'Kit completo por R$79,80, com frete grátis nas regiões atendidas e pagamento somente na entrega.',
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
      title: 'Kit Bryza 10 Litros + 2 Panos Premium | Entrega Grátis',
      description: 'Kit completo por R$79,80, com frete grátis nas regiões atendidas e pagamento somente na entrega.',
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

  // Resolver photo_path para URL pública quando for um caminho do storage Supabase
  let resolvedPhotoPath: string | null = null;
  if (ambassador.photo_path) {
    if (ambassador.photo_path.startsWith('http://') || ambassador.photo_path.startsWith('https://')) {
      resolvedPhotoPath = ambassador.photo_path;
    } else {
      const { data: publicData } = supabaseAdmin.storage
        .from('ambassador-photos')
        .getPublicUrl(ambassador.photo_path);
      resolvedPhotoPath = publicData?.publicUrl || null;
    }
  }

  const publicAmbassador = {
    ...ambassador,
    photo_path: resolvedPhotoPath,
  };

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

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: 'Kit Bryza Casa Perfumada — 10 Litros + 2 Panos Premium',
        image: 'https://bryza.com.br/hero-products.webp',
        description: 'Sabão Líquido Concentrado Bryza 5L, Amaciante Microencapsulado Bryza 5L e 2 Panos Premium Xadrez.',
        brand: { '@type': 'Brand', name: 'Bryza' },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'BRL',
          price: '79.80',
          availability: products?.length ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `https://bryza.com.br/${rawCode}`,
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    ],
  };

  return (
    <>
      <KitBryzaSalesPagePremium ambassador={publicAmbassador} products={products || []} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
    </>
  );
}
