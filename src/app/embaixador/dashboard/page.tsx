'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { getPortalDashboardData, type AmbassadorDashboardMetrics } from '../actions';
import { formatCurrency } from '@/utils/format';
import { toast } from 'sonner';
import Link from 'next/link';
import { InstallAppButton } from '@/components/pwa/InstallAppButton';

export default function EmbaixadorDashboardPage() {
  const [data, setData] = useState<AmbassadorDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPortalDashboardData();
      setData(res);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar os dados do painel.');
      toast.error('Erro ao carregar o painel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '36px', animation: 'spin 1s linear infinite' }}>sync</span>
          <p style={{ marginTop: '12px', fontSize: '15px' }}>Carregando seu painel...</p>
        </div>
      </MainLayout>
    );
  }

  if (error || !data) {
    return (
      <MainLayout>
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--color-surface-container-low)', borderRadius: '16px', border: '1px solid var(--color-outline-variant)', maxWidth: '500px', margin: '40px auto' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-error)' }}>error</span>
          <h2 style={{ fontSize: '18px', margin: '16px 0 8px', color: 'var(--color-on-surface)' }}>Ocorreu um problema</h2>
          <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginBottom: '24px' }}>{error}</p>
          <button
            onClick={loadData}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Tentar Novamente
          </button>
        </div>
      </MainLayout>
    );
  }

  const {
    referral_code,
    display_name,
    vendas_mes_qtd,
    vendas_mes_valor,
    comissao_aguardando,
    comissao_disponivel,
    total_recebido,
    first_purchase_bonus_total,
    clientes_indicados,
    grafico_mensal
  } = data;

  // Calcular valor máximo para escala do gráfico
  const maxGrafico = Math.max(...(grafico_mensal || []).map((g: any) => parseFloat(g.vendas_valor || 0)), 100);

  return (
    <MainLayout>
      <div style={{ maxWidth: '1200px', margin: '0 auto 40px' }}>
        
        {/* Banner de Boas-vindas */}
        <header style={{
          backgroundColor: 'var(--color-surface-container-low)',
          padding: '24px 28px',
          borderRadius: '20px',
          border: '1px solid var(--color-outline-variant)',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{ fontSize: '26px', fontFamily: 'var(--font-headline)', fontWeight: 700, margin: 0, color: 'var(--color-on-surface)' }}>
              Olá, <span style={{ color: 'var(--color-primary)' }}>{display_name || 'Embaixador'}</span>! 👋
            </h1>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px', margin: 0 }}>
              Acompanhe suas vendas, comissões e desempenho do mês.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: '0 1 auto' }}>
            <InstallAppButton />
            <Link href="/embaixador/meu-link" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '14px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>link</span>
              Meu Link & QR Code
            </Link>
          </div>
        </header>

        {/* Card Principal: Comissão Disponível */}
        <div style={{
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
          padding: '24px 28px',
          borderRadius: '20px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(0, 86, 117, 0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Elemento decorativo de fundo */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            pointerEvents: 'none'
          }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary-container)' }}>account_balance_wallet</span>
            <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary-container)' }}>
              Comissão Disponível
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', zIndex: 1 }}>
            <span style={{ fontSize: '20px', fontWeight: 600 }}>R$</span>
            <span style={{ fontSize: '42px', fontWeight: 800, lineHeight: 1 }}>{formatCurrency(comissao_disponivel).replace('R$', '').trim()}</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-primary-container)', zIndex: 1 }}>Liberado para saque imediato</span>
        </div>

        {/* Demais Métricas */}
        <div className="summary-cards-grid">
          <div className="summary-card">
            <div className="summary-card-icon-wrapper" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined">shopping_bag</span>
            </div>
            <div className="summary-card-content">
              <p className="summary-card-label">Vendas no Mês</p>
              <p className="summary-card-value">{vendas_mes_qtd}</p>
              <p className="summary-card-sub">Pedidos aprovados</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon-wrapper" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined">attach_money</span>
            </div>
            <div className="summary-card-content">
              <p className="summary-card-label">Valor Vendido</p>
              <p className="summary-card-value">{formatCurrency(vendas_mes_valor)}</p>
              <p className="summary-card-sub">Neste mês</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon-wrapper" style={{ backgroundColor: 'rgba(164, 114, 0, 0.1)', color: '#a47200' }}>
              <span className="material-symbols-outlined">schedule</span>
            </div>
            <div className="summary-card-content">
              <p className="summary-card-label" style={{ color: '#a47200' }}>Aguardando</p>
              <p className="summary-card-value">{formatCurrency(comissao_aguardando)}</p>
              <p className="summary-card-sub">Comissão pendente</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon-wrapper" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined">payments</span>
            </div>
            <div className="summary-card-content">
              <p className="summary-card-label">Total Recebido</p>
              <p className="summary-card-value">{formatCurrency(total_recebido)}</p>
              <p className="summary-card-sub">Saques efetuados</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon-wrapper" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined">redeem</span>
            </div>
            <div className="summary-card-content">
              <p className="summary-card-label">Bônus Acum.</p>
              <p className="summary-card-value">{formatCurrency(first_purchase_bonus_total ?? 0)}</p>
              <p className="summary-card-sub">Primeira compra</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon-wrapper" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined">group_add</span>
            </div>
            <div className="summary-card-content">
              <p className="summary-card-label">Clientes Ind.</p>
              <p className="summary-card-value">{clientes_indicados}</p>
              <p className="summary-card-sub">Total acumulado</p>
            </div>
          </div>
        </div>

        {/* Gráfico Mensal em SVG/CSS Responsivo */}
        <div style={{
          backgroundColor: 'var(--color-surface-container-low)',
          padding: '28px',
          borderRadius: '20px',
          border: '1px solid var(--color-outline-variant)',
          marginBottom: '32px'
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
            Evolução dos Últimos 6 Meses
          </h3>

          <div style={{ display: 'flex', alignItems: 'flex-end', height: '180px', gap: '16px', padding: '10px 0 0', borderBottom: '1px solid var(--color-outline-variant)' }}>
            {(grafico_mensal || []).map((g: any, idx: number) => {
              const valor = parseFloat(g.vendas_valor || 0);
              const heightPct = Math.max(Math.min((valor / maxGrafico) * 100, 100), 8);
              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '6px' }}>
                    {formatCurrency(valor)}
                  </div>
                  <div style={{
                    width: '100%',
                    maxWidth: '40px',
                    height: `${heightPct}%`,
                    backgroundColor: 'var(--color-primary)',
                    borderRadius: '8px 8px 0 0',
                    transition: 'height 0.3s ease'
                  }} />
                  <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '8px', fontWeight: 600 }}>
                    {g.mes}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Atalhos Rápidos para Listas do Portal */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          <Link href="/embaixador/vendas" style={{
            backgroundColor: 'var(--color-surface-container-low)',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid var(--color-outline-variant)',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)' }}>Minhas Vendas</h4>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>Ver histórico completo de pedidos e comissões</p>
            </div>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>arrow_forward</span>
          </Link>

          <Link href="/embaixador/indicacoes" style={{
            backgroundColor: 'var(--color-surface-container-low)',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid var(--color-outline-variant)',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)' }}>Minhas Indicações</h4>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>Acompanhar novos clientes atribuídos</p>
            </div>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>arrow_forward</span>
          </Link>

          <Link href="/embaixador/pagamentos" style={{
            backgroundColor: 'var(--color-surface-container-low)',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid var(--color-outline-variant)',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)' }}>Meus Pagamentos</h4>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>Visualizar saques e comprovantes Pix</p>
            </div>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>arrow_forward</span>
          </Link>
        </div>

      </div>
    </MainLayout>
  );
}
