'use client';

import React, { useState, useMemo } from 'react';
import { DeliveryRoute, Pedido, Driver, RouteStatus, RouteOrder, DeliveryProblemType, DeliveryNextAction } from '@/models/types';
import RoutesSummaryCards from '@/components/rotas/RoutesSummaryCards';
import RoutesFilters from '@/components/rotas/RoutesFilters';
import RoutesTabs, { RoutesTab } from '@/components/rotas/RoutesTabs';
import RoutesTable from '@/components/rotas/RoutesTable';
import CreateRouteModal from '@/components/rotas/CreateRouteModal';
import RouteDetailsDrawer from '@/components/rotas/RouteDetailsDrawer';
import RouteManifestModal from '@/components/rotas/RouteManifestModal';
import NotDeliveredModal from '@/components/rotas/NotDeliveredModal';
import { generateGoogleMapsRouteUrl } from '@/utils/googleMaps';
import { toast } from 'sonner';

import {
  createRouteAction,
  updateRouteStatusAction,
  startRouteAction,
  finishRouteAction,
  cancelRouteAction,
  reorderRouteOrdersAction,
  markRouteOrderAsDeliveredAction,
  markRouteOrderAsNotDeliveredAction
} from './actions';

interface Props {
  initialRoutes: DeliveryRoute[];
  availableOrders: Pedido[];
  drivers: Driver[];
}

export default function RotasClientPage({ initialRoutes, availableOrders, drivers }: Props) {
  // State for data (optimistic UI could be added, but for now we rely on server actions + revalidatePath if using router.refresh, but since we receive initialRoutes, we might need router.refresh)
  // To make it simple and reactive without complex optimistic updates, we will just trigger actions and trust next.js router refresh, but actually in a client component we might want to manually refresh or just rely on the server actions doing revalidatePath. 
  // Wait, revalidatePath works on server, but the client component needs router.refresh() if it doesn't automatically get the new props. Next.js App Router usually handles this if we use server actions.
  // Actually, let's keep the routes in state so we can do local optimistic updates for smoother UX.
  const [routes, setRoutes] = useState<DeliveryRoute[]>(initialRoutes);
  
  // Update local state when props change
  React.useEffect(() => {
    setRoutes(initialRoutes);
  }, [initialRoutes]);

  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [driverFilter, setDriverFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Tabs State
  const [activeTab, setActiveTab] = useState<RoutesTab>('todas');

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<DeliveryRoute | null>(null);
  const [isManifestOpen, setIsManifestOpen] = useState(false);
  const [notDeliveredOrder, setNotDeliveredOrder] = useState<{ routeId: string, routeOrderId: string, orderId: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Derived Options for Filters
  const uniqueDrivers = useMemo(() => Array.from(new Set(routes.map(r => r.driver_name).filter(Boolean))) as string[], [routes]);
  const uniqueCities = useMemo(() => Array.from(new Set(routes.map(r => r.city).filter(Boolean))) as string[], [routes]);

  // Derived Data (Filtering)
  const filteredRoutes = useMemo(() => {
    return routes.filter(r => {
      // 1. Text Search
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      // 2. Dropdown Status Filter
      if (statusFilter !== 'todos' && r.status !== statusFilter) return false;
      // 3. Driver Filter
      if (driverFilter && r.driver_name !== driverFilter) return false;
      // 4. City Filter
      if (cityFilter && r.city !== cityFilter) return false;
      // 5. Date Filter
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      
      // 6. Tab Filter
      if (activeTab === 'hoje') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (r.date !== today.toISOString().split('T')[0]) return false;
      }
      if (activeTab === 'planejadas' && r.status !== 'Planejada' && r.status !== 'Separando Produtos' && r.status !== 'Pronta para Sair') return false;
      if (activeTab === 'andamento' && r.status !== 'Em Andamento') return false;
      if (activeTab === 'finalizadas' && !r.status.startsWith('Finalizada')) return false;
      if (activeTab === 'pendencias' && r.status !== 'Finalizada com Pendências') return false;

      return true;
    });
  }, [routes, search, statusFilter, driverFilter, cityFilter, dateFrom, dateTo, activeTab]);

  // Counts for Tabs
  const counts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    return {
      todas: routes.length,
      hoje: routes.filter(r => r.date === todayStr).length,
      planejadas: routes.filter(r => r.status === 'Planejada' || r.status === 'Separando Produtos' || r.status === 'Pronta para Sair').length,
      andamento: routes.filter(r => r.status === 'Em Andamento').length,
      finalizadas: routes.filter(r => r.status.startsWith('Finalizada')).length,
      pendencias: routes.filter(r => r.status === 'Finalizada com Pendências').length,
    };
  }, [routes]);

  // Actions
  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('todos');
    setDriverFilter('');
    setCityFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const handleCreateRoute = async (params: any) => {
    setLoading(true);
    try {
      await createRouteAction(params);
      toast.success('Rota criada com sucesso!');
      setIsCreateModalOpen(false);
      // Data will refresh via Server Action (revalidatePath) 
      // mas precisamos forçar um refresh no client component para receber as props atualizadas
      window.location.reload(); 
    } catch (error) {
      toast.error('Erro ao criar rota.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Helper for drawer actions (refreshing selected route)
  // We will reload window for simplicity and guaranteed consistency since we have a lot of joins
  const refreshUI = () => {
    window.location.reload();
  };

  const handleUpdateStatus = async (id: string, status: RouteStatus) => {
    setLoading(true);
    try {
      await updateRouteStatusAction(id, status);
      toast.success(`Status atualizado para ${status}`);
      refreshUI();
    } catch (e) {
      toast.error('Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRoute = async (id: string) => {
    setLoading(true);
    try {
      await startRouteAction(id);
      toast.success('Rota iniciada com sucesso!');
      refreshUI();
    } catch (e) {
      toast.error('Erro ao iniciar rota');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishRoute = async (id: string) => {
    setLoading(true);
    try {
      await finishRouteAction(id);
      toast.success('Rota finalizada!');
      refreshUI();
    } catch (e) {
      toast.error('Erro ao finalizar rota');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRoute = async (id: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta rota? Os pedidos voltarão a ficar disponíveis.')) return;
    setLoading(true);
    try {
      await cancelRouteAction(id);
      toast.success('Rota cancelada.');
      refreshUI();
    } catch (e) {
      toast.error('Erro ao cancelar rota');
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (id: string, orders: { routeOrderId: string, sequence: number }[]) => {
    setLoading(true);
    try {
      await reorderRouteOrdersAction(id, orders);
      toast.success('Ordem atualizada.');
      refreshUI();
    } catch (e) {
      toast.error('Erro ao reordenar');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDelivered = async (routeId: string, routeOrderId: string, orderId: string) => {
    setLoading(true);
    try {
      await markRouteOrderAsDeliveredAction(routeId, routeOrderId, orderId);
      toast.success('Pedido marcado como entregue!');
      refreshUI();
    } catch (e) {
      toast.error('Erro ao confirmar entrega');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMap = (route: DeliveryRoute & { delivery_route_orders?: RouteOrder[] }) => {
    if (!route.delivery_route_orders) return;
    const pendingOrders = route.delivery_route_orders.filter(ro => ro.status === 'Pendente' || ro.status === 'Em Rota');
    const pedidos = pendingOrders.map(ro => ro.pedido).filter(Boolean) as Pedido[];
    if (pedidos.length === 0) {
      toast.error('Não há endereços pendentes para gerar a rota no mapa.');
      return;
    }
    const url = generateGoogleMapsRouteUrl(pedidos);
    window.open(url, '_blank');
  };

  const handleSubmitNotDelivered = async (reason: DeliveryProblemType, notes: string, nextAction: DeliveryNextAction) => {
    if (!notDeliveredOrder) return;
    setLoading(true);
    try {
      await markRouteOrderAsNotDeliveredAction(
        notDeliveredOrder.routeId, notDeliveredOrder.routeOrderId, notDeliveredOrder.orderId,
        reason, notes, nextAction as any
      );
      toast.success('Falha registrada.');
      setNotDeliveredOrder(null);
      refreshUI();
    } catch (e) {
      toast.error('Erro ao registrar falha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, fontFamily: 'var(--font-headline)' }}>Gestão de Rotas</h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--color-on-surface-variant)' }}>
            Monte rotas de entrega, atribua motoristas e gere romaneios.
          </p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: '12px', padding: '12px 20px',
            fontFamily: 'var(--font-headline)', fontSize: '14px', fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,86,117,0.2)'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add_location</span>
          Nova Rota
        </button>
      </div>

      <RoutesSummaryCards routes={routes} />
      
      <RoutesTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts as any} />

      <RoutesFilters 
        search={search} onSearchChange={setSearch}
        statusFilter={statusFilter} onStatusChange={setStatusFilter}
        driverFilter={driverFilter} onDriverChange={setDriverFilter}
        cityFilter={cityFilter} onCityChange={setCityFilter}
        dateFrom={dateFrom} onDateFromChange={setDateFrom}
        dateTo={dateTo} onDateToChange={setDateTo}
        onClear={handleClearFilters}
        drivers={uniqueDrivers} cities={uniqueCities}
      />

      <RoutesTable 
        routes={filteredRoutes} 
        onViewDetails={setSelectedRoute} 
      />

      {/* Modals & Drawers */}
      <CreateRouteModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        availableOrders={availableOrders}
        drivers={drivers}
        onSubmit={handleCreateRoute}
        loading={loading}
      />

      <RouteDetailsDrawer
        route={selectedRoute}
        open={!!selectedRoute}
        onClose={() => setSelectedRoute(null)}
        onUpdateStatus={handleUpdateStatus}
        onStartRoute={handleStartRoute}
        onFinishRoute={handleFinishRoute}
        onCancelRoute={handleCancelRoute}
        onReorder={handleReorder}
        onMarkDelivered={handleMarkDelivered}
        onMarkNotDelivered={(routeId, routeOrderId, orderId) => setNotDeliveredOrder({ routeId, routeOrderId, orderId })}
        onOpenManifest={(r) => setIsManifestOpen(true)}
        onOpenMap={handleOpenMap}
        loading={loading}
      />

      <RouteManifestModal
        route={selectedRoute}
        open={isManifestOpen}
        onClose={() => setIsManifestOpen(false)}
      />

      <NotDeliveredModal
        open={!!notDeliveredOrder}
        onClose={() => setNotDeliveredOrder(null)}
        onSubmit={handleSubmitNotDelivered}
        loading={loading}
      />

    </div>
  );
}
