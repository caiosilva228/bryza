import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Política de Entrega | Bryza',
  description: 'Entenda como funcionam as rotas de entrega gratuita da Bryza e o agendamento por WhatsApp.',
};

export default function PoliticaEntregaPage() {
  return (
    <main style={{ background: '#051329', color: '#ffffff', minHeight: '100vh', padding: '60px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ display: 'inline-block', marginBottom: '32px' }}>
          <Image src="/Logo Bryza.svg" alt="Bryza" width={130} height={42} style={{ filter: 'brightness(0) invert(1)' }} />
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '24px' }}>Política de Entrega</h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '16px' }}>
          A Bryza opera com sistema de rotas programadas para oferecer frete grátis e entrega direta no seu endereço.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '28px', marginBottom: '12px', color: '#a6ce39' }}>
          1. Regiões Atendidas
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '16px' }}>
          As entregas gratuitas são realizadas nas regiões participantes do nosso plano de rotas (incluindo Cidade Ocidental, Valparaíso de Goiás, Luziânia e arredores).
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '28px', marginBottom: '12px', color: '#a6ce39' }}>
          2. Confirmação da Rota via WhatsApp
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '16px' }}>
          Após você informar seu endereço no formulário, a equipe Bryza entrará em contato via WhatsApp para confirmar o dia e o período em que o motorista passará na sua rua.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '28px', marginBottom: '12px', color: '#a6ce39' }}>
          3. Pagamento no Ato da Entrega
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '24px' }}>
          Você só realiza o pagamento quando o Kit Bryza for fisicamente entregue nas suas mãos. Aceitamos Pix, dinheiro ou cartão na maquininha do entregador.
        </p>

        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Link href="/" style={{ color: '#a6ce39', textDecoration: 'underline', fontWeight: '600' }}>
            ← Voltar para a página inicial
          </Link>
        </div>
      </div>
    </main>
  );
}
