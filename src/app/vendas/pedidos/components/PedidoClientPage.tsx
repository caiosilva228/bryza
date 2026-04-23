'use client';

import React, { useState, useMemo } from 'react';
import { Pedido, PedidoStats as PedidoStatsType, Cliente, Produto, Usuario } from '@/models/types';
import PedidoStats from './PedidoStats';
import PedidoTable from './PedidoTable';
import PedidoFormModal from './PedidoFormModal';
import PedidoDetailsModal from './PedidoDetailsModal';
import { getPedidos, getPedidosStats, getProdutosAction } from '../actions';
import { toast } from 'sonner';
import Pagination from '@/components/ui/Pagination';

interface Props {
  initialPedidos: Pedido[];
  initialStats: PedidoStatsType;
  clientes: Cliente[];
  produtos: Produto[];
  vendedores: Usuario[];
}

export default function PedidoClientPage({ 
  initialPedidos, 
  initialStats,
  clientes,
  produtos,
  vendedores
}: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>(initialPedidos);
  const [stats, setStats] = useState<PedidoStatsType>(initialStats);
  const [localProdutos, setLocalProdutos] = useState<Produto[]>(produtos);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Paginação
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [pedidoToEdit, setPedidoToEdit] = useState<Pedido | null>(null);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [newPedidos, newStats, newProdutos] = await Promise.all([
        getPedidos(),
        getPedidosStats(),
        getProdutosAction()
      ]);
      setPedidos(newPedidos);
      setStats(newStats);
      setLocalProdutos(newProdutos);
    } catch (error) {
      toast.error('Erro ao atualizar dados.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      const searchLower = search.toLowerCase();
      
      const numero = p.numero_pedido || '';
      const cliente = p.nome_cliente || '';
      const cidade = p.cidade || '';

      const matchesSearch = 
        numero.toLowerCase().includes(searchLower) ||
        cliente.toLowerCase().includes(searchLower) ||
        cidade.toLowerCase().includes(searchLower);
      
      const matchesStatus = statusFilter === 'todos' || p.status_pedido === statusFilter;

      // Filtro por data de criação
      const dataCriacao = p.data_criacao || p.created_at;
      let matchesDate = true;
      if (dataCriacao) {
        const pedidoDate = new Date(dataCriacao);
        if (dateFrom) {
          const from = new Date(dateFrom);
          from.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && pedidoDate >= from;
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && pedidoDate <= to;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [pedidos, search, statusFilter, dateFrom, dateTo]);

  // Resetar página ao mudar filtros
  React.useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateFrom, dateTo]);

  const totalFiltered = filteredPedidos.length;
  const paginatedPedidos = filteredPedidos.slice((page - 1) * pageSize, page * pageSize);

  const clearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="page-wrapper">
      {/* ── Cabeçalho ───────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: '32px' }}>
        <div className="page-header-text">
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 800, 
            color: 'var(--color-on-surface)',
            letterSpacing: '-0.02em',
            marginBottom: '8px'
          }}>
            Gestão de <span style={{ color: 'var(--color-primary)' }}>Pedidos</span>
          </h1>
          <p style={{ color: 'var(--color-outline)', fontSize: '15px' }}>
            Controle de logística, status de preparação e expedição em tempo real.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="btn-secondary"
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-outline-variant)',
              color: 'var(--color-on-surface)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
            title="Sincronizar Banco de Dados"
            onMouseEnter={(e) => { if(!isLoading) e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)'; }}
            onMouseLeave={(e) => { if(!isLoading) e.currentTarget.style.backgroundColor = 'var(--color-surface)'; }}
          >
            <span
              className="material-symbols-outlined"
              style={{ 
                fontSize: '20px',
                animation: isLoading ? 'spin 1s linear infinite' : 'none' 
              }}
            >
              sync
            </span>
            <span className="hide-mobile">Sincronizar</span>
          </button>

          <button
            onClick={() => setIsFormModalOpen(true)}
            className="btn-primary"
            style={{ 
              padding: '10px 24px',
              borderRadius: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
            Novo Pedido
          </button>
        </div>
      </div>

      <PedidoStats stats={stats} />

      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '20px',
        border: '1px solid var(--color-outline-variant)',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.03)',
        marginTop: '24px'
      }}>
        {/* Barra de Filtros (Toolbar Premium) */}
        <div style={{
          display: 'flex',
          gap: '16px',
          padding: '20px',
          borderBottom: '1px solid var(--color-outline-variant)',
          backgroundColor: 'var(--color-surface)',
          flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}>
          {/* Busca */}
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Buscar
            </label>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-outline)', fontSize: '20px' }}>search</span>
              <input
                type="text"
                placeholder="Nº pedido, cliente ou cidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 48px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface-container-lowest)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--color-on-surface)',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                  e.currentTarget.style.boxShadow = '0 0 0 4px var(--color-primary-fixed)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Status */}
          <div style={{ position: 'relative', minWidth: '200px', flex: '0 0 auto' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Status
            </label>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-primary)', fontSize: '20px', pointerEvents: 'none' }}>flag</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 48px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface-container-lowest)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--color-on-surface)',
                  appearance: 'none',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                  e.currentTarget.style.boxShadow = '0 0 0 4px var(--color-primary-fixed)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <option value="todos">Todos os Status</option>
                <option value="aguardando_preparacao">Aguardando Preparação</option>
                <option value="pronto_para_entrega">Pronto para Entrega</option>
                <option value="em_rota">Em Rota de Entrega</option>
                <option value="entregue">Entregue</option>
                <option value="finalizado">Finalizado</option>
                <option value="cancelado">Cancelado</option>
              </select>
              <span className="material-symbols-outlined" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-outline)', fontSize: '20px', pointerEvents: 'none' }}>unfold_more</span>
            </div>
          </div>

          {/* Filtros de Data */}
          <div style={{ display: 'flex', gap: '12px', flex: '0 0 auto' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Período (De)
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  padding: '11px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${dateFrom ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                  backgroundColor: dateFrom ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-lowest)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: dateFrom ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface)',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '46px'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 4px var(--color-primary-fixed)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = dateFrom ? 'var(--color-primary)' : 'var(--color-outline-variant)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Até
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  padding: '11px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${dateTo ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                  backgroundColor: dateTo ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-lowest)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: dateTo ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface)',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '46px'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 4px var(--color-primary-fixed)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = dateTo ? 'var(--color-primary)' : 'var(--color-outline-variant)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Limpar datas */}
          {(dateFrom || dateTo || search || statusFilter !== 'todos') && (
            <button
              onClick={() => {
                clearDateFilter();
                setSearch('');
                setStatusFilter('todos');
              }}
              title="Limpar todos os filtros"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 16px',
                height: '46px',
                borderRadius: '12px',
                border: '1px solid var(--color-outline-variant)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-on-surface-variant)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)';
                e.currentTarget.style.color = 'var(--color-error)';
                e.currentTarget.style.borderColor = 'var(--color-error)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                e.currentTarget.style.color = 'var(--color-on-surface-variant)';
                e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_alt_off</span>
              <span className="hide-mobile">Limpar</span>
            </button>
          )}
        </div>

        <PedidoTable 
          pedidos={paginatedPedidos} 
          onSelectPedido={(p) => setSelectedPedido(p)}
          onRefresh={refreshData}
          isLoading={isLoading}
        />

        <Pagination
          total={totalFiltered}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {/* Modais */}
      {isFormModalOpen && (
        <PedidoFormModal 
          isOpen={isFormModalOpen}
          onClose={() => { setIsFormModalOpen(false); setPedidoToEdit(null); }}
          onSuccess={async () => {
            setTimeout(() => { refreshData(); }, 600);
          }}
          clientes={clientes}
          produtos={localProdutos}
          vendedores={vendedores}
          pedidoToEdit={pedidoToEdit}
        />
      )}

      {selectedPedido && (
        <PedidoDetailsModal 
          pedido={selectedPedido}
          isOpen={!!selectedPedido}
          onClose={() => setSelectedPedido(null)}
          onUpdate={refreshData}
          onEdit={(pedido) => {
            setPedidoToEdit(pedido);
            setIsFormModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
