'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { toast } from 'sonner';

export default function MateriaisPage() {
  const materiais = [
    {
      title: 'Logomarca Bryza Oficial',
      description: 'Arquivos em alta definição nos formatos SVG e PNG transparente.',
      category: 'Branding',
      url: 'https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/Bryza/New%20Logo%20Bryza.svg'
    },
    {
      title: 'Banner de Divulgação Instagram Stories (1080x1920)',
      description: 'Arte promocional para publicação nos stories com espaço para o seu código.',
      category: 'Redes Sociais',
      url: '#'
    },
    {
      title: 'Guia de Boas Práticas para Embaixadores Bryza',
      description: 'Manual com estratégias de vendas, abordagem de clientes e éticas da marca.',
      category: 'Capacitação',
      url: '#'
    }
  ];

  const handleDownload = (item: any) => {
    if (item.url === '#') {
      toast.info('Material em breve estará disponível para download direto!');
      return;
    }
    window.open(item.url, '_blank');
  };

  return (
    <MainLayout>
      <div style={{ maxWidth: '1000px', margin: '0 auto 40px' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ color: 'var(--color-primary)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700, margin: 0 }}>
            Materiais de Divulgação
          </h1>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px' }}>
            Recursos visuais, artes e guias oficiais para alavancar suas indicações.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {materiais.map((item, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: 'var(--color-surface-container-low)',
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid var(--color-outline-variant)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px'
              }}
            >
              <div>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-secondary-container)',
                  color: 'var(--color-on-secondary-container)',
                  textTransform: 'uppercase'
                }}>
                  {item.category}
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)', marginTop: '12px', marginBottom: '8px' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', lineHeight: 1.5, margin: 0 }}>
                  {item.description}
                </p>
              </div>

              <button
                onClick={() => handleDownload(item)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
                Acessar Material
              </button>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
