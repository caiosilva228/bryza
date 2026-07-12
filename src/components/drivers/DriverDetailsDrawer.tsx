'use client';
import { useState } from 'react';
import type { Driver, DriverRouteCompensation } from '@/models/types';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/format';
import {
  VEHICLE_TYPE_LABELS, DRIVER_STATUS_LABELS, COMPENSATION_MODEL_LABELS,
  formatCompensationRule, formatPhone, openWhatsApp,
} from '@/utils/formatDriverCompensation';
import type { DriverRouteSummary } from '@/services/driversService';
import CompensationStatusBadge from './CompensationStatusBadge';

type Tab = 'dados' | 'rotas' | 'financeiro';

interface Props {
  open: boolean;
  driver: Driver | null;
  routes: DriverRouteSummary[];
  compensations: DriverRouteCompensation[];
  onClose: () => void;
  onEdit: (driver: Driver) => void;
  onToggleStatus: (driver: Driver) => void;
  onAdjust: (comp: DriverRouteCompensation) => void;
  onApprove: (comp: DriverRouteCompensation) => void;
  onPay: (comp: DriverRouteCompensation) => void;
  loadingRoutes?: boolean;
  loadingComps?: boolean;
}

export default function DriverDetailsDrawer({
  open, driver, routes, compensations,
  onClose, onEdit, onToggleStatus, onAdjust, onApprove, onPay,
  loadingRoutes, loadingComps,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('dados');

  if (!open || !driver) return null;

  const totalPago      = compensations.filter(c => c.status === 'paid').reduce((s, c) => s + c.final_amount, 0);
  const totalEmAberto  = compensations.filter(c => c.status === 'open').reduce((s, c) => s + c.final_amount, 0);
  const totalAprovado  = compensations.filter(c => c.status === 'approved').reduce((s, c) => s + c.final_amount, 0);

  const tabStyle = (t: Tab): React.CSSProperties => ({
    flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontWeight: 700, fontSize: '13px', transition: 'all 0.15s',
    backgroundColor: activeTab === t ? 'var(--color-primary)' : 'transparent',
    color: activeTab === t ? '#fff' : 'var(--color-on-surface-variant)',
  });

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1500, backgroundColor: 'rgba(0,0,0,0.4)' }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1600,
        width: '100%', maxWidth: '520px',
        backgroundColor: 'var(--color-surface)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          backgroundColor: 'var(--color-surface-container)',
        }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#fff' }}>directions_car</span>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900 }}>{driver.full_name}</h2>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                {formatPhone(driver.phone)}
                {driver.city && ` · ${driver.city}`}
              </p>
              <span style={{
                display: 'inline-block', marginTop: '6px',
                padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                backgroundColor: driver.status === 'active' ? '#DCFCE7' : '#F3F4F6',
                color: driver.status === 'active' ? '#166534' : '#6B7280',
              }}>
                {DRIVER_STATUS_LABELS[driver.status]}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => openWhatsApp(driver.phone)} title="WhatsApp" style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', cursor: 'pointer', display: 'flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22C55E' }}>chat</span>
            </button>
            <button onClick={() => onEdit(driver)} title="Editar" style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface)', cursor: 'pointer', display: 'flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>edit</span>
            </button>
            <button onClick={onClose} style={{ padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: 'var(--color-on-surface-variant)' }}>close</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container)' }}>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-outline-variant)', padding: '4px', borderRadius: '10px' }}>
            {(['dados', 'rotas', 'financeiro'] as Tab[]).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={tabStyle(t)}>
                {t === 'dados' ? 'Dados' : t === 'rotas' ? 'Rotas' : 'Financeiro'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── ABA DADOS ──────────────────────────────────────────────────── */}
          {activeTab === 'dados' && (
            <>
              <Section title="Informações">
                <InfoRow icon="phone" label="Telefone" value={formatPhone(driver.phone)} />
                {driver.city && <InfoRow icon="location_on" label="Cidade" value={driver.city} />}
              </Section>

              {(driver.vehicle_type || driver.vehicle_model || driver.vehicle_plate) && (
                <Section title="Veículo">
                  {driver.vehicle_type && (
                    <InfoRow icon="directions_car" label="Tipo" value={VEHICLE_TYPE_LABELS[driver.vehicle_type] || driver.vehicle_type} />
                  )}
                  {driver.vehicle_model && <InfoRow icon="build" label="Modelo" value={driver.vehicle_model} />}
                  {driver.vehicle_plate && <InfoRow icon="confirmation_number" label="Placa" value={driver.vehicle_plate} />}
                </Section>
              )}

              <Section title="Remuneração Padrão">
                <InfoRow
                  icon="payments"
                  label="Modelo"
                  value={COMPENSATION_MODEL_LABELS[driver.compensation_model]}
                />
                <InfoRow icon="calculate" label="Regra" value={formatCompensationRule(driver)} />
              </Section>

              {driver.notes && (
                <Section title="Observações">
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-on-surface)', lineHeight: 1.5 }}>{driver.notes}</p>
                </Section>
              )}

              <button
                onClick={() => onToggleStatus(driver)}
                style={{
                  padding: '12px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 700,
                  color: driver.status === 'active' ? 'var(--color-error, #EF4444)' : '#22C55E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  fontSize: '13px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {driver.status === 'active' ? 'person_off' : 'person_check'}
                </span>
                {driver.status === 'active' ? 'Inativar motorista' : 'Ativar motorista'}
              </button>
            </>
          )}

          {/* ── ABA ROTAS ──────────────────────────────────────────────────── */}
          {activeTab === 'rotas' && (
            <>
              {loadingRoutes ? (
                <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px', textAlign: 'center' }}>Carregando rotas...</p>
              ) : routes.length === 0 ? (
                <EmptyState icon="map" text="Nenhuma rota encontrada para este motorista." />
              ) : routes.map(r => (
                <div key={r.id} style={{
                  padding: '14px 16px', borderRadius: '12px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{r.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                        {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <RouteStatusBadge status={r.status} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <Metric label="Total" value={r.total_orders.toString()} />
                    <Metric label="Entregues" value={r.completed_deliveries.toString()} color="#22C55E" />
                    {r.failed_attempts > 0 && <Metric label="Tentativas" value={r.failed_attempts.toString()} color="#F59E0B" />}
                  </div>
                  {r.compensation && (
                    <div style={{
                      marginTop: '10px', padding: '10px', borderRadius: '8px',
                      backgroundColor: 'var(--color-surface-container)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <CompensationStatusBadge status={r.compensation.status} />
                      <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-primary)' }}>
                        {formatCurrency(r.compensation.final_amount)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* ── ABA FINANCEIRO ─────────────────────────────────────────────── */}
          {activeTab === 'financeiro' && (
            <>
              {/* Resumo Financeiro */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <StatCard label="Em Aberto" value={formatCurrency(totalEmAberto)} color="#D97706" bg="#FEF3C7" />
                <StatCard label="Aprovado" value={formatCurrency(totalAprovado)} color="#1D4ED8" bg="#DBEAFE" />
                <StatCard label="Pago" value={formatCurrency(totalPago)} color="#166534" bg="#DCFCE7" />
              </div>

              {/* Lista de remunerações */}
              {loadingComps ? (
                <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px', textAlign: 'center' }}>Carregando remunerações...</p>
              ) : compensations.length === 0 ? (
                <EmptyState icon="payments" text="Nenhuma remuneração registrada ainda." />
              ) : compensations.map(comp => (
                <div key={comp.id} style={{
                  padding: '14px 16px', borderRadius: '12px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface)',
                  display: 'flex', flexDirection: 'column', gap: '10px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>{comp.route_name || `Rota ${comp.route_id.slice(0, 8)}`}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                        {comp.route_date ? new Date(comp.route_date + 'T12:00:00').toLocaleDateString('pt-BR') : formatDate(comp.created_at)}
                      </p>
                    </div>
                    <CompensationStatusBadge status={comp.status} />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                    <span>{comp.completed_deliveries} entrega(s)</span>
                    {comp.paid_failed_attempts > 0 && <span>{comp.paid_failed_attempts} tentativa(s)</span>}
                    {comp.manual_adjustment !== 0 && (
                      <span style={{ color: comp.manual_adjustment > 0 ? '#22C55E' : '#EF4444' }}>
                        ajuste: {comp.manual_adjustment > 0 ? '+' : ''}{formatCurrency(comp.manual_adjustment)}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--color-primary)' }}>
                      {formatCurrency(comp.final_amount)}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {comp.status === 'open' && (
                        <>
                          <ActionBtn onClick={() => onAdjust(comp)} icon="tune" label="Ajustar" color="var(--color-primary)" />
                          <ActionBtn onClick={() => onApprove(comp)} icon="verified" label="Aprovar" color="#1D4ED8" filled />
                        </>
                      )}
                      {comp.status === 'approved' && (
                        <ActionBtn onClick={() => onPay(comp)} icon="payments" label="Pagar" color="#166534" filled />
                      )}
                    </div>
                  </div>

                  {comp.paid_at && (
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                      Pago em {formatDate(comp.paid_at)}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '16px', borderRadius: '12px',
      backgroundColor: 'var(--color-surface-container)',
      border: '1px solid var(--color-outline-variant)',
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-primary)' }}>{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-on-surface-variant)', flexShrink: 0 }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>{label}</p>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface)' }}>{value}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '10px', color: 'var(--color-on-surface-variant)', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: color || 'var(--color-on-surface)' }}>{value}</p>
    </div>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{
      padding: '12px', borderRadius: '10px', backgroundColor: bg,
      textAlign: 'center',
    }}>
      <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: 900, color }}>{value}</p>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-outline)', display: 'block', marginBottom: '8px' }}>{icon}</span>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>{text}</p>
    </div>
  );
}

function RouteStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    'Finalizada':                { bg: '#DCFCE7', color: '#166534' },
    'Finalizada com Pendências': { bg: '#FEF3C7', color: '#92400E' },
    'Em Andamento':              { bg: '#DBEAFE', color: '#1D4ED8' },
    'Cancelada':                 { bg: '#FEE2E2', color: '#991B1B' },
  };
  const c = colors[status] || { bg: '#F3F4F6', color: '#6B7280' };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '20px',
      fontSize: '10px', fontWeight: 700,
      backgroundColor: c.bg, color: c.color,
    }}>{status}</span>
  );
}

function ActionBtn({
  onClick, icon, label, color, filled,
}: { onClick: () => void; icon: string; label: string; color: string; filled?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        padding: '7px 12px', borderRadius: '8px',
        border: `1px solid ${color}`,
        backgroundColor: filled ? color : 'transparent',
        color: filled ? '#fff' : color,
        cursor: 'pointer', fontSize: '12px', fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: '4px',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{icon}</span>
      {label}
    </button>
  );
}
