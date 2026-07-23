import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Bryza',
  description: 'Saiba como a Bryza trata, armazena e protege seus dados pessoais de acordo com a LGPD.',
};

export default function PrivacidadePage() {
  return (
    <main style={{ background: '#051329', color: '#ffffff', minHeight: '100vh', padding: '60px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ display: 'inline-block', marginBottom: '32px' }}>
          <Image src="/Logo Bryza.svg" alt="Bryza" width={130} height={42} style={{ filter: 'brightness(0) invert(1)' }} />
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '24px' }}>Política de Privacidade</h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '16px' }}>
          A Bryza respeita a sua privacidade e está comprometida com a proteção dos dados pessoais dos seus clientes e visitantes, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '28px', marginBottom: '12px', color: '#a6ce39' }}>
          1. Dados Coletados
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '16px' }}>
          Para processar a sua solicitação de agendamento do Kit Bryza, podemos coletar: nome completo, telefone/WhatsApp, endereço de entrega, cidade, bairro, preferência de horário e forma de pagamento escolhida para o momento da entrega.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '28px', marginBottom: '12px', color: '#a6ce39' }}>
          2. Finalidade da Coleta
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '16px' }}>
          Seus dados são utilizados exclusivamente para: verificar a disponibilidade da rota de entrega na sua região, confirmar os detalhes do pedido pelo WhatsApp, realizar a entrega dos produtos no seu endereço e operacionalizar o atendimento ao cliente.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '28px', marginBottom: '12px', color: '#a6ce39' }}>
          3. Compartilhamento de Dados
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '16px' }}>
          Seus dados pessoais não são vendidos ou comercializados. O compartilhamento ocorre apenas com os membros da equipe própria de logística e entregas da Bryza estritamente necessários para a conclusão do atendimento.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '28px', marginBottom: '12px', color: '#a6ce39' }}>
          4. Links de Indicação de Embaixadores
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '16px' }}>
          Ao acessar a oferta por meio do link de um Embaixador Bryza, um identificador anônimo de recomendação pode ser gravado em cookie seguro para atribuir a indicação. A indicação não altera o preço nem expõe dados financeiros ao embaixador.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '28px', marginBottom: '12px', color: '#a6ce39' }}>
          5. Direitos do Titular
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '24px' }}>
          Você pode solicitar a confirmação, acesso, correção ou eliminação dos seus dados a qualquer momento entrando em contato com a equipe Bryza pelo WhatsApp oficial.
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
