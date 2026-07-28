import Link from 'next/link';

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const content = status === 'success'
    ? {
      icon: 'check_circle',
      title: 'Pagamento recebido',
      text: 'Estamos confirmando o pagamento diretamente com o Mercado Pago. Assim que aprovado, o pedido e a comissão do embaixador serão atualizados automaticamente.',
      color: '#2e7d32',
    }
    : status === 'pending'
      ? {
        icon: 'schedule',
        title: 'Pagamento em análise',
        text: 'O Mercado Pago ainda está processando o pagamento. Você pode acompanhar a atualização em Meus pedidos.',
        color: '#b26a00',
      }
      : {
        icon: 'error',
        title: 'Pagamento não concluído',
        text: 'O agendamento continua registrado. Você poderá tentar novamente ou optar pelo pagamento na entrega.',
        color: '#b3261e',
      };

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      background: '#f5f7fa',
    }}>
      <section style={{
        maxWidth: 560,
        padding: 36,
        borderRadius: 24,
        background: '#fff',
        boxShadow: '0 20px 60px rgba(5,19,41,.12)',
        textAlign: 'center',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 58, color: content.color }}>
          {content.icon}
        </span>
        <h1 style={{ margin: '12px 0', color: '#051329' }}>{content.title}</h1>
        <p style={{ color: '#526174', lineHeight: 1.6 }}>{content.text}</p>
        <Link href="/loja" style={{
          display: 'inline-block',
          marginTop: 16,
          padding: '12px 20px',
          borderRadius: 12,
          background: '#0b5ea8',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 700,
        }}>
          Voltar para a loja
        </Link>
      </section>
    </main>
  );
}
