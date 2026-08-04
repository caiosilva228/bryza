'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  getSchedulingControlAction,
  updateSchedulingControlAction,
  SchedulingControlInput,
} from './actions';
import { SchedulingCapacityDay, SchedulingControlSettings } from '@/lib/store-kits/scheduling-control';

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--color-outline-variant)',
  borderRadius: '16px',
  backgroundColor: 'var(--color-surface-container-lowest)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '42px',
  padding: '10px 12px',
  border: '1px solid var(--color-outline-variant)',
  borderRadius: '10px',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-on-surface)',
  fontSize: '14px',
  boxSizing: 'border-box',
};

interface FormState {
  automatico_ativo: boolean;
  mesmo_dia_ativo: boolean;
  antecedencia_mesmo_dia_horas: string;
  limite_pedidos_dia: string;
}

function getFormState(settings: SchedulingControlSettings): FormState {
  return {
    automatico_ativo: settings.automatico_ativo,
    mesmo_dia_ativo: settings.mesmo_dia_ativo,
    antecedencia_mesmo_dia_horas: String(settings.antecedencia_mesmo_dia_horas),
    limite_pedidos_dia: settings.limite_pedidos_dia === null ? '' : String(settings.limite_pedidos_dia),
  };
}

function ToggleRow({
  checked,
  onChange,
  title,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.65 : 1 }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: '#009845' }}
      />
      <span>
        <strong style={{ display: 'block', fontSize: '14px', color: 'var(--color-on-surface)' }}>{title}</strong>
        <span style={{ display: 'block', marginTop: '3px', fontSize: '12px', lineHeight: 1.45, color: 'var(--color-outline)' }}>{description}</span>
      </span>
    </label>
  );
}

function CapacityCard({ day, limit }: { day: SchedulingCapacityDay; limit: number | null }) {
  const full = limit !== null && day.quantidade >= limit;
  return (
    <div style={{ ...cardStyle, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div>
          <strong style={{ display: 'block', fontSize: '14px', color: 'var(--color-on-surface)' }}>{day.label}</strong>
          <span style={{ display: 'block', marginTop: '3px', fontSize: '12px', color: 'var(--color-outline)' }}>
            {day.quantidade} pedido(s) recebido(s)
          </span>
        </div>
        <span style={{
          padding: '4px 8px',
          borderRadius: '999px',
          backgroundColor: full ? '#fee2e2' : day.disponivel ? '#dcfce7' : '#fef3c7',
          color: full ? '#991b1b' : day.disponivel ? '#166534' : '#92400e',
          fontSize: '11px',
          fontWeight: 800,
          whiteSpace: 'nowrap',
        }}>
          {full ? 'Lotado' : day.disponivel ? 'Disponível' : 'Indisponível'}
        </span>
      </div>
      <div style={{ height: '8px', borderRadius: '999px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: limit === null ? '8%' : `${Math.min((day.quantidade / Math.max(limit, 1)) * 100, 100)}%`,
          borderRadius: '999px',
          backgroundColor: full ? '#ef4444' : '#009845',
          transition: 'width 0.2s ease',
        }} />
      </div>
      <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
        {day.restante === null ? 'Sem limite diário configurado' : `${day.restante} vaga(s) restante(s)`}
      </span>
    </div>
  );
}

export default function AgendamentoControlePanel() {
  const [settings, setSettings] = useState<SchedulingControlSettings | null>(null);
  const [days, setDays] = useState<SchedulingCapacityDay[]>([]);
  const [form, setForm] = useState<FormState>({
    automatico_ativo: true,
    mesmo_dia_ativo: false,
    antecedencia_mesmo_dia_horas: '3',
    limite_pedidos_dia: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadControl = async () => {
    setLoading(true);
    const result = await getSchedulingControlAction();
    if (!result.success || !result.data) {
      toast.error(result.error || 'Não foi possível carregar o controle de agendamento.');
    } else {
      setSettings(result.data);
      setForm(getFormState(result.data));
      setDays(result.dias || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadControl();
  }, []);

  const today = useMemo(() => days.find(day => day.hoje), [days]);
  const limit = settings?.limite_pedidos_dia ?? null;

  const handleSave = async () => {
    const parsedLimit = form.limite_pedidos_dia.trim() === '' ? null : Number(form.limite_pedidos_dia);
    const input: SchedulingControlInput = {
      automatico_ativo: form.automatico_ativo,
      mesmo_dia_ativo: form.mesmo_dia_ativo,
      antecedencia_mesmo_dia_horas: Number(form.antecedencia_mesmo_dia_horas),
      limite_pedidos_dia: parsedLimit,
    };

    setSaving(true);
    const result = await updateSchedulingControlAction(input);
    if (!result.success || !result.data) {
      toast.error(result.error || 'Não foi possível salvar o controle de agendamento.');
    } else {
      setSettings(result.data);
      setForm(getFormState(result.data));
      setDays(result.dias || []);
      toast.success('Controle de agendamento atualizado.');
    }
    setSaving(false);
  };

  if (loading && !settings) {
    return (
      <div style={{ padding: '24px 32px', color: 'var(--color-outline)', fontSize: '14px' }}>
        Carregando controle de agendamento...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: 'var(--color-surface)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--color-on-surface)' }}>
            Controle de <span style={{ color: 'var(--color-primary)' }}>Agendamento</span>
          </h1>
          <p style={{ margin: '5px 0 0', maxWidth: '680px', fontSize: '14px', lineHeight: 1.5, color: 'var(--color-outline)' }}>
            Defina quando a loja aceita pedidos, controle a capacidade diária e libere entregas no mesmo dia sem perder a validação automática.
          </p>
        </div>
        <button
          type="button"
          onClick={loadControl}
          disabled={loading || saving}
          style={{ padding: '10px 15px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container-low)', color: 'var(--color-on-surface)', fontWeight: 700, cursor: loading || saving ? 'wait' : 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '17px', verticalAlign: 'middle', marginRight: '6px' }}>sync</span>
          Atualizar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ ...cardStyle, padding: '18px' }}>
          <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-outline)' }}>Pedidos hoje</span>
          <strong style={{ display: 'block', marginTop: '6px', fontSize: '28px', color: 'var(--color-on-surface)' }}>{today?.quantidade ?? 0}</strong>
          <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>{today?.restante === null || today?.restante === undefined ? 'Sem limite' : `${today.restante} vaga(s) restante(s)`}</span>
        </div>
        <div style={{ ...cardStyle, padding: '18px' }}>
          <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-outline)' }}>Limite diário</span>
          <strong style={{ display: 'block', marginTop: '6px', fontSize: '28px', color: 'var(--color-on-surface)' }}>{limit ?? '∞'}</strong>
          <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>{limit === null ? 'Pedidos ilimitados' : 'Inclui pedidos online ativos'}</span>
        </div>
        <div style={{ ...cardStyle, padding: '18px' }}>
          <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-outline)' }}>Mesmo dia</span>
          <strong style={{ display: 'block', marginTop: '6px', fontSize: '20px', color: form.mesmo_dia_ativo ? '#009845' : '#64748b' }}>{form.mesmo_dia_ativo ? `Até ${form.antecedencia_mesmo_dia_horas}h` : 'Desativado'}</strong>
          <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>Disponibilidade calculada em tempo real</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(300px, 0.9fr)', gap: '18px', alignItems: 'start' }}>
        <section style={{ ...cardStyle, padding: '22px' }}>
          <div style={{ marginBottom: '18px' }}>
            <h2 style={{ margin: 0, fontSize: '17px', color: 'var(--color-on-surface)' }}>Regras da loja virtual</h2>
            <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--color-outline)' }}>Essas regras também são conferidas pelo servidor no fechamento do pedido.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <ToggleRow
              checked={form.automatico_ativo}
              onChange={checked => setForm(current => ({ ...current, automatico_ativo: checked }))}
              title="Aceitar agendamentos automáticos"
              description="Quando desligado, a loja informa que os pedidos online estão pausados. O controle manual do painel continua disponível."
            />
            <ToggleRow
              checked={form.mesmo_dia_ativo}
              onChange={checked => setForm(current => ({ ...current, mesmo_dia_ativo: checked }))}
              title="Permitir entrega no mesmo dia"
              description="Exibe “Hoje” no checkout somente enquanto ainda houver tempo para cumprir a janela configurada."
              disabled={!form.automatico_ativo}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)' }}>
                Antecedência do mesmo dia (horas)
                <input
                  type="number"
                  min={1}
                  max={24}
                  step={1}
                  value={form.antecedencia_mesmo_dia_horas}
                  onChange={event => setForm(current => ({ ...current, antecedencia_mesmo_dia_horas: event.target.value }))}
                  style={{ ...inputStyle, marginTop: '6px' }}
                />
                <span style={{ display: 'block', marginTop: '4px', fontWeight: 400 }}>Padrão: 3 horas.</span>
              </label>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)' }}>
                Quantidade máxima por dia
                <input
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  value={form.limite_pedidos_dia}
                  onChange={event => setForm(current => ({ ...current, limite_pedidos_dia: event.target.value }))}
                  placeholder="Sem limite"
                  style={{ ...inputStyle, marginTop: '6px' }}
                />
                <span style={{ display: 'block', marginTop: '4px', fontWeight: 400 }}>Deixe vazio para aceitar pedidos sem limite.</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--color-outline-variant)' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '12px 20px', border: 'none', borderRadius: '10px', backgroundColor: '#009845', color: '#ffffff', fontWeight: 800, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Salvando...' : 'Salvar regras'}
            </button>
          </div>
          {settings?.updated_at && (
            <p style={{ margin: '12px 0 0', textAlign: 'right', fontSize: '11px', color: 'var(--color-outline)' }}>
              Última atualização: {new Date(settings.updated_at).toLocaleString('pt-BR')}
            </p>
          )}
        </section>

        <section style={{ ...cardStyle, padding: '22px', backgroundColor: '#f8fafc' }}>
          <h2 style={{ margin: 0, fontSize: '17px', color: 'var(--color-on-surface)' }}>Como funciona</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
            <div style={{ display: 'flex', gap: '10px' }}><span style={{ color: '#009845', fontWeight: 900 }}>1.</span><span style={{ fontSize: '13px', lineHeight: 1.5, color: '#475569' }}>O cliente vê apenas datas que ainda têm capacidade.</span></div>
            <div style={{ display: 'flex', gap: '10px' }}><span style={{ color: '#009845', fontWeight: 900 }}>2.</span><span style={{ fontSize: '13px', lineHeight: 1.5, color: '#475569' }}>Pedidos cancelados liberam a vaga automaticamente.</span></div>
            <div style={{ display: 'flex', gap: '10px' }}><span style={{ color: '#009845', fontWeight: 900 }}>3.</span><span style={{ fontSize: '13px', lineHeight: 1.5, color: '#475569' }}>Na confirmação, o banco trava a configuração e valida o limite novamente.</span></div>
            <div style={{ display: 'flex', gap: '10px' }}><span style={{ color: '#009845', fontWeight: 900 }}>4.</span><span style={{ fontSize: '13px', lineHeight: 1.5, color: '#475569' }}>Agendamentos manuais feitos pela equipe continuam sendo um override operacional.</span></div>
          </div>
        </section>
      </div>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', color: 'var(--color-on-surface)' }}>Capacidade dos próximos dias</h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-outline)' }}>Pedidos convertidos também ocupam capacidade; cancelamentos não ocupam.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {days.map(day => <CapacityCard key={day.value} day={day} limit={limit} />)}
        </div>
      </section>
    </div>
  );
}
