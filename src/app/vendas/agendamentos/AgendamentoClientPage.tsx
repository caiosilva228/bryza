'use client';

import { useState, useMemo } from 'react';
import { Agendamento } from '@/models/types';
import {
  getAgendamentosAction,
  getAgendamentosByDateAction,
  converterAgendamentoAction,
  cancelarAgendamentoAction,
} from './actions';
import { formatCurrency } from '@/utils/format';
import { toast } from 'sonner';

// ── helpers ──────────────────────────────────────────────────────────────────
function isoToDateStr(iso: string) {
  return iso.slice(0, 10);
}

function padStart(n: number) {
  return String(n).padStart(2, '0');
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ── DayModal ─────────────────────────────────────────────────────────────────
function DayModal({
  date,
  agendamentos,
  onClose,
  onConverted,
}: {
  date: string;
  agendamentos: Agendamento[];
  onClose: () => void;
  onConverted: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [dateDay, month, year] = date.split('-').reverse().map(Number);
  const displayDate = `${padStart(dateDay)}/${padStart(month)}/${year}`;

  const handleConverter = async (id: string) => {
    setLoading(id);
    try {
      await converterAgendamentoAction(id);
      toast.success('Agendamento convertido em pedido com sucesso!');
      onConverted();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao converter.');
    } finally {
      setLoading(null);
    }
  };

  const handleCancelar = async (id: string) => {
    if (!confirm('Deseja cancelar este agendamento?')) return;
    setLoading(id);
    try {
      await cancelarAgendamentoAction(id);
      toast.success('Agendamento cancelado.');
      onConverted();
      onClose();
    } catch {
      toast.error('Erro ao cancelar.');
    } finally {
      setLoading(null);
    }
  };

  const ativos = agendamentos.filter(a => a.status === 'agendado');

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: 'var(--color-surface-container-lowest)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                backgroundColor: 'var(--color-primary-container)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>
                  event
                </span>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--color-on-surface)' }}>
                  {displayDate}
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-outline)' }}>
                  {ativos.length} agendamento{ativos.length !== 1 ? 's' : ''} ativo{ativos.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              border: 'none', backgroundColor: 'var(--color-surface-container-high)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {ativos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.3 }}>event_busy</span>
              <p style={{ marginTop: '12px' }}>Nenhum agendamento ativo nesta data</p>
            </div>
          ) : (
            ativos.map(ag => {
              const hora = new Date(ag.data_agendamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              const isExpanded = expandedId === ag.id;
              return (
                <div key={ag.id} style={{
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--color-surface-container-lowest)',
                }}>
                  {/* Card header */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : ag.id)}
                    style={{
                      padding: '16px 20px',
                      cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: isExpanded ? 'var(--color-surface-container-low)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '12px',
                        backgroundColor: 'var(--color-primary-container)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>schedule</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-on-surface)' }}>
                          {ag.nome_cliente || ag.cliente?.nome || '—'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-outline)', marginTop: '2px' }}>
                          {hora} · {ag.forma_pagamento.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--color-primary)' }}>
                        {formatCurrency(ag.valor_total)}
                      </span>
                      <span className="material-symbols-outlined" style={{
                        fontSize: '20px', color: 'var(--color-outline)',
                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}>expand_more</span>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{
                      padding: '16px 20px',
                      borderTop: '1px solid var(--color-outline-variant)',
                      backgroundColor: 'var(--color-surface-container-low)',
                    }}>
                      {/* Items */}
                      {(ag.itens || []).length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', fontSize: '11px', color: 'var(--color-outline)', fontWeight: 700, textTransform: 'uppercase', padding: '4px 0' }}>Produto</th>
                              <th style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-outline)', fontWeight: 700, textTransform: 'uppercase', padding: '4px 0' }}>Qtd</th>
                              <th style={{ textAlign: 'right', fontSize: '11px', color: 'var(--color-outline)', fontWeight: 700, textTransform: 'uppercase', padding: '4px 0' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ag.itens!.map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ fontSize: '13px', padding: '6px 0', fontWeight: 600 }}>{item.produto?.nome_produto || '—'}</td>
                                <td style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-outline)' }}>{item.quantidade}</td>
                                <td style={{ fontSize: '13px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {ag.observacoes && (
                        <p style={{ fontSize: '12px', color: 'var(--color-outline)', marginBottom: '16px', fontStyle: 'italic' }}>
                          Obs: {ag.observacoes}
                        </p>
                      )}

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => handleConverter(ag.id)}
                          disabled={loading === ag.id}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: 'var(--color-primary)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: loading === ag.id ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            opacity: loading === ag.id ? 0.7 : 1,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_cart</span>
                          {loading === ag.id ? 'Convertendo...' : 'Tornar Pedido'}
                        </button>
                        <button
                          onClick={() => handleCancelar(ag.id)}
                          disabled={loading === ag.id}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '10px',
                            border: '1px solid var(--color-error)',
                            backgroundColor: 'transparent',
                            color: 'var(--color-error)',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: loading === ag.id ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── StatusListModal ───────────────────────────────────────────────────────────
function StatusListModal({
  status,
  agendamentos,
  year,
  month,
  onClose,
  onUpdated,
}: {
  status: 'agendado' | 'convertido' | 'cancelado';
  agendamentos: Agendamento[];
  year: number;
  month: number;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const titleMap = {
    agendado: 'Agendamentos Ativos',
    convertido: 'Agendamentos Convertidos',
    cancelado: 'Agendamentos Cancelados',
  };

  const iconMap = {
    agendado: 'event',
    convertido: 'task_alt',
    cancelado: 'cancel',
  };

  const colorMap = {
    agendado: 'var(--color-primary)',
    convertido: '#1b5e20',
    cancelado: 'var(--color-error)',
  };

  const handleConverter = async (id: string) => {
    setLoading(id);
    try {
      await converterAgendamentoAction(id);
      toast.success('Agendamento convertido em pedido com sucesso!');
      onUpdated();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao converter.');
    } finally {
      setLoading(null);
    }
  };

  const handleCancelar = async (id: string) => {
    if (!confirm('Deseja cancelar este agendamento?')) return;
    setLoading(id);
    try {
      await cancelarAgendamentoAction(id);
      toast.success('Agendamento cancelado.');
      onUpdated();
      onClose();
    } catch {
      toast.error('Erro ao cancelar.');
    } finally {
      setLoading(null);
    }
  };

  const displayMonthYear = `${MONTHS[month]} ${year}`;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: 'var(--color-surface-container-lowest)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              backgroundColor: status === 'agendado' ? 'var(--color-primary-container)' : status === 'convertido' ? '#e8f5e9' : 'var(--color-error-container)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ color: colorMap[status], fontSize: '22px' }}>
                {iconMap[status]}
              </span>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--color-on-surface)' }}>
                {titleMap[status]}
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-outline)' }}>
                {displayMonthYear} · {agendamentos.length} item(ns)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              border: 'none', backgroundColor: 'var(--color-surface-container-high)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {agendamentos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.3 }}>event_busy</span>
              <p style={{ marginTop: '12px' }}>Nenhum item nesta lista para este mês.</p>
            </div>
          ) : (
            agendamentos.map(ag => {
              const dateObj = new Date(ag.data_agendamento);
              const displayDate = `${padStart(dateObj.getDate())}/${padStart(dateObj.getMonth() + 1)}/${dateObj.getFullYear()}`;
              const hora = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              const isExpanded = expandedId === ag.id;

              return (
                <div key={ag.id} style={{
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--color-surface-container-lowest)',
                }}>
                  {/* Card header */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : ag.id)}
                    style={{
                      padding: '16px 20px',
                      cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: isExpanded ? 'var(--color-surface-container-low)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '12px',
                        backgroundColor: 'var(--color-surface-container-high)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--color-outline)', fontSize: '22px' }}>schedule</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-on-surface)' }}>
                          {ag.nome_cliente || ag.cliente?.nome || '—'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-outline)', marginTop: '2px' }}>
                          {displayDate} às {hora} · {ag.forma_pagamento.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 800, fontSize: '15px', color: colorMap[status] }}>
                        {formatCurrency(ag.valor_total)}
                      </span>
                      <span className="material-symbols-outlined" style={{
                        fontSize: '20px', color: 'var(--color-outline)',
                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}>expand_more</span>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{
                      padding: '16px 20px',
                      borderTop: '1px solid var(--color-outline-variant)',
                      backgroundColor: 'var(--color-surface-container-low)',
                    }}>
                      {/* Items */}
                      {(ag.itens || []).length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', fontSize: '11px', color: 'var(--color-outline)', fontWeight: 700, textTransform: 'uppercase', padding: '4px 0' }}>Produto</th>
                              <th style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-outline)', fontWeight: 700, textTransform: 'uppercase', padding: '4px 0' }}>Qtd</th>
                              <th style={{ textAlign: 'right', fontSize: '11px', color: 'var(--color-outline)', fontWeight: 700, textTransform: 'uppercase', padding: '4px 0' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ag.itens!.map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ fontSize: '13px', padding: '6px 0', fontWeight: 600 }}>{item.produto?.nome_produto || '—'}</td>
                                <td style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-outline)' }}>{item.quantidade}</td>
                                <td style={{ fontSize: '13px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {ag.observacoes && (
                        <p style={{ fontSize: '12px', color: 'var(--color-outline)', marginBottom: '16px', fontStyle: 'italic' }}>
                          Obs: {ag.observacoes}
                        </p>
                      )}

                      {/* Actions (Only if status is 'agendado') */}
                      {status === 'agendado' && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => handleConverter(ag.id)}
                            disabled={loading === ag.id}
                            style={{
                              flex: 1,
                              padding: '10px 16px',
                              borderRadius: '10px',
                              border: 'none',
                              backgroundColor: 'var(--color-primary)',
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: '13px',
                              cursor: loading === ag.id ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                              opacity: loading === ag.id ? 0.7 : 1,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_cart</span>
                            {loading === ag.id ? 'Convertendo...' : 'Tornar Pedido'}
                          </button>
                          <button
                            onClick={() => handleCancelar(ag.id)}
                            disabled={loading === ag.id}
                            style={{
                              padding: '10px 16px',
                              borderRadius: '10px',
                              border: '1px solid var(--color-error)',
                              backgroundColor: 'transparent',
                              color: 'var(--color-error)',
                              fontWeight: 700,
                              fontSize: '13px',
                              cursor: loading === ag.id ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: '8px',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
interface Props {
  initialAgendamentos: Agendamento[];
}

export default function AgendamentoClientPage({ initialAgendamentos }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>(initialAgendamentos);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayAgendamentos, setDayAgendamentos] = useState<Agendamento[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [statusListModal, setStatusListModal] = useState<'agendado' | 'convertido' | 'cancelado' | null>(null);

  const refresh = async () => {
    try {
      const data = await getAgendamentosAction();
      setAgendamentos(data);
    } catch {
      toast.error('Erro ao atualizar agendamentos.');
    }
  };

  // Group counts by date string YYYY-MM-DD (only 'agendado')
  const countsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    agendamentos.forEach(ag => {
      if (ag.status !== 'agendado') return;
      const key = isoToDateStr(ag.data_agendamento);
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [agendamentos]);

  // Filter agendamentos of current viewed month and year
  const currentMonthAgendamentos = useMemo(() => {
    return agendamentos.filter(a => {
      const d = new Date(a.data_agendamento);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [agendamentos, year, month]);

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const handleDayClick = async (day: number) => {
    const dateStr = `${year}-${padStart(month + 1)}-${padStart(day)}`;
    setSelectedDate(dateStr);
    setLoadingDay(true);
    try {
      const data = await getAgendamentosByDateAction(dateStr);
      setDayAgendamentos(data);
    } catch {
      toast.error('Erro ao carregar agendamentos do dia.');
    } finally {
      setLoadingDay(false);
    }
  };

  const todayStr = `${today.getFullYear()}-${padStart(today.getMonth() + 1)}-${padStart(today.getDate())}`;

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-on-surface)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
          Gestão de <span style={{ color: 'var(--color-primary)' }}>Agendamentos</span>
        </h1>
        <p style={{ color: 'var(--color-outline)', fontSize: '15px' }}>
          Visualize e gerencie os pedidos agendados. Clique em um dia para ver detalhes.
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {[
          {
            label: 'Agendados',
            status: 'agendado',
            value: currentMonthAgendamentos.filter(a => a.status === 'agendado').length,
            icon: 'event',
            color: 'var(--color-primary)',
            bg: 'var(--color-primary-container)',
          },
          {
            label: 'Convertidos',
            status: 'convertido',
            value: currentMonthAgendamentos.filter(a => a.status === 'convertido').length,
            icon: 'task_alt',
            color: '#1b5e20',
            bg: '#e8f5e9',
          },
          {
            label: 'Cancelados',
            status: 'cancelado',
            value: currentMonthAgendamentos.filter(a => a.status === 'cancelado').length,
            icon: 'cancel',
            color: 'var(--color-error)',
            bg: 'var(--color-error-container)',
          },
        ].map(s => (
          <div 
            key={s.label} 
            onClick={() => setStatusListModal(s.status as any)}
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-outline-variant)',
              borderRadius: '20px',
              padding: '20px 24px',
              display: 'flex', alignItems: 'center', gap: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.05)';
              e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.backgroundColor = 'var(--color-surface)';
            }}
          >
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              backgroundColor: s.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '26px' }}>{s.icon}</span>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-outline-variant)',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      }}>
        {/* Nav */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: 'var(--color-surface-container-lowest)',
        }}>
          <button
            onClick={prevMonth}
            style={{
              width: '40px', height: '40px', borderRadius: '12px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>chevron_left</span>
          </button>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-on-surface)', margin: 0 }}>
            {MONTHS[month]} {year}
          </h2>

          <button
            onClick={nextMonth}
            style={{
              width: '40px', height: '40px', borderRadius: '12px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>chevron_right</span>
          </button>
        </div>

        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '16px 16px 0' }}>
          {WEEK_DAYS.map(d => (
            <div key={d} style={{
              textAlign: 'center', fontSize: '11px', fontWeight: 700,
              color: 'var(--color-outline)', textTransform: 'uppercase',
              letterSpacing: '0.05em', paddingBottom: '12px',
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 16px 16px', gap: '4px' }}>
          {Array.from({ length: totalCells }).map((_, idx) => {
            const dayNum = idx - firstDay + 1;
            const isValid = dayNum >= 1 && dayNum <= daysInMonth;
            const dateStr = isValid
              ? `${year}-${padStart(month + 1)}-${padStart(dayNum)}`
              : null;
            const count = dateStr ? (countsByDate[dateStr] || 0) : 0;
            const isToday = dateStr === todayStr;

            return (
              <div
                key={idx}
                onClick={() => isValid && handleDayClick(dayNum)}
                style={{
                  minHeight: '72px',
                  borderRadius: '14px',
                  padding: '10px',
                  cursor: isValid ? 'pointer' : 'default',
                  backgroundColor: isToday
                    ? 'var(--color-primary-container)'
                    : count > 0
                    ? 'rgba(var(--color-primary-rgb, 0,102,204), 0.06)'
                    : 'transparent',
                  border: isToday
                    ? '2px solid var(--color-primary)'
                    : count > 0
                    ? '1px solid rgba(var(--color-primary-rgb, 0,102,204), 0.2)'
                    : '1px solid transparent',
                  transition: 'all 0.15s',
                  opacity: isValid ? 1 : 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onMouseEnter={e => {
                  if (isValid) e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)';
                }}
                onMouseLeave={e => {
                  if (!isValid) return;
                  e.currentTarget.style.backgroundColor = isToday
                    ? 'var(--color-primary-container)'
                    : count > 0
                    ? 'rgba(var(--color-primary-rgb, 0,102,204), 0.06)'
                    : 'transparent';
                }}
              >
                <span style={{
                  fontSize: '14px',
                  fontWeight: isToday ? 900 : 600,
                  color: isToday ? 'var(--color-primary)' : 'var(--color-on-surface)',
                }}>
                  {isValid ? dayNum : ''}
                </span>
                {count > 0 && (
                  <div style={{
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    borderRadius: '20px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    minWidth: '24px',
                    textAlign: 'center',
                  }}>
                    {count}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day modal */}
      {selectedDate && (
        <DayModal
          date={selectedDate}
          agendamentos={loadingDay ? [] : dayAgendamentos}
          onClose={() => setSelectedDate(null)}
          onConverted={refresh}
        />
      )}

      {/* Stats list modal */}
      {statusListModal && (
        <StatusListModal
          status={statusListModal}
          agendamentos={currentMonthAgendamentos.filter(a => a.status === statusListModal)}
          year={year}
          month={month}
          onClose={() => setStatusListModal(null)}
          onUpdated={refresh}
        />
      )}
    </div>
  );
}
