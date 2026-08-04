'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Agendamento, Cliente, Produto, Usuario } from '@/models/types';
import {
  getAgendamentosAction,
  converterAgendamentoAction,
  cancelarAgendamentoAction,
  reagendarAgendamentoAction,
  converterAgendamentosEmLoteAction,
  cancelarAgendamentosEmLoteAction,
} from './actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { printSummary } from '@/utils/print';
import { toast } from 'sonner';
import Pagination from '@/components/ui/Pagination';

interface Props {
  initialAgendamentos: Agendamento[];
  clientes?: Cliente[];
  produtos?: Produto[];
  vendedores?: Usuario[];
}

type SortKey = 'numero' | 'cliente' | 'destino' | 'responsavel' | 'status' | 'valor';
type SortDirection = 'asc' | 'desc';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEK_DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const textCollator = new Intl.Collator('pt-BR', {
  sensitivity: 'base',
  numeric: true,
});

function getLocalDateStr(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateOnly(dateStr?: string | null): string {
  if (!dateStr) return '';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  }
  return formatDate(dateStr);
}

function getPeriodLabel(periodo?: string | null): string {
  switch (periodo) {
    case 'manhademanha': return 'Manhã (09:00 - 12:00)';
    case 'tarde': return 'Tarde (14:00 - 18:00)';
    case 'noite': return 'Noite (18:30 - 21:00)';
    case 'qualquer': return 'Qualquer Horário';
    default: return periodo || 'Horário Comercial';
  }
}

function SchedulingPaymentBadges({ agendamento }: { agendamento: Agendamento }) {
  const timing = agendamento.payment_timing === 'agora' ? 'Pagamento online' : 'Pagamento na entrega';
  const status = agendamento.payment_status || 'pendente';
  const approved = ['aprovado', 'confirmado', 'pago'].includes(status);
  const statusLabel = approved ? 'Pago' : status === 'processando' ? 'Processando' : status === 'recusado' ? 'Recusado' : 'Não pago';

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
      <span style={{ padding: '3px 6px', borderRadius: '999px', fontSize: '9px', fontWeight: 800, background: '#e0f2fe', color: '#0369a1' }}>
        {timing}
      </span>
      <span style={{ padding: '3px 6px', borderRadius: '999px', fontSize: '9px', fontWeight: 800, background: approved ? '#dcfce7' : '#fef3c7', color: approved ? '#166534' : '#92400e' }}>
        {statusLabel}
      </span>
    </div>
  );
}

export default function AgendamentoClientPage({
  initialAgendamentos,
}: Props) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>(initialAgendamentos);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  
  // Filtro por Calendário Dropdown (Popover)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // Ordenação de 3 cliques (asc -> desc -> null/normal)
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);

  // Seleção Múltipla (Bulk/Lote)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Paginação
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modais
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const data = await getAgendamentosAction();
      setAgendamentos(data);
    } catch (err) {
      toast.error('Erro ao atualizar agendamentos.');
    } finally {
      setIsLoading(false);
    }
  };

  // Mapeamento de Agendamentos por Data (para as badges do calendário)
  const agendamentosByDateMap = useMemo(() => {
    const map: Record<string, Agendamento[]> = {};
    for (const ag of agendamentos) {
      const dateKey = getLocalDateStr(ag.data_agendamento);
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(ag);
      }
    }
    return map;
  }, [agendamentos]);

  // Calendário - construção da grade do mês
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      days.push({ dayNumber: d, dateStr });
    }
    return days;
  }, [currentMonth]);

  const prevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const resetToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(getLocalDateStr(today.toISOString()));
    setPage(1);
  };

  // KPIs dos cards
  const stats = useMemo(() => {
    let agendados = 0;
    let convertidos = 0;
    let cancelados = 0;
    for (const a of agendamentos) {
      if (a.status === 'agendado') agendados++;
      else if (a.status === 'convertido') convertidos++;
      else if (a.status === 'cancelado') cancelados++;
    }
    return { agendados, convertidos, cancelados, total: agendamentos.length };
  }, [agendamentos]);

  // Filtro dos agendamentos por busca, status e Data Selecionada no Calendário
  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter(ag => {
      const searchLower = search.toLowerCase();

      const numAgendamento = ag.numero_agendamento || `AG${ag.id.slice(0, 8)}`;
      const clienteName = ag.nome_cliente || ag.cliente?.nome || '';
      const telefone = ag.telefone_cliente || ag.cliente?.telefone || '';
      const cidade = ag.cidade || ag.cliente?.cidade || '';
      const vendedor = ag.nome_vendedor || ag.vendedor?.nome || '';
      const obs = ag.observacoes || '';

      const matchesSearch =
        numAgendamento.toLowerCase().includes(searchLower) ||
        clienteName.toLowerCase().includes(searchLower) ||
        telefone.toLowerCase().includes(searchLower) ||
        cidade.toLowerCase().includes(searchLower) ||
        vendedor.toLowerCase().includes(searchLower) ||
        obs.toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter === 'todos' || ag.status === statusFilter;

      // Filtro por Data do Calendário
      let matchesDate = true;
      if (selectedDate) {
        matchesDate = getLocalDateStr(ag.data_agendamento) === selectedDate;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [agendamentos, search, statusFilter, selectedDate]);

  // Ordenação com lógica de 3 cliques (asc -> desc -> null)
  const sortedAgendamentos = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredAgendamentos;

    const list = [...filteredAgendamentos];

    list.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'numero': {
          const numA = a.numero_agendamento || a.id;
          const numB = b.numero_agendamento || b.id;
          comparison = textCollator.compare(numA, numB);
          break;
        }
        case 'cliente': {
          const nameA = a.nome_cliente || a.cliente?.nome || '';
          const nameB = b.nome_cliente || b.cliente?.nome || '';
          comparison = textCollator.compare(nameA, nameB);
          break;
        }
        case 'destino': {
          const destA = `${a.bairro || ''} ${a.cidade || ''}`;
          const destB = `${b.bairro || ''} ${b.cidade || ''}`;
          comparison = textCollator.compare(destA, destB);
          break;
        }
        case 'responsavel': {
          const respA = a.nome_vendedor || a.vendedor?.nome || '';
          const respB = b.nome_vendedor || b.vendedor?.nome || '';
          comparison = textCollator.compare(respA, respB);
          break;
        }
        case 'status': {
          comparison = textCollator.compare(a.status || '', b.status || '');
          break;
        }
        case 'valor': {
          comparison = (a.valor_total || 0) - (b.valor_total || 0);
          break;
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [filteredAgendamentos, sortKey, sortDirection]);

  // Paginação
  const paginatedAgendamentos = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedAgendamentos.slice(start, start + pageSize);
  }, [sortedAgendamentos, page, pageSize]);

  // Handler de 3 cliques na ordenação
  const handleSort = (key: SortKey) => {
    setPage(1);
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortKey(null);
      setSortDirection(null);
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key || !sortDirection) return 'unfold_more';
    return sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
  };

  // Checkbox seleção em lote
  const isAllPaginatedSelected = useMemo(() => {
    if (paginatedAgendamentos.length === 0) return false;
    return paginatedAgendamentos.every(ag => selectedIds.includes(ag.id));
  }, [paginatedAgendamentos, selectedIds]);

  const toggleSelectAll = () => {
    if (isAllPaginatedSelected) {
      const paginatedIds = new Set(paginatedAgendamentos.map(a => a.id));
      setSelectedIds(prev => prev.filter(id => !paginatedIds.has(id)));
    } else {
      const paginatedIds = paginatedAgendamentos.map(a => a.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...paginatedIds])));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Ações em lote
  const handleBulkConvert = async () => {
    if (selectedIds.length === 0) return;
    const confirm = window.confirm(
      `Deseja converter os ${selectedIds.length} agendamento(s) selecionado(s) em Pedidos Oficiais?`
    );
    if (!confirm) return;

    setBulkActionLoading(true);
    try {
      const res = await converterAgendamentosEmLoteAction(selectedIds);
      if (res.convertedCount > 0) {
        toast.success(`Sucesso: ${res.convertedCount} agendamento(s) convertido(s) em pedido(s)!`);
      }
      if (res.errorCount > 0) {
        toast.warning(`${res.errorCount} agendamento(s) não puderam ser convertidos (já convertidos ou cancelados).`);
      }
      setSelectedIds([]);
      await refreshData();
    } catch {
      toast.error('Erro ao processar conversão em lote.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedIds.length === 0) return;
    const confirm = window.confirm(
      `Deseja cancelar os ${selectedIds.length} agendamento(s) selecionado(s)?`
    );
    if (!confirm) return;

    setBulkActionLoading(true);
    try {
      const res = await cancelarAgendamentosEmLoteAction(selectedIds);
      toast.success(`${res.canceledCount} agendamento(s) cancelado(s) com sucesso.`);
      setSelectedIds([]);
      await refreshData();
    } catch {
      toast.error('Erro ao cancelar agendamentos em lote.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Ações individuais
  const handleSingleConvert = async (ag: Agendamento) => {
    setActionLoadingId(ag.id);
    try {
      await converterAgendamentoAction(ag.id);
      toast.success(`Agendamento #${ag.numero_agendamento || ag.id.slice(0, 8)} convertido em Pedido!`);
      setSelectedAgendamento(null);
      await refreshData();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao converter agendamento.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSingleCancel = async (ag: Agendamento) => {
    if (!window.confirm('Deseja cancelar este agendamento?')) return;
    setActionLoadingId(ag.id);
    try {
      await cancelarAgendamentoAction(ag.id);
      toast.success('Agendamento cancelado com sucesso.');
      setSelectedAgendamento(null);
      await refreshData();
    } catch {
      toast.error('Erro ao cancelar agendamento.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px', backgroundColor: 'var(--color-surface)', minHeight: '100vh' }}>
      
      {/* CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--color-on-surface)', letterSpacing: '-0.02em' }}>
            Gestão de <span style={{ color: 'var(--color-primary)' }}>Agendamentos</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--color-outline)' }}>
            Visualize a lista de agendamentos, filtre por data no calendário e converta em pedidos.
          </p>
        </div>

        <button
          onClick={refreshData}
          disabled={isLoading}
          style={{
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid var(--color-outline-variant)',
            backgroundColor: 'var(--color-surface-container-low)',
            color: 'var(--color-on-surface)',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px', animation: isLoading ? 'spin 1s linear infinite' : 'none' }}>sync</span>
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container-lowest)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>event</span>
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agendados</span>
            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--color-on-surface)' }}>{stats.agendados}</h3>
          </div>
        </div>

        <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container-lowest)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>check_circle</span>
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Convertidos</span>
            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--color-on-surface)' }}>{stats.convertidos}</h3>
          </div>
        </div>

        <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container-lowest)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#fee2e2', color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>cancel</span>
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cancelados</span>
            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--color-on-surface)' }}>{stats.cancelados}</h3>
          </div>
        </div>
      </div>

      {/* BARRA DE FERRAMENTAS: FILTRO PERÍODO (DROPDOWN DE CALENDÁRIO POPOVER), BUSCA & STATUS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, flexWrap: 'wrap', minWidth: '300px' }}>
          
          {/* BOTAO DROPDOWN DE PERÍODO (ABRE CALENDÁRIO POPOVER) */}
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              style={{
                padding: '8px 16px',
                borderRadius: '16px',
                border: selectedDate ? '2px solid #0284c7' : '1.5px solid var(--color-outline-variant)',
                backgroundColor: selectedDate ? '#f0f9ff' : 'var(--color-surface-container-lowest)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: selectedDate ? '0 2px 10px rgba(2, 132, 199, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.02)',
                minWidth: '190px'
              }}
            >
              <span className="material-symbols-outlined" style={{ color: selectedDate ? '#0284c7' : 'var(--color-primary)', fontSize: '22px' }}>
                calendar_month
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: selectedDate ? '#0369a1' : 'var(--color-outline)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  PERÍODO
                </span>
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: selectedDate ? '#0284c7' : 'var(--color-on-surface)' }}>
                  {selectedDate ? formatDateOnly(selectedDate) : 'Todos os dias'}
                </span>
              </div>

              {selectedDate ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDate(null);
                    setPage(1);
                  }}
                  title="Limpar filtro de data"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#0284c7'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
                </button>
              ) : (
                <span className="material-symbols-outlined" style={{ color: 'var(--color-outline)', transform: isCalendarOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                  expand_more
                </span>
              )}
            </div>

            {/* POPOVER DO CALENDÁRIO DROPDOWN */}
            {isCalendarOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                  onClick={() => setIsCalendarOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    zIndex: 1000,
                    backgroundColor: '#ffffff',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.15)',
                    padding: '18px 20px',
                    width: '340px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Header do Popover do Mês */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                      {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </h4>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={resetToToday}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: 'transparent',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#0284c7',
                          cursor: 'pointer'
                        }}
                      >
                        Hoje
                      </button>
                      <button
                        type="button"
                        onClick={prevMonth}
                        title="Mês anterior"
                        style={{
                          width: '28px', height: '28px', borderRadius: '6px',
                          border: '1px solid #cbd5e1', backgroundColor: '#f8fafc',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_left</span>
                      </button>
                      <button
                        type="button"
                        onClick={nextMonth}
                        title="Próximo mês"
                        style={{
                          width: '28px', height: '28px', borderRadius: '6px',
                          border: '1px solid #cbd5e1', backgroundColor: '#f8fafc',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_right</span>
                      </button>
                    </div>
                  </div>

                  {/* Grade Semanal */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                    {WEEK_DAYS.map(day => (
                      <div key={day} style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', padding: '2px 0', textTransform: 'uppercase' }}>
                        {day}
                      </div>
                    ))}

                    {/* Dias do Mês */}
                    {calendarDays.map((item, idx) => {
                      if (!item) {
                        return <div key={`empty-${idx}`} style={{ height: '32px' }} />;
                      }

                      const dayAgs = agendamentosByDateMap[item.dateStr] || [];
                      const count = dayAgs.length;
                      const isSelected = selectedDate === item.dateStr;
                      const isToday = item.dateStr === getLocalDateStr(new Date().toISOString());

                      return (
                        <button
                          key={item.dateStr}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedDate(null);
                            } else {
                              setSelectedDate(item.dateStr);
                              setPage(1);
                            }
                            setIsCalendarOpen(false);
                          }}
                          style={{
                            height: '32px',
                            borderRadius: '8px',
                            border: isSelected
                              ? '2px solid #0284c7'
                              : isToday
                              ? '1.5px solid #0f172a'
                              : '1px solid #e2e8f0',
                            backgroundColor: isSelected
                              ? '#0284c7'
                              : count > 0
                              ? '#f0f9ff'
                              : 'transparent',
                            color: isSelected
                              ? '#ffffff'
                              : '#0f172a',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px',
                            position: 'relative',
                            transition: 'all 0.15s ease',
                            padding: '0 2px'
                          }}
                        >
                          <span style={{ fontSize: '12px', fontWeight: isToday || isSelected ? 800 : 600 }}>
                            {item.dayNumber}
                          </span>

                          {count > 0 && (
                            <span style={{
                              fontSize: '9px',
                              fontWeight: 800,
                              backgroundColor: isSelected ? '#ffffff' : '#0284c7',
                              color: isSelected ? '#0284c7' : '#ffffff',
                              minWidth: '14px',
                              height: '14px',
                              borderRadius: '999px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1
                            }}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Popover Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(null);
                        setPage(1);
                        setIsCalendarOpen(false);
                      }}
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Ver todos os dias
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(false)}
                      style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Fechar
                    </button>
                  </div>

                </div>
              </>
            )}
          </div>

          {/* Campo Busca */}
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-outline)', fontSize: '20px' }}>
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por Nº do agendamento, cliente, telefone, cidade..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%',
                padding: '12px 14px 12px 40px',
                borderRadius: '12px',
                border: '1px solid var(--color-outline-variant)',
                backgroundColor: 'var(--color-surface-container-lowest)',
                fontSize: '13.5px',
                color: 'var(--color-on-surface)',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Filtros Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--color-surface-container-low)', padding: '4px', borderRadius: '12px', border: '1px solid var(--color-outline-variant)' }}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'agendado', label: 'Agendados' },
            { id: 'convertido', label: 'Convertidos' },
            { id: 'cancelado', label: 'Cancelados' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); setPage(1); }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: statusFilter === tab.id ? 'var(--color-surface)' : 'transparent',
                color: statusFilter === tab.id ? 'var(--color-primary)' : 'var(--color-outline)',
                fontWeight: statusFilter === tab.id ? 800 : 600,
                fontSize: '12.5px',
                cursor: 'pointer',
                boxShadow: statusFilter === tab.id ? '0 2px 6px rgba(0, 0, 0, 0.05)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* BARRA DE AÇÕES EM LOTE (BULK BAR DE ALTO CONTRASTE) */}
      {selectedIds.length > 0 && (
        <div style={{
          padding: '14px 20px',
          backgroundColor: '#0f172a',
          border: '1.5px solid #1e293b',
          borderRadius: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff', fontWeight: 800, fontSize: '14px' }}>
            <span className="material-symbols-outlined" style={{ color: '#38bdf8', fontSize: '22px' }}>check_box</span>
            <span>{selectedIds.length} agendamento(s) selecionado(s)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleBulkConvert}
              disabled={bulkActionLoading}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                backgroundColor: '#009845',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(0, 152, 69, 0.3)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_cart_checkout</span>
              <span>Tornar Pedidos em Lote</span>
            </button>

            <button
              onClick={handleBulkCancel}
              disabled={bulkActionLoading}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
              <span>Cancelar Selecionados</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Limpar Seleção
            </button>
          </div>
        </div>
      )}

      {/* TABELA DE AGENDAMENTOS (LISTA COM DESIGN DA PÁGINA DE PEDIDOS) */}
      <div style={{
        borderRadius: '20px',
        border: '1px solid var(--color-outline-variant)',
        backgroundColor: 'var(--color-surface)',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-container-low)', borderBottom: '2px solid var(--color-outline-variant)' }}>
                
                {/* Checkbox Seleção Total */}
                <th style={{ padding: '12px', textAlign: 'center', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={isAllPaginatedSelected}
                    onChange={toggleSelectAll}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </th>

                {/* Coluna Nº Agendamento & Data */}
                <th style={{ padding: 0, textAlign: 'left' }}>
                  <button
                    type="button"
                    onClick={() => handleSort('numero')}
                    style={{
                      width: '100%', padding: '12px 14px', border: 'none', background: 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
                      cursor: 'pointer', color: sortKey === 'numero' ? 'var(--color-primary)' : 'var(--color-outline)',
                      fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}
                  >
                    <span>Nº Agendamento / Data</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{getSortIcon('numero')}</span>
                  </button>
                </th>

                {/* Coluna Cliente */}
                <th style={{ padding: 0, textAlign: 'left' }}>
                  <button
                    type="button"
                    onClick={() => handleSort('cliente')}
                    style={{
                      width: '100%', padding: '12px 14px', border: 'none', background: 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
                      cursor: 'pointer', color: sortKey === 'cliente' ? 'var(--color-primary)' : 'var(--color-outline)',
                      fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}
                  >
                    <span>Cliente / Contato</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{getSortIcon('cliente')}</span>
                  </button>
                </th>

                {/* Coluna Destino */}
                <th style={{ padding: 0, textAlign: 'left' }}>
                  <button
                    type="button"
                    onClick={() => handleSort('destino')}
                    style={{
                      width: '100%', padding: '12px 14px', border: 'none', background: 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
                      cursor: 'pointer', color: sortKey === 'destino' ? 'var(--color-primary)' : 'var(--color-outline)',
                      fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}
                  >
                    <span>Destino (Entrega)</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{getSortIcon('destino')}</span>
                  </button>
                </th>

                {/* Coluna Responsável */}
                <th style={{ padding: 0, textAlign: 'left' }}>
                  <button
                    type="button"
                    onClick={() => handleSort('responsavel')}
                    style={{
                      width: '100%', padding: '12px 14px', border: 'none', background: 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
                      cursor: 'pointer', color: sortKey === 'responsavel' ? 'var(--color-primary)' : 'var(--color-outline)',
                      fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}
                  >
                    <span>Responsável / Origem</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{getSortIcon('responsavel')}</span>
                  </button>
                </th>

                {/* Coluna Status */}
                <th style={{ padding: 0, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleSort('status')}
                    style={{
                      width: '100%', padding: '12px 14px', border: 'none', background: 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      cursor: 'pointer', color: sortKey === 'status' ? 'var(--color-primary)' : 'var(--color-outline)',
                      fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}
                  >
                    <span>Status</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{getSortIcon('status')}</span>
                  </button>
                </th>

                <th style={{ padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pagamento
                </th>

                <th style={{ padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Ação Rápida
                </th>

                {/* Coluna Valor Total */}
                <th style={{ padding: 0, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => handleSort('valor')}
                    style={{
                      width: '100%', padding: '12px 14px', border: 'none', background: 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px',
                      cursor: 'pointer', color: sortKey === 'valor' ? 'var(--color-primary)' : 'var(--color-outline)',
                      fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}
                  >
                    <span>Valor Total</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{getSortIcon('valor')}</span>
                  </button>
                </th>

                <th style={{ padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Detalhes
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedAgendamentos.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-outline)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.3, marginBottom: '12px' }}>event_busy</span>
                    <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: 'var(--color-on-surface)' }}>
                      Nenhum agendamento encontrado
                    </h4>
                    <p style={{ margin: 0, fontSize: '13.5px' }}>
                      Tente alterar os termos de busca ou o filtro de período.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedAgendamentos.map(ag => {
                  const numStr = ag.numero_agendamento || `AG${ag.id.slice(0, 8)}`;
                  const isChecked = selectedIds.includes(ag.id);
                  const isAgendado = ag.status === 'agendado';
                  const isConvertido = ag.status === 'convertido';
                  const isCancelado = ag.status === 'cancelado';

                  return (
                    <tr
                      key={ag.id}
                      style={{
                        borderBottom: '1px solid var(--color-outline-variant)',
                        backgroundColor: isChecked ? '#f0f9ff' : 'transparent',
                        boxShadow: isChecked ? 'inset 4px 0 0 #0284c7' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isChecked) e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)';
                        else e.currentTarget.style.backgroundColor = '#e0f2fe';
                      }}
                      onMouseLeave={(e) => {
                        if (!isChecked) e.currentTarget.style.backgroundColor = 'transparent';
                        else e.currentTarget.style.backgroundColor = '#f0f9ff';
                      }}
                    >
                      {/* Checkbox Linha */}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(ag.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </td>

                      {/* Nº Agendamento / Data */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--color-on-surface)', fontSize: '13px' }}>
                            #{numStr}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-outline)', fontWeight: 600 }}>
                            📅 {formatDate(ag.data_agendamento)}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>
                            ⏰ {getPeriodLabel(ag.periodo)}
                          </span>
                        </div>
                      </td>

                      {/* Cliente / Contato */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-on-surface)', fontSize: '12px' }}>
                            {ag.nome_cliente || ag.cliente?.nome || 'Consumidor'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>
                            {ag.telefone_cliente || ag.cliente?.telefone || 'Sem telefone'}
                          </span>
                        </div>
                      </td>

                      {/* Destino */}
                      <td style={{ padding: '12px 14px', maxWidth: '220px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: 'var(--color-on-surface)', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ag.endereco_entrega || ag.cliente?.endereco || 'Endereço não informado'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-outline)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ag.bairro || ag.cliente?.bairro}, {ag.cidade || ag.cliente?.cidade}
                          </span>
                        </div>
                      </td>

                      {/* Responsável / Origem */}
                      <td style={{ padding: '12px 14px' }}>
                        {(() => {
                          const isLojaVirtual = ag.attribution_source === 'smart_link' || ag.attribution_source === 'loja_virtual' || (ag.observacoes && ag.observacoes.includes('Loja Virtual'));
                          const responsavel = ag.nome_vendedor || ag.vendedor?.nome || (isLojaVirtual ? 'Loja Virtual' : 'Balcão / Admin');
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--color-on-surface)' }}>
                                {responsavel}
                              </span>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '9.5px',
                                fontWeight: 800,
                                width: 'fit-content',
                                backgroundColor: isLojaVirtual ? '#dcfce7' : '#f0f9ff',
                                color: isLojaVirtual ? '#166534' : '#0369a1'
                              }}>
                                {isLojaVirtual ? '🌐 Loja Virtual' : '📝 Agendamento Manual'}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Status Agendamento */}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 800,
                          backgroundColor: isConvertido ? '#dcfce7' : isCancelado ? '#fee2e2' : '#e0f2fe',
                          color: isConvertido ? '#166534' : isCancelado ? '#991b1b' : '#0369a1'
                        }}>
                          {isConvertido ? 'Convertido' : isCancelado ? 'Cancelado' : 'Agendado'}
                        </span>
                      </td>

                      {/* Pagamento */}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <SchedulingPaymentBadges agendamento={ag} />
                      </td>

                      {/* Ação Rápida */}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {isAgendado && (
                          <button
                            onClick={() => handleSingleConvert(ag)}
                            disabled={actionLoadingId === ag.id}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              backgroundColor: '#009845',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '11px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 2px 6px rgba(0, 152, 69, 0.2)'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>shopping_cart_checkout</span>
                            <span>Tornar Pedido</span>
                          </button>
                        )}
                        {isConvertido && (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534' }}>
                            ✓ Pedido Gerado
                          </span>
                        )}
                        {isCancelado && (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b' }}>
                            Cancelado
                          </span>
                        )}
                      </td>

                      {/* Valor Total */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <strong style={{ fontSize: '14px', color: 'var(--color-primary)', fontWeight: 800 }}>
                          {formatCurrency(ag.valor_total)}
                        </strong>
                      </td>

                      {/* Detalhes */}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedAgendamento(ag)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--color-surface-container-low)',
                            border: '1px solid var(--color-outline-variant)',
                            color: 'var(--color-on-surface)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                          <span>Detalhes</span>
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* RODAPÉ COM TOTALIZADOR E SELETOR DE PÁGINAS */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--color-outline-variant)',
          backgroundColor: 'var(--color-surface-container-low)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Totalizador */}
          <div style={{ fontSize: '13px', color: 'var(--color-outline)', fontWeight: 600 }}>
            Exibindo <strong>{paginatedAgendamentos.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> a <strong>{Math.min(page * pageSize, sortedAgendamentos.length)}</strong> de <strong>{sortedAgendamentos.length}</strong> agendamentos filtrados
          </div>

          {/* Seletor de Quantidade por Página e Paginação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)' }}>Exibir:</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--color-on-surface)',
                  cursor: 'pointer'
                }}
              >
                <option value={10}>10 por página</option>
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>

            <Pagination
              total={sortedAgendamentos.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>

      </div>

      {/* MODAL DE DETALHES COMPLETO DO AGENDAMENTO */}
      {selectedAgendamento && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(5, 15, 32, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 4000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={() => setSelectedAgendamento(null)}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            maxWidth: '640px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Header do Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#009845', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Detalhes do Agendamento
                </span>
                <h2 style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
                  #{selectedAgendamento.numero_agendamento || `AG${selectedAgendamento.id.slice(0, 8)}`}
                </h2>
              </div>
              <button
                onClick={() => setSelectedAgendamento(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Badges de Status */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{
                padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 800,
                backgroundColor: selectedAgendamento.status === 'convertido' ? '#dcfce7' : selectedAgendamento.status === 'cancelado' ? '#fee2e2' : '#e0f2fe',
                color: selectedAgendamento.status === 'convertido' ? '#166534' : selectedAgendamento.status === 'cancelado' ? '#991b1b' : '#0369a1'
              }}>
                Status: {selectedAgendamento.status === 'convertido' ? 'Convertido em Pedido' : selectedAgendamento.status === 'cancelado' ? 'Cancelado' : 'Agendado'}
              </span>

              {(selectedAgendamento.pedido?.numero_pedido || selectedAgendamento.pedido_id) && (
                <Link
                  href={`/vendas/pedidos?search=${encodeURIComponent(selectedAgendamento.pedido?.numero_pedido || selectedAgendamento.pedido_id || '')}`}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 800,
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
                    cursor: 'pointer'
                  }}
                  title="Clique para ir direto para o Pedido Oficial"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>shopping_bag</span>
                  <span>Pedido: #{selectedAgendamento.pedido?.numero_pedido || 'Ver Pedido'}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                </Link>
              )}

              <SchedulingPaymentBadges agendamento={selectedAgendamento} />
            </div>

            {/* CARD DESTACADO QUANDO CONVERTIDO EM PEDIDO */}
            {(selectedAgendamento.status === 'convertido' || selectedAgendamento.pedido_id || selectedAgendamento.pedido) && (
              <div style={{
                backgroundColor: '#f0fdf4',
                padding: '16px',
                borderRadius: '16px',
                border: '1.5px solid #bbf7d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.12)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>shopping_cart_checkout</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Pedido Oficial Gerado
                    </span>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                      #{selectedAgendamento.pedido?.numero_pedido || 'Pedido Vinculado'}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/vendas/pedidos?search=${encodeURIComponent(selectedAgendamento.pedido?.numero_pedido || selectedAgendamento.pedido_id || '')}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '12px',
                    backgroundColor: '#009845',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(0, 152, 69, 0.3)',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>Ir para o Pedido</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
                </Link>
              </div>
            )}

            {/* Dados do Cliente */}
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <strong style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dados do Cliente</strong>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                👤 {selectedAgendamento.nome_cliente || selectedAgendamento.cliente?.nome || 'Consumidor'}
              </div>
              <div style={{ fontSize: '13px', color: '#334155' }}>
                📞 {selectedAgendamento.telefone_cliente || selectedAgendamento.cliente?.telefone || 'Sem telefone'}
              </div>
              <div style={{ fontSize: '13px', color: '#334155' }}>
                📍 {selectedAgendamento.endereco_entrega || selectedAgendamento.cliente?.endereco || 'Retirada'}, {selectedAgendamento.bairro || selectedAgendamento.cliente?.bairro} - {selectedAgendamento.cidade || selectedAgendamento.cliente?.cidade}/{selectedAgendamento.estado || selectedAgendamento.cliente?.estado} {selectedAgendamento.cep ? `(CEP: ${selectedAgendamento.cep})` : ''}
              </div>
            </div>

            {/* Agendamento Data & Horário */}
            <div style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '14px', border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13.5px', color: '#0369a1' }}>
              <div><strong>📅 Data Agendada para Entrega:</strong> {formatDate(selectedAgendamento.data_agendamento)}</div>
              <div><strong>⏰ Período / Turno:</strong> {getPeriodLabel(selectedAgendamento.periodo)}</div>
              {(() => {
                const isLojaVirtual = selectedAgendamento.attribution_source === 'smart_link' || selectedAgendamento.attribution_source === 'loja_virtual' || (selectedAgendamento.observacoes && selectedAgendamento.observacoes.includes('Loja Virtual'));
                const resp = selectedAgendamento.nome_vendedor || selectedAgendamento.vendedor?.nome || (isLojaVirtual ? 'Loja Virtual' : 'Balcão / Admin');
                return (
                  <>
                    <div><strong>👨‍💼 Responsável:</strong> {resp}</div>
                    <div><strong>🌐 Origem do Agendamento:</strong> {isLojaVirtual ? 'Loja Virtual (Smart Link / Online)' : 'Agendamento Manual no Sistema'}</div>
                  </>
                );
              })()}
            </div>

            {/* Observações com rastreamento da Origem */}
            {selectedAgendamento.observacoes && (
              <div style={{ backgroundColor: '#fffbeb', padding: '14px 16px', borderRadius: '14px', border: '1px solid #fde68a', fontSize: '13px', color: '#92400e' }}>
                <strong>📌 Observações / Origem:</strong>
                <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{selectedAgendamento.observacoes}</p>
              </div>
            )}

            {/* Itens Agendados */}
            <div>
              {selectedAgendamento.kits && selectedAgendamento.kits.length > 0 && (
                <div style={{ marginBottom: '12px', padding: '12px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px' }}>
                  <strong style={{ display: 'block', fontSize: '12px', color: '#166534', marginBottom: '6px' }}>Kits comerciais</strong>
                  {selectedAgendamento.kits.map(kit => <div key={kit.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span>{kit.quantidade}x {kit.nome_kit_snapshot}</span><strong>{formatCurrency(kit.subtotal)}</strong></div>)}
                </div>
              )}
              <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginBottom: '10px' }}>Itens no Agendamento</strong>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Produto</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qtd</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Unitário</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedAgendamento.agendamento_itens || selectedAgendamento.itens || []).map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.produto?.nome_produto || 'Produto'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{item.quantidade}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatCurrency(item.preco_unitario)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ textAlign: 'right', marginTop: '10px', fontSize: '16px', fontWeight: 800, color: '#009845' }}>
                Total: {formatCurrency(selectedAgendamento.valor_total)}
              </div>
            </div>

            {/* Ações do Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => printSummary({
                  id: selectedAgendamento.id,
                  numero_pedido: selectedAgendamento.numero_agendamento || selectedAgendamento.id.slice(0, 8),
                  data_agendamento: selectedAgendamento.data_agendamento,
                  nome_cliente: selectedAgendamento.nome_cliente || selectedAgendamento.cliente?.nome,
                  telefone_cliente: selectedAgendamento.telefone_cliente || selectedAgendamento.cliente?.telefone,
                  endereco_entrega: selectedAgendamento.endereco_entrega || selectedAgendamento.cliente?.endereco,
                  bairro: selectedAgendamento.bairro || selectedAgendamento.cliente?.bairro,
                  cidade: selectedAgendamento.cidade || selectedAgendamento.cliente?.cidade,
                  estado: selectedAgendamento.estado || selectedAgendamento.cliente?.estado,
                  cep: selectedAgendamento.cep,
                  nome_vendedor: selectedAgendamento.nome_vendedor || selectedAgendamento.vendedor?.nome,
                  forma_pagamento: selectedAgendamento.forma_pagamento,
                  valor_total: selectedAgendamento.valor_total,
                  observacoes: selectedAgendamento.observacoes,
                  itens: (selectedAgendamento.agendamento_itens || selectedAgendamento.itens || []).map(i => ({
                    produto: i.produto,
                    quantidade: i.quantidade,
                    preco_unitario: i.preco_unitario,
                    subtotal: i.subtotal,
                  }))
                }, 'agendamento')}
                style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>print</span>
                <span>Imprimir Comprovante</span>
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                {selectedAgendamento.status === 'agendado' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSingleConvert(selectedAgendamento)}
                      disabled={actionLoadingId === selectedAgendamento.id}
                      style={{ padding: '12px 20px', borderRadius: '10px', backgroundColor: '#009845', color: '#ffffff', border: 'none', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span className="material-symbols-outlined">shopping_cart_checkout</span>
                      <span>Tornar Pedido</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSingleCancel(selectedAgendamento)}
                      disabled={actionLoadingId === selectedAgendamento.id}
                      style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
