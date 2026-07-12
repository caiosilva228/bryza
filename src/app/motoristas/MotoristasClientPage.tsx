'use client';

import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import type { Driver, DriverFormInput, DriverStatus, DriverRouteCompensation } from '@/models/types';
import type { DriversStats, DriverRouteSummary } from '@/services/driversService';
import DriversSummaryCards from '@/components/drivers/DriversSummaryCards';
import DriversFilters from '@/components/drivers/DriversFilters';
import DriversTable from '@/components/drivers/DriversTable';
import DriverFormModal from '@/components/drivers/DriverFormModal';
import DriverDetailsDrawer from '@/components/drivers/DriverDetailsDrawer';
import ManualAdjustmentModal from '@/components/drivers/ManualAdjustmentModal';
import ApproveCompensationModal from '@/components/drivers/ApproveCompensationModal';
import MarkCompensationPaidModal from '@/components/drivers/MarkCompensationPaidModal';

import {
  createDriverAction,
  updateDriverAction,
  updateDriverStatusAction,
  updateCompensationAdjustmentAction,
  approveCompensationAction,
  markCompensationAsPaidAction,
} from './actions';

interface Props {
  initialDrivers: Driver[];
  initialStats: DriversStats;
}

export default function MotoristasClientPage({ initialDrivers, initialStats }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [stats,   setStats]   = useState<DriversStats>(initialStats);

  // Filtros
  const [search,      setSearch]      = useState('');
  const [statusFilter,setStatusFilter]= useState('all');
  const [compFilter,  setCompFilter]  = useState('');
  const [vehicleFilter,setVehicleFilter]= useState('');

  // Modais
  const [isFormOpen,   setIsFormOpen]  = useState(false);
  const [editingDriver,setEditingDriver]= useState<Driver | null>(null);
  const [loading,      setLoading]     = useState(false);

  // Drawer
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [drawerRoutes,   setDrawerRoutes]   = useState<DriverRouteSummary[]>([]);
  const [drawerComps,    setDrawerComps]    = useState<DriverRouteCompensation[]>([]);
  const [loadingDrawer,  setLoadingDrawer]  = useState(false);

  // Modais de remuneração
  const [adjustingComp, setAdjustingComp] = useState<DriverRouteCompensation | null>(null);
  const [approvingComp, setApprovingComp] = useState<DriverRouteCompensation | null>(null);
  const [payingComp,    setPayingComp]    = useState<DriverRouteCompensation | null>(null);

  // Filtragem local
  const filteredDrivers = useMemo(() => {
    return drivers.filter(d => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (compFilter && d.compensation_model !== compFilter) return false;
      if (vehicleFilter && d.vehicle_type !== vehicleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          d.full_name.toLowerCase().includes(q) ||
          d.phone.includes(q) ||
          (d.city?.toLowerCase() || '').includes(q) ||
          (d.vehicle_model?.toLowerCase() || '').includes(q) ||
          (d.vehicle_plate?.toLowerCase() || '').includes(q)
        );
      }
      return true;
    });
  }, [drivers, search, statusFilter, compFilter, vehicleFilter]);

  const openCreate = () => {
    setEditingDriver(null);
    setIsFormOpen(true);
  };

  const openEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setIsFormOpen(true);
    setSelectedDriver(null);
  };

  const openDetails = useCallback(async (driver: Driver) => {
    setSelectedDriver(driver);
    setLoadingDrawer(true);
    try {
      const [routesRes, compsRes] = await Promise.all([
        fetch(`/api/drivers/${driver.id}/routes`),
        fetch(`/api/drivers/${driver.id}/compensations`),
      ]);
      const routes = routesRes.ok ? await routesRes.json() : [];
      const comps  = compsRes.ok  ? await compsRes.json()  : [];
      setDrawerRoutes(routes);
      setDrawerComps(comps);
    } catch {
      setDrawerRoutes([]);
      setDrawerComps([]);
    } finally {
      setLoadingDrawer(false);
    }
  }, []);

  const handleFormSubmit = async (input: DriverFormInput) => {
    setLoading(true);
    try {
      if (editingDriver) {
        const updated = await updateDriverAction(editingDriver.id, input);
        setDrivers(prev => prev.map(d => d.id === updated.id ? updated : d));
        toast.success('Motorista atualizado com sucesso!');
      } else {
        const created = await createDriverAction(input);
        setDrivers(prev => [created, ...prev]);
        if (created.status === 'active') setStats(s => ({ ...s, total_active: s.total_active + 1 }));
        toast.success('Motorista cadastrado com sucesso!');
      }
      setIsFormOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar motorista.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (driver: Driver) => {
    const newStatus: DriverStatus = driver.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDriverStatusAction(driver.id, newStatus);
      setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, status: newStatus } : d));
      if (selectedDriver?.id === driver.id) setSelectedDriver(d => d ? { ...d, status: newStatus } : d);
      const delta = newStatus === 'active' ? 1 : -1;
      setStats(s => ({ ...s, total_active: s.total_active + delta }));
      toast.success(`Motorista ${newStatus === 'active' ? 'ativado' : 'inativado'}.`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar status.');
    }
  };

  const handleAdjust = async (params: { compensationId: string; manualAdjustment: number; adjustmentReason?: string }) => {
    setLoading(true);
    try {
      await updateCompensationAdjustmentAction(params);
      if (selectedDriver) {
        const res = await fetch(`/api/drivers/${selectedDriver.id}/compensations`);
        if (res.ok) setDrawerComps(await res.json());
      }
      toast.success('Ajuste aplicado com sucesso!');
      setAdjustingComp(null);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao aplicar ajuste.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (compensationId: string) => {
    setLoading(true);
    try {
      await approveCompensationAction(compensationId);
      if (selectedDriver) {
        const res = await fetch(`/api/drivers/${selectedDriver.id}/compensations`);
        if (res.ok) setDrawerComps(await res.json());
      }
      toast.success('Remuneração aprovada!');
      setApprovingComp(null);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao aprovar remuneração.');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (params: { compensationId: string; notes?: string }) => {
    setLoading(true);
    try {
      await markCompensationAsPaidAction(params);
      if (selectedDriver) {
        const res = await fetch(`/api/drivers/${selectedDriver.id}/compensations`);
        if (res.ok) setDrawerComps(await res.json());
      }
      toast.success('Pagamento registrado!');
      setPayingComp(null);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registrar pagamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 900, fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
            Motoristas
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--color-on-surface-variant)' }}>
            Cadastro, vinculação às rotas e gestão de remuneração
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 20px', borderRadius: '12px',
            backgroundColor: 'var(--color-primary)', color: '#fff',
            border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person_add</span>
          Novo Motorista
        </button>
      </div>

      {/* Summary Cards */}
      <DriversSummaryCards stats={stats} />

      {/* Filtros */}
      <DriversFilters
        search={search}
        statusFilter={statusFilter}
        compensationFilter={compFilter}
        vehicleFilter={vehicleFilter}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onCompensationChange={setCompFilter}
        onVehicleChange={setVehicleFilter}
        onClear={() => { setSearch(''); setStatusFilter('all'); setCompFilter(''); setVehicleFilter(''); }}
      />

      {/* Contagem */}
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>
        {filteredDrivers.length} motorista(s) encontrado(s)
      </p>

      {/* Tabela */}
      <DriversTable
        drivers={filteredDrivers}
        onEdit={openEdit}
        onViewDetails={openDetails}
        onToggleStatus={handleToggleStatus}
      />

      {/* Modais */}
      <DriverFormModal
        open={isFormOpen}
        driver={editingDriver}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        loading={loading}
      />

      <DriverDetailsDrawer
        open={!!selectedDriver}
        driver={selectedDriver}
        routes={drawerRoutes}
        compensations={drawerComps}
        onClose={() => setSelectedDriver(null)}
        onEdit={openEdit}
        onToggleStatus={handleToggleStatus}
        onAdjust={setAdjustingComp}
        onApprove={setApprovingComp}
        onPay={setPayingComp}
        loadingRoutes={loadingDrawer}
        loadingComps={loadingDrawer}
      />

      <ManualAdjustmentModal
        open={!!adjustingComp}
        compensation={adjustingComp}
        onClose={() => setAdjustingComp(null)}
        onSubmit={handleAdjust}
        loading={loading}
      />

      <ApproveCompensationModal
        open={!!approvingComp}
        compensation={approvingComp}
        onClose={() => setApprovingComp(null)}
        onConfirm={handleApprove}
        loading={loading}
      />

      <MarkCompensationPaidModal
        open={!!payingComp}
        compensation={payingComp}
        onClose={() => setPayingComp(null)}
        onConfirm={handlePay}
        loading={loading}
      />
    </div>
  );
}
