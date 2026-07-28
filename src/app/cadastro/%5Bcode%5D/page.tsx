import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { CadastroPageClient } from './CadastroPageClient';

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
  const upperCode = rawCode.toUpperCase();

  return {
    metadataBase: new URL('https://bryza.com.br'),
    title: `Convite para Programa de Embaixadores | ${upperCode}`,
    description: `Faça parte do Programa de Embaixadores Bryza através da indicação de ${upperCode}.`,
    alternates: {
      canonical: `https://bryza.com.br/cadastro/${rawCode}`,
    },
    icons: {
      icon: '/fiveicon.svg',
      shortcut: '/fiveicon.svg',
      apple: '/fiveicon.svg',
    },
    openGraph: {
      title: `Convite de Embaixador Bryza | ${upperCode}`,
      description: `Torne-se um Embaixador Bryza com link personalizado e comissões diretas.`,
      url: `https://bryza.com.br/cadastro/${rawCode}`,
      siteName: 'Bryza',
      locale: 'pt_BR',
      type: 'website',
    },
  };
}

export default async function CadastroEmbaixadorConvitePage({ params }: PageProps) {
  const { code } = await params;
  const rawCode = (code || '').toLowerCase().trim();

  // 1. Validar formato da rota /cadastro/bryzaNN
  if (!/^bryza[0-9]+$/.test(rawCode)) {
    notFound();
  }

  // 2. Buscar Dados Públicos do Embaixador Patrocinador via RPC
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

  const sponsorData = {
    display_name: ambassador.display_name || ambassador.referral_code,
    referral_code: ambassador.referral_code,
    photo_path: resolvedPhotoPath,
    city: ambassador.city || null,
  };

  return <CadastroPageClient sponsor={sponsorData} />;
}
