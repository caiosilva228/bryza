'use client';
import { useState, useEffect } from 'react';
import type { Driver, DriverFormInput, DriverCompensationModel, VehicleType } from '@/models/types';
import { VEHICLE_TYPE_LABELS } from '@/utils/formatDriverCompensation';
import CompensationFields from './CompensationFields';
import { parseMoney } from '@/utils/formatDriverCompensation';

interface Props {
  open: boolean;
  driver?: Driver | null;
  onClose: () => void;
  onSubmit: (input: DriverFormInput) => Promise<void>;
  loading?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid var(--color-outline-variant)',
  backgroundColor: 'var(--color-surface)', fontSize: '13px',
  fontFamily: 'var(--font-body)', color: 'var(--color-on-surface)', outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 700,
  marginBottom: '6px', color: 'var(--color-on-surface-variant)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

const sectionStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '16px',
  padding: '20px', borderRadius: '12px',
  backgroundColor: 'var(--color-surface-container)',
  border: '1px solid var(--color-outline-variant)',
};

const row2: React.CSSProperties = { display: 'flex', gap: '12px', flexWrap: 'wrap' };
const col1: React.CSSProperties = { flex: 1, minWidth: '140px' };

export default function DriverFormModal({ open, driver, onClose, onSubmit, loading }: Props) {
  const isEdit = !!driver;

  // Dados Básicos
  const [fullName,     setFullName]     = useState('');
  const [phone,        setPhone]        = useState('');
  const [city,         setCity]         = useState('');
  const [notes,        setNotes]        = useState('');

  // Veículo
  const [vehicleType,  setVehicleType]  = useState<VehicleType | ''>('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  // Remuneração
  const [compModel,    setCompModel]    = useState<DriverCompensationModel>('per_delivery');
  const [amtDelivery,  setAmtDelivery]  = useState('');
  const [amtRoute,     setAmtRoute]     = useState('');
  const [amtDaily,     setAmtDaily]     = useState('');
  const [payFailed,    setPayFailed]    = useState(false);
  const [amtFailed,    setAmtFailed]    = useState('');

  useEffect(() => {
    if (driver) {
      setFullName(driver.full_name);
      setPhone(driver.phone);
      setCity(driver.city || '');
      setNotes(driver.notes || '');
      setVehicleType((driver.vehicle_type as VehicleType) || '');
      setVehicleModel(driver.vehicle_model || '');
      setVehiclePlate(driver.vehicle_plate || '');
      setCompModel(driver.compensation_model);
      setAmtDelivery(driver.amount_per_delivery?.toString() || '');
      setAmtRoute(driver.amount_per_route?.toString() || '');
      setAmtDaily(driver.daily_amount?.toString() || '');
      setPayFailed(driver.pay_failed_attempt);
      setAmtFailed(driver.amount_per_failed_attempt?.toString() || '');
    } else {
      setFullName(''); setPhone(''); setCity(''); setNotes('');
      setVehicleType(''); setVehicleModel(''); setVehiclePlate('');
      setCompModel('per_delivery');
      setAmtDelivery(''); setAmtRoute(''); setAmtDaily('');
      setPayFailed(false); setAmtFailed('');
    }
  }, [driver, open]);

  if (!open) return null;

  const canSubmit = fullName.trim() && phone.trim() && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const input: DriverFormInput = {
      full_name:                fullName,
      phone,
      city:                     city || undefined,
      vehicle_type:             (vehicleType as VehicleType) || null,
      vehicle_model:            vehicleModel || undefined,
      vehicle_plate:            vehiclePlate || undefined,
      status:                   driver?.status || 'active',
      notes:                    notes || undefined,
      compensation_model:       compModel,
      amount_per_delivery:      parseMoney(amtDelivery) || null,
      amount_per_route:         parseMoney(amtRoute) || null,
      daily_amount:             parseMoney(amtDaily) || null,
      pay_failed_attempt:       payFailed,
      amount_per_failed_attempt:payFailed ? parseMoney(amtFailed) || null : null,
    };
    await onSubmit(input);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '20px', width: '100%', maxWidth: '580px',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>
              {isEdit ? 'Editar Motorista' : 'Novo Motorista'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
              {isEdit ? 'Atualize os dados do motorista' : 'Preencha os dados para cadastrar'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'var(--color-on-surface-variant)' }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Dados Básicos */}
          <div style={sectionStyle}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)' }}>
              Dados do Motorista
            </p>
            <div>
              <label style={labelStyle}>Nome completo <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ex: João Silva" style={inputStyle} autoFocus />
            </div>
            <div style={row2}>
              <div style={col1}>
                <label style={labelStyle}>Telefone / WhatsApp <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(61) 9 9999-9999" style={inputStyle} />
              </div>
              <div style={col1}>
                <label style={labelStyle}>Cidade</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Ex: Brasília" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Observações</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Anotações sobre o motorista..." style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>

          {/* Veículo */}
          <div style={sectionStyle}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)' }}>
              Veículo
            </p>
            <div style={row2}>
              <div style={col1}>
                <label style={labelStyle}>Tipo de Veículo</label>
                <select value={vehicleType} onChange={e => setVehicleType(e.target.value as VehicleType | '')} style={inputStyle}>
                  <option value="">(Nenhum)</option>
                  {Object.entries(VEHICLE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div style={col1}>
                <label style={labelStyle}>Modelo</label>
                <input type="text" value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} placeholder="Ex: Honda CG 160" style={inputStyle} />
              </div>
            </div>
            <div style={{ flex: '0 1 120px' }}>
              <label style={labelStyle}>Placa</label>
              <input
                type="text" value={vehiclePlate}
                onChange={e => setVehiclePlate(e.target.value.toUpperCase())}
                placeholder="ABC-1234" style={inputStyle} maxLength={8}
              />
            </div>
          </div>

          {/* Remuneração */}
          <div style={sectionStyle}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)' }}>
              Modelo de Remuneração
            </p>
            <CompensationFields
              model={compModel}
              amountPerDelivery={amtDelivery}
              amountPerRoute={amtRoute}
              dailyAmount={amtDaily}
              payFailedAttempt={payFailed}
              amountPerFailedAttempt={amtFailed}
              onModelChange={setCompModel}
              onAmountPerDeliveryChange={setAmtDelivery}
              onAmountPerRouteChange={setAmtRoute}
              onDailyAmountChange={setAmtDaily}
              onPayFailedAttemptChange={setPayFailed}
              onAmountPerFailedAttemptChange={setAmtFailed}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--color-outline-variant)',
          display: 'flex', justifyContent: 'space-between', gap: '12px',
        }}>
          <button onClick={onClose} style={{
            padding: '12px 20px', borderRadius: '10px',
            backgroundColor: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)', fontWeight: 700, cursor: 'pointer',
            fontSize: '14px',
          }}>Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: '12px 24px', borderRadius: '10px',
              backgroundColor: canSubmit ? 'var(--color-primary)' : 'var(--color-outline)',
              color: '#fff', border: 'none', fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px',
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            {loading
              ? <span className="material-symbols-outlined" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>progress_activity</span>
              : <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
            }
            {isEdit ? 'Salvar alterações' : 'Cadastrar motorista'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
