'use client';

import { formatCurrency } from '@/utils/format';

interface MetaCardProps {
  metaMensal: number;
  faturamentoMes: number;
  diasUteisRestantes: number;
  diasUteisTotal: number;
}

export function MetaCard({ metaMensal, faturamentoMes, diasUteisRestantes, diasUteisTotal }: MetaCardProps) {
  if (metaMensal <= 0) return null;

  const valorRestante = Math.max(metaMensal - faturamentoMes, 0);
  const percentual = Math.min((faturamentoMes / metaMensal) * 100, 100);
  const porDiaUtil = diasUteisRestantes > 0 ? valorRestante / diasUteisRestantes : 0;
  const diasPassados = diasUteisTotal - diasUteisRestantes;
  const atingida = faturamentoMes >= metaMensal;

  const corBarra = atingida
    ? 'var(--color-tertiary)'
    : percentual >= 70
    ? 'var(--color-primary)'
    : percentual >= 40
    ? '#f59e0b'
    : 'var(--color-error)';

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-outline-variant)',
      borderRadius: '16px',
      padding: '24px 28px',
      marginBottom: '32px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '22px', color: 'var(--color-primary)' }}
          >
            flag
          </span>
          <span style={{
            fontSize: '13px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-on-surface)',
          }}>
            Meta do Mês
          </span>
        </div>

        {atingida && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(0,150,80,0.10)',
            color: '#00863e',
            borderRadius: '32px',
            padding: '4px 14px',
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
            Meta atingida!
          </div>
        )}
      </div>

      {/* Valores principais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '24px', marginBottom: '20px' }}>
        {/* Faturamento atual */}
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', letterSpacing: '0.06em' }}>
            Faturado no Mês
          </p>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'var(--color-on-surface)', letterSpacing: '-0.03em' }}>
            {formatCurrency(faturamentoMes)}
          </p>
        </div>

        {/* Meta total */}
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', letterSpacing: '0.06em' }}>
            Meta Total
          </p>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'var(--color-on-surface)', letterSpacing: '-0.03em' }}>
            {formatCurrency(metaMensal)}
          </p>
        </div>

        {/* Falta */}
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', letterSpacing: '0.06em' }}>
            {atingida ? 'Excedente' : 'Falta Atingir'}
          </p>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: atingida ? '#00863e' : 'var(--color-error)', letterSpacing: '-0.03em' }}>
            {formatCurrency(atingida ? faturamentoMes - metaMensal : valorRestante)}
          </p>
        </div>

        {/* Por dia útil */}
        {!atingida && (
          <div style={{
            backgroundColor: 'var(--color-surface-container)',
            borderRadius: '12px',
            padding: '14px 18px',
            borderLeft: `4px solid ${corBarra}`,
          }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', letterSpacing: '0.06em' }}>
              Necessário / Dia Útil
            </p>
            <p style={{ margin: '0 0 2px', fontSize: '22px', fontWeight: 900, color: corBarra, letterSpacing: '-0.02em' }}>
              {formatCurrency(porDiaUtil)}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-outline)' }}>
              {diasUteisRestantes} dias úteis restantes (de {diasUteisTotal})
            </p>
          </div>
        )}
      </div>

      {/* Barra de progresso */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-outline)', fontWeight: 600 }}>
            {diasPassados} dias úteis passados
          </span>
          <span style={{ fontSize: '12px', fontWeight: 800, color: corBarra }}>
            {percentual.toFixed(1)}%
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '10px',
          backgroundColor: 'var(--color-surface-container-highest)',
          borderRadius: '99px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${percentual}%`,
            backgroundColor: corBarra,
            borderRadius: '99px',
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>
    </div>
  );
}
