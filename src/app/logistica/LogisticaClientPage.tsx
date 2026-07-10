'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Pedido, DeliveryProblemType, DeliveryNextAction } from '@/models/types';
import { toast } from 'sonner';

import LogisticaSummaryCards from '@/components/logistica/LogisticaSummaryCards';
import LogisticaFilters from '@/components/logistica/LogisticaFilters';
import LogisticaTabs, { LogisticaTab } from '@/components/logistica/LogisticaTabs';
import LogisticaTable from '@/components/logistica/LogisticaTable';
import OrderDetailsModal from '@/components/logistica/OrderDetailsModal';
import PaymentCheckModal from '@/components/logistica/PaymentCheckModal';
import DeliveryProblemModal from '@/components/logistica/DeliveryProblemModal';

import {
  getPedidosLogistica,
  marcarEmRota,
  marcarEntregue,
  confirmarPagamento,
  registrarProblema,
} from './actions';

interface Props {
  initialPedidos: Pedido[];
}

export default function LogisticaClientPage({ initialPedidos }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>(initialPedidos);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [bairroFilter, setBairroFilter] = useState('');
  const [motoristaFilter, setMotoristaFilter] = useState('');
  const [pagamentoFilter, setPagamentoFilter] = useState('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Aba ativa
  const [activeTab, setActiveTab] = useState<LogisticaTab>('todos');

  // Modais
  const [detailsPedido, setDetailsPedido] = useState<Pedido | null>(null);
  const [paymentPedido, setPaymentPedido] = useState<Pedido | null>(null);
  const [problemPedido, setProblemPedido] = useState<Pedido | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [problemLoading, setProblemLoading] = useState(false);

  // Listas dinâmicas para filtros
  const bairros = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => {
      const b = p.cliente?.bairro ?? p.bairro;
      if (b) set.add(b);
    });
    return Array.from(set).sort();
  }, [pedidos]);

  const motoristas = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => { if (p.motorista) set.add(p.motorista); });
    return Array.from(set).sort();
  }, [pedidos]);

  // Refresh dos dados
  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await getPedidosLogistica();
      setPedidos(data);
    } catch {
      toast.error('Não foi possível carregar os pedidos da logística.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Filtro por aba
  const pedidosPorAba = useMemo(() => {
    switch (activeTab) {
      case 'prontos': return pedidos.filter(p => p.status_pedido === 'pronto_para_entrega');
      case 'em_rota': return pedidos.filter(p => p.status_pedido === 'em_rota');
      case 'entregues': return pedidos.filter(p => p.status_pedido === 'entregue');
      case 'problemas': return pedidos.filter(p => p.status_pedido === 'cancelado' || !!p.delivery_problem_type);
      default: return pedidos;
    }
  }, [pedidos, activeTab]);

  // Filtros adicionais
  const filteredPedidos = useMemo(() => {
    let list = pedidosPorAba;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => {
        const nome = (p.cliente?.nome ?? p.nome_cliente ?? '').toLowerCase();
        const tel = (p.cliente?.telefone ?? p.telefone_cliente ?? '').replace(/\D/g, '');
        const num = (p.numero_pedido ?? '').toLowerCase();
        return nome.includes(q) || tel.includes(q.replace(/\D/g, '')) || num.includes(q);
      });
    }

    if (statusFilter !== 'todos') {
      list = list.filter(p => p.status_pedido === statusFilter);
    }

    if (bairroFilter) {
      list = list.filter(p => (p.cliente?.bairro ?? p.bairro) === bairroFilter);
    }

    if (motoristaFilter) {
      list = list.filter(p => p.motorista === motoristaFilter);
    }

    if (pagamentoFilter !== 'todos') {
      list = list.filter(p => p.forma_pagamento === pagamentoFilter);
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter(p => {
        const d = p.data_criacao ?? p.created_at;
        return d ? new Date(d) >= from : true;
      });
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter(p => {
        const d = p.data_criacao ?? p.created_at;
        return d ? new Date(d) <= to : true;
      });
    }

    return list;
  }, [pedidosPorAba, search, statusFilter, bairroFilter, motoristaFilter, pagamentoFilter, dateFrom, dateTo]);

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('todos');
    setBairroFilter('');
    setMotoristaFilter('');
    setPagamentoFilter('todos');
    setDateFrom('');
    setDateTo('');
  };

  // ── Ações ──────────────────────────────────────────────────────────────────

  const handleMarcarEmRota = async (pedido: Pedido) => {
    if (pedido.status_pedido !== 'pronto_para_entrega') return;
    if (!confirm(`Confirmar envio do pedido #${pedido.numero_pedido} para rota de entrega?`)) return;
    setLoadingId(pedido.id);
    try {
      await marcarEmRota(pedido.id);
      toast.success('Pedido enviado para rota de entrega.');
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o pedido. Tente novamente.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleMarcarEntregue = async (pedido: Pedido) => {
    if (pedido.status_pedido !== 'em_rota') return;
    if (!confirm(`Confirmar entrega do pedido #${pedido.numero_pedido}?`)) return;
    setLoadingId(pedido.id);
    try {
      await marcarEntregue(pedido.id);
      toast.success('Pedido marcado como entregue. Agora falta conferir o pagamento.');
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o pedido. Tente novamente.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleConferirPagamento = async (params: {
    orderId: string;
    expectedAmount: number;
    receivedAmount: number;
    paymentMethod: string;
    notes?: string;
  }) => {
    setPaymentLoading(true);
    try {
      const result = await confirmarPagamento(params);
      if (result.divergent) {
        toast.warning('Pagamento divergente registrado. O pedido continuará como entregue até conferência.');
      } else {
        toast.success('Pedido finalizado com sucesso.');
      }
      setPaymentPedido(null);
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível confirmar o pagamento.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleRegistrarProblema = async (params: {
    problemType: DeliveryProblemType;
    notes: string;
    nextAction: DeliveryNextAction;
  }) => {
    if (!problemPedido) return;
    setProblemLoading(true);
    try {
      await registrarProblema({ orderId: problemPedido.id, ...params });
      toast.success('Problema de entrega registrado.');
      setProblemPedido(null);
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o problema.');
    } finally {
      setProblemLoading(false);
    }
  };

  return (
    <>
      {/* Cards de Resumo */}
      <LogisticaSummaryCards pedidos={pedidos} />

      {/* Filtros */}
      <LogisticaFilters
        search={search} onSearchChange={setSearch}
        statusFilter={statusFilter} onStatusChange={setStatusFilter}
        bairroFilter={bairroFilter} onBairroChange={setBairroFilter}
        motoristaFilter={motoristaFilter} onMotoristaChange={setMotoristaFilter}
        pagamentoFilter={pagamentoFilter} onPagamentoChange={setPagamentoFilter}
        dateFrom={dateFrom} onDateFromChange={setDateFrom}
        dateTo={dateTo} onDateToChange={setDateTo}
        onClear={handleClearFilters}
        bairros={bairros}
        motoristas={motoristas}
      />

      {/* Abas */}
      <LogisticaTabs
        activeTab={activeTab}
        onTabChange={tab => { setActiveTab(tab); setStatusFilter('todos'); }}
        pedidos={pedidos}
      />

      {/* Contagem + Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
          {filteredPedidos.length} pedido{filteredPedidos.length !== 1 ? 's' : ''} encontrado{filteredPedidos.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={refreshData}
          disabled={isRefreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px',
            border: '1px solid var(--color-outline-variant)',
            backgroundColor: 'transparent',
            fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: '12px',
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            color: 'var(--color-on-surface-variant)',
            opacity: isRefreshing ? 0.6 : 1,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '15px', animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}
          >
            refresh
          </span>
          {isRefreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Tabela */}
      <LogisticaTable
        pedidos={filteredPedidos}
        onViewDetails={setDetailsPedido}
        onMarcarEmRota={handleMarcarEmRota}
        onMarcarEntregue={handleMarcarEntregue}
        onConferirPagamento={setPaymentPedido}
        onRegistrarProblema={setProblemPedido}
        loadingId={loadingId}
      />

      {/* Modais */}
      <OrderDetailsModal
        pedido={detailsPedido}
        open={!!detailsPedido}
        onClose={() => setDetailsPedido(null)}
      />

      <PaymentCheckModal
        pedido={paymentPedido}
        open={!!paymentPedido}
        onClose={() => setPaymentPedido(null)}
        onConfirm={handleConferirPagamento}
        loading={paymentLoading}
      />

      <DeliveryProblemModal
        pedidoNumero={problemPedido?.numero_pedido}
        open={!!problemPedido}
        onClose={() => setProblemPedido(null)}
        onConfirm={handleRegistrarProblema}
        loading={problemLoading}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
