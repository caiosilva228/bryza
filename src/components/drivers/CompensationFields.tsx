'use client';
import type { DriverCompensationModel } from '@/models/types';
import { COMPENSATION_MODEL_LABELS } from '@/utils/formatDriverCompensation';
import { parseMoney } from '@/utils/formatDriverCompensation';

interface CompensationFieldsProps {
  model: DriverCompensationModel;
  amountPerDelivery: string;
  amountPerRoute: string;
  dailyAmount: string;
  payFailedAttempt: boolean;
  amountPerFailedAttempt: string;
  onModelChange: (m: DriverCompensationModel) => void;
  onAmountPerDeliveryChange: (v: string) => void;
  onAmountPerRouteChange: (v: string) => void;
  onDailyAmountChange: (v: string) => void;
  onPayFailedAttemptChange: (v: boolean) => void;
  onAmountPerFailedAttemptChange: (v: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid var(--color-outline-variant)',
  backgroundColor: 'var(--color-surface)', fontSize: '13px',
  fontFamily: 'var(--font-body)', color: 'var(--color-on-surface)', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px',
  color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em',
};

export default function CompensationFields({
  model, amountPerDelivery, amountPerRoute, dailyAmount,
  payFailedAttempt, amountPerFailedAttempt,
  onModelChange, onAmountPerDeliveryChange, onAmountPerRouteChange,
  onDailyAmountChange, onPayFailedAttemptChange, onAmountPerFailedAttemptChange,
}: CompensationFieldsProps) {
  const showDelivery = model === 'per_delivery' || model === 'per_delivery_plus_route';
  const showRoute    = model === 'per_route'    || model === 'per_delivery_plus_route';
  const showDaily    = model === 'daily';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Modelo */}
      <div>
        <label style={labelStyle}>Modelo de remuneração <span style={{ color: 'var(--color-error)' }}>*</span></label>
        <select value={model} onChange={e => onModelChange(e.target.value as DriverCompensationModel)} style={inputStyle}>
          {(Object.entries(COMPENSATION_MODEL_LABELS) as [DriverCompensationModel, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Valor por entrega */}
      {showDelivery && (
        <div>
          <label style={labelStyle}>Valor por entrega concluída <span style={{ color: 'var(--color-error)' }}>*</span></label>
          <input
            type="number" min="0" step="0.01"
            value={amountPerDelivery}
            onChange={e => onAmountPerDeliveryChange(e.target.value)}
            placeholder="0,00" style={inputStyle}
          />
        </div>
      )}

      {/* Valor por rota */}
      {showRoute && (
        <div>
          <label style={labelStyle}>
            {model === 'per_delivery_plus_route' ? 'Valor fixo por rota' : 'Valor por rota concluída'}
            <span style={{ color: 'var(--color-error)' }}> *</span>
          </label>
          <input
            type="number" min="0" step="0.01"
            value={amountPerRoute}
            onChange={e => onAmountPerRouteChange(e.target.value)}
            placeholder="0,00" style={inputStyle}
          />
        </div>
      )}

      {/* Diária */}
      {showDaily && (
        <div>
          <label style={labelStyle}>Valor da diária <span style={{ color: 'var(--color-error)' }}>*</span></label>
          <input
            type="number" min="0" step="0.01"
            value={dailyAmount}
            onChange={e => onDailyAmountChange(e.target.value)}
            placeholder="0,00" style={inputStyle}
          />
        </div>
      )}

      {/* Pagar tentativa */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderRadius: '10px',
        backgroundColor: 'var(--color-surface-container)',
        border: '1px solid var(--color-outline-variant)',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Pagar tentativa não concluída</p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
            Remunerar mesmo que a entrega não seja efetuada
          </p>
        </div>
        <button
          type="button"
          onClick={() => onPayFailedAttemptChange(!payFailedAttempt)}
          style={{
            width: '44px', height: '24px', borderRadius: '12px', border: 'none',
            backgroundColor: payFailedAttempt ? 'var(--color-primary)' : 'var(--color-outline-variant)',
            cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s',
            flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: '2px',
            left: payFailedAttempt ? '22px' : '2px',
            width: '20px', height: '20px', borderRadius: '50%',
            backgroundColor: '#fff', transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* Valor por tentativa */}
      {payFailedAttempt && (
        <div>
          <label style={labelStyle}>Valor por tentativa <span style={{ color: 'var(--color-error)' }}>*</span></label>
          <input
            type="number" min="0" step="0.01"
            value={amountPerFailedAttempt}
            onChange={e => onAmountPerFailedAttemptChange(e.target.value)}
            placeholder="0,00" style={inputStyle}
          />
        </div>
      )}
    </div>
  );
}

// Exporta o parser para ser reutilizado
export { parseMoney };
