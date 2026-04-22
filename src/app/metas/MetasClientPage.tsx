'use client';

import { useState, useTransition } from 'react';
import { salvarMetaAction } from './actions';
import { formatCurrency } from '@/utils/format';
import { format, addMonths, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  periodoAtual: string;
  metaAtual: number;
  diasUteisTotal: number;
  diasUteisRestantes: number;
}

export function MetasClientPage({ periodoAtual, metaAtual, diasUteisTotal, diasUteisRestantes }: Props) {
  const [valor, setValor] = useState(metaAtual > 0 ? String(metaAtual) : '');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const periodoDate = parseISO(`${periodoAtual}-01`);
  const nomeMes = format(periodoDate, 'MMMM yyyy', { locale: ptBR });
  const metaParsed = parseFloat(valor.replace(',', '.')) || 0;
  const porDiaUtil = diasUteisRestantes > 0 ? metaParsed / diasUteisRestantes : 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      await salvarMetaAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    fontWeight: 600,
    borderRadius: '10px',
    border: '1px solid var(--color-outline-variant)',
    backgroundColor: 'var(--color-surface-container)',
    color: 'var(--color-on-surface)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div className="page-wrapper" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
            METAS <span style={{ color: 'var(--color-primary)' }}>DA EMPRESA</span>
          </h1>
          <p>Configure a meta de faturamento mensal. Ela aparecerá no dashboard com progresso em tempo real.</p>
        </div>
      </div>


      {/* Card de configuração */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-outline-variant)',
        borderRadius: '20px',
        padding: '32px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '24px' }}>
            flag
          </span>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Meta de Faturamento — {nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          <input type="hidden" name="periodo" value={periodoAtual} />

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-on-surface-variant)', marginBottom: '8px' }}>
              Valor da Meta (R$)
            </label>
            <input
              type="number"
              name="valor_meta"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="Ex: 50000"
              min="1"
              step="0.01"
              required
              style={inputStyle}
            />
          </div>

          {/* Preview */}
          {metaParsed > 0 && (
            <div style={{
              backgroundColor: 'var(--color-surface-container)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'var(--color-outline)', fontWeight: 600, textTransform: 'uppercase' }}>Meta total</p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'var(--color-on-surface)' }}>{formatCurrency(metaParsed)}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'var(--color-outline)', fontWeight: 600, textTransform: 'uppercase' }}>Necessário / Dia Útil*</p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'var(--color-primary)' }}>{formatCurrency(porDiaUtil)}</p>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-outline)', gridColumn: 'span 2' }}>
                * baseado nos {diasUteisRestantes} dias úteis restantes no mês (Seg–Sáb, excluindo feriados nacionais). Total no mês: {diasUteisTotal} dias úteis.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || !valor}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '13px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderRadius: '10px',
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
              backgroundColor: saved ? 'var(--color-tertiary)' : 'var(--color-primary)',
              color: '#fff',
              transition: 'background-color 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {saved ? 'check_circle' : isPending ? 'hourglass_empty' : 'save'}
            </span>
            {saved ? 'Meta Salva!' : isPending ? 'Salvando...' : 'Salvar Meta'}
          </button>
        </form>
      </div>

      {/* Card informativo de dias úteis */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-outline-variant)',
        borderRadius: '20px',
        padding: '24px 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)', fontSize: '22px' }}>
            calendar_month
          </span>
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Dias Úteis — {nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
          <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-container)', borderRadius: '12px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase' }}>Total no Mês</p>
            <p style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: 'var(--color-on-surface)' }}>{diasUteisTotal}</p>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-container)', borderRadius: '12px', border: '2px solid var(--color-primary)' }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>Restantes</p>
            <p style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: 'var(--color-primary)' }}>{diasUteisRestantes}</p>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-container)', borderRadius: '12px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase' }}>Passados</p>
            <p style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: 'var(--color-on-surface-variant)' }}>{diasUteisTotal - diasUteisRestantes}</p>
          </div>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: '11px', color: 'var(--color-outline)', textAlign: 'center' }}>
          Contagem: Segunda a Sábado, excluindo feriados nacionais brasileiros.
        </p>
      </div>
    </div>
  );
}
