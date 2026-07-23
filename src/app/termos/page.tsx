import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Termos de Uso | Bryza',
  description: 'Condições gerais de uso do site, agendamento de pedidos e regras do serviço Bryza.',
};

export default function TermosPage() {
  return (
    <main style={{ background: '#051329', color: '#ffffff', minHeight: '100vh', padding: '60px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ display: 'inline-block', marginBottom: '32px' }}>
          <Image src="/Logo Bryza.svg" alt="Bryza" width={130} height={42} style={{ filter: 'brightness(0) invert(1)' }} />
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '24px' }}>Termos de Uso</h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '16px' }}>
          Estes Termos de Uso regulam o acesso e a solicitação de agendamento de produtos através do site oficial da Bryza.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '28px', marginBottom: '12px', color: '#a6ce39' }}>
          1. Solicitação de Agendamento
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '16px' }}>
          O preenchimento e envio do formulário no site representa uma solicitação de agendamento. O pedido é considerado confirmado somente após a verificação da rota pela equipe Bryza e contato via WhatsApp.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '28px', marginBottom: '12px', color: '#a6ce39' }}>
          2. Pagamento e Entrega
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '16px' }}>
          Não há cobrança nem pagamento antecipado. O pagamento total do Kit Bryza (R$ 79,80) é realizado exclusivamente no momento em que o cliente recebe os produtos no seu endereço.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '28px', marginBottom: '12px', color: '#a6ce39' }}>
          3. Disponibilidade dos Brindes
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '16px' }}>
          Os 2 Panos Xadrez de Alta Absorção (45 × 70 cm) são oferecidos de presente na compra do kit completo e estão sujeitos à disponibilidade do lote destinado a cada rota de entrega.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '28px', marginBottom: '12px', color: '#a6ce39' }}>
          4. Indicação por Embaixadores
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '24px' }}>
          A indicação por um Embaixador Bryza serve para identificar a origem do acesso e não altera o valor final da oferta, nem transfere a responsabilidade da entrega, que permanece 100% sob gestão da Bryza.
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
