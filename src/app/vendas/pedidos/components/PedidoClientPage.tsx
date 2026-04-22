'use client';

import React, { useState, useMemo } from 'react';
import { Pedido, PedidoStats as PedidoStatsType, Cliente, Produto, Usuario } from '@/models/types';
import PedidoStats from './PedidoStats';
import PedidoTable from './PedidoTable';
import PedidoFormModal from './PedidoFormModal';
import PedidoDetailsModal from './PedidoDetailsModal';
import { getPedidos, getPedidosStats, getProdutosAction } from '../actions';
import { toast } from 'sonner';

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
  const [isLoading, setIsLoading] = useState(false);
  
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
      
      return matchesSearch && matchesStatus;
    });
  }, [pedidos, search, statusFilter]);

  return (
    <div className="page-wrapper">
      {/* ── Cabeçalho ───────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 style={{ color: 'var(--color-primary)' }}>Relação de Pedidos e Reservas</h1>
          <p>Controle de logística, status de preparação e expedição.</p>
        </div>

        <div className="page-header-actions">
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="btn-secondary"
            style={{
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            title="Sincronizar Banco de Dados"
          >
            <span
              className="material-symbols-outlined"
              style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }}
            >
              sync
            </span>
            Sincronizar
          </button>

          <button
            onClick={() => setIsFormModalOpen(true)}
            className="btn-primary"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            <span className="material-symbols-outlined">add</span>
            Novo Pedido
          </button>
        </div>
      </div>

      <PedidoStats stats={stats} />


      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '16px',
        border: '1px solid var(--color-outline-variant)',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        {/* Barra de Filtros */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-outline-variant)',
          backgroundColor: 'var(--color-surface-container-low)',
          flexWrap: 'wrap',
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-outline)', fontSize: '18px' }}>search</span>
            <input
              type="text"
              placeholder="Buscar pedido, cliente ou cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                borderRadius: '8px',
                border: '1px solid var(--color-outline-variant)',
                backgroundColor: 'var(--color-surface)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ position: 'relative', minWidth: '180px', flex: '0 0 auto' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-outline)', fontSize: '18px' }}>filter_list</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 34px',
                borderRadius: '8px',
                border: '1px solid var(--color-outline-variant)',
                backgroundColor: 'var(--color-surface)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-on-surface)',
                appearance: 'none',
                cursor: 'pointer',
                outline: 'none',
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
          </div>
        </div>


        <PedidoTable 
          pedidos={filteredPedidos} 
          onSelectPedido={(p) => setSelectedPedido(p)}
          onRefresh={refreshData}
          isLoading={isLoading}
        />
      </div>

      {/* Modais */}
      {isFormModalOpen && (
        <PedidoFormModal 
          isOpen={isFormModalOpen}
          onClose={() => { setIsFormModalOpen(false); setPedidoToEdit(null); }}
          onSuccess={async () => {
            // Pequeno delay para garantir que as triggers do Supabase terminaram o cálculo
            setTimeout(() => {
              refreshData();
            }, 600);
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
