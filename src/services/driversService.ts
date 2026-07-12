import { createClient } from '@/utils/supabase/server';
import type {
  Driver,
  DriverFormInput,
  DriverStatus,
  DriverRouteCompensation,
  CompensationStatus,
} from '@/models/types';
import { calculateDriverCompensation } from '@/utils/calculateDriverCompensation';

// ── Fetch ──────────────────────────────────────────────────────────────────────

export interface DriverFilters {
  search?: string;
  status?: DriverStatus | 'all';
  compensation_model?: string;
  vehicle_type?: string;
}

export const fetchDrivers = async (filters?: DriverFilters): Promise<Driver[]> => {
  const supabase = await createClient();
  let query = supabase
    .from('drivers')
    .select('*')
    .order('full_name', { ascending: true });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters?.compensation_model) {
    query = query.eq('compensation_model', filters.compensation_model);
  }
  if (filters?.vehicle_type) {
    query = query.eq('vehicle_type', filters.vehicle_type);
  }
  if (filters?.search) {
    const q = `%${filters.search}%`;
    query = query.or(
      `full_name.ilike.${q},phone.ilike.${q},city.ilike.${q},vehicle_model.ilike.${q},vehicle_plate.ilike.${q}`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Driver[];
};

export const fetchActiveDrivers = async (): Promise<Driver[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('status', 'active')
    .order('full_name', { ascending: true });

  if (error) throw error;
  return data as Driver[];
};

export const fetchDriverById = async (driverId: string): Promise<Driver> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single();

  if (error) throw error;
  return data as Driver;
};

// ── CRUD ───────────────────────────────────────────────────────────────────────

export const createDriver = async (input: DriverFormInput): Promise<Driver> => {
  const supabase = await createClient();
  const payload = sanitizeDriverInput(input);

  const { data, error } = await supabase
    .from('drivers')
    .insert([{ ...payload, created_at: new Date().toISOString() }])
    .select()
    .single();

  if (error) throw error;
  return data as Driver;
};

export const updateDriver = async (
  driverId: string,
  input: DriverFormInput
): Promise<Driver> => {
  const supabase = await createClient();
  const payload = sanitizeDriverInput(input);

  const { data, error } = await supabase
    .from('drivers')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', driverId)
    .select()
    .single();

  if (error) throw error;
  return data as Driver;
};

export const updateDriverStatus = async (
  driverId: string,
  status: DriverStatus
): Promise<void> => {
  const supabase = await createClient();
  const { error } = await supabase
    .from('drivers')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', driverId);

  if (error) throw error;
};

// ── Rotas do Motorista ─────────────────────────────────────────────────────────

export interface DriverRouteSummary {
  id: string;
  name: string;
  date: string;
  status: string;
  total_orders: number;
  completed_deliveries: number;
  failed_attempts: number;
  compensation?: DriverRouteCompensation;
}

export const fetchDriverRoutes = async (driverId: string): Promise<DriverRouteSummary[]> => {
  const supabase = await createClient();

  const { data: routes, error: rError } = await supabase
    .from('delivery_routes')
    .select(`
      id, name, date, status,
      delivery_route_orders(id, status)
    `)
    .eq('driver_id', driverId)
    .order('date', { ascending: false });

  if (rError) throw rError;

  const { data: comps, error: cError } = await supabase
    .from('driver_route_compensations')
    .select('*')
    .eq('driver_id', driverId);

  if (cError) throw cError;

  const compMap = new Map<string, DriverRouteCompensation>();
  (comps as DriverRouteCompensation[]).forEach(c => compMap.set(c.route_id, c));

  return (routes as any[]).map(r => {
    const orders = r.delivery_route_orders || [];
    const completed = orders.filter((o: any) => o.status === 'Entregue').length;
    const failed    = orders.filter((o: any) => o.status === 'Não Entregue').length;
    return {
      id: r.id,
      name: r.name,
      date: r.date,
      status: r.status,
      total_orders: orders.length,
      completed_deliveries: completed,
      failed_attempts: failed,
      compensation: compMap.get(r.id),
    };
  });
};

// ── Remunerações do Motorista ──────────────────────────────────────────────────

export const fetchDriverCompensations = async (
  driverId: string
): Promise<DriverRouteCompensation[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('driver_route_compensations')
    .select(`
      *,
      route:route_id
    `)
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Enrich with route names
  const routeIds = (data as any[]).map(c => c.route_id);
  if (routeIds.length > 0) {
    const { data: routes } = await supabase
      .from('delivery_routes')
      .select('id, name, date')
      .in('id', routeIds);

    const routeMap = new Map((routes || []).map((r: any) => [r.id, r]));
    return (data as any[]).map(c => ({
      ...c,
      route_name: routeMap.get(c.route_id)?.name,
      route_date: routeMap.get(c.route_id)?.date,
    })) as DriverRouteCompensation[];
  }

  return data as DriverRouteCompensation[];
};

// ── Criação/Atualização de Remuneração ─────────────────────────────────────────

export const createOrUpdateRouteCompensation = async (
  routeId: string
): Promise<DriverRouteCompensation | null> => {
  const supabase = await createClient();

  // 1. Buscar a rota com informações do motorista e pedidos
  const { data: route, error: rError } = await supabase
    .from('delivery_routes')
    .select(`
      id, driver_id, driver_name,
      use_driver_default_compensation,
      compensation_model_override,
      amount_per_delivery_override,
      amount_per_route_override,
      daily_amount_override,
      pay_failed_attempt_override,
      amount_per_failed_override,
      delivery_route_orders(id, status)
    `)
    .eq('id', routeId)
    .single();

  if (rError || !route) throw new Error('Rota não encontrada');
  if (!route.driver_id) return null; // Sem motorista, sem remuneração

  // 2. Verificar se remuneração já está aprovada/paga (não recalcular)
  const { data: existingComp } = await supabase
    .from('driver_route_compensations')
    .select('id, status')
    .eq('route_id', routeId)
    .maybeSingle();

  if (existingComp && existingComp.status !== 'open') {
    return null; // Não recalcular se já aprovada ou paga
  }

  // 3. Buscar dados do motorista
  const { data: driver, error: dError } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', route.driver_id)
    .maybeSingle();

  if (dError || !driver) return null; // Driver não encontrado na nova tabela

  // 4. Determinar regra: personalizada da rota ou padrão do motorista
  const useDefault = route.use_driver_default_compensation !== false;

  const compensation_model = useDefault
    ? driver.compensation_model
    : (route.compensation_model_override || driver.compensation_model);

  const amount_per_delivery = useDefault
    ? driver.amount_per_delivery
    : route.amount_per_delivery_override;

  const amount_per_route = useDefault
    ? driver.amount_per_route
    : route.amount_per_route_override;

  const daily_amount = useDefault
    ? driver.daily_amount
    : route.daily_amount_override;

  const pay_failed_attempt = useDefault
    ? driver.pay_failed_attempt
    : (route.pay_failed_attempt_override ?? driver.pay_failed_attempt);

  const amount_per_failed_attempt = useDefault
    ? driver.amount_per_failed_attempt
    : route.amount_per_failed_override;

  // 5. Contar entregas e tentativas
  const orders: { id: string; status: string }[] = (route as any).delivery_route_orders || [];
  const completed_deliveries = orders.filter(o => o.status === 'Entregue').length;
  const paid_failed_attempts = pay_failed_attempt
    ? orders.filter(o => o.status === 'Não Entregue').length
    : 0;

  // 6. Calcular
  const result = calculateDriverCompensation({
    compensation_model,
    completed_deliveries,
    paid_failed_attempts,
    amount_per_delivery,
    amount_per_route,
    daily_amount,
    pay_failed_attempt,
    amount_per_failed_attempt,
    manual_adjustment: existingComp ? undefined : 0,
  });

  const now = new Date().toISOString();

  const compensationData = {
    route_id: routeId,
    driver_id: route.driver_id,
    // Snapshot da regra
    compensation_model,
    amount_per_delivery,
    amount_per_route,
    daily_amount,
    pay_failed_attempt,
    amount_per_failed_attempt,
    // Contagens
    completed_deliveries,
    paid_failed_attempts,
    // Valores calculados
    base_amount: result.base_amount,
    deliveries_amount: result.deliveries_amount,
    failed_attempts_amount: result.failed_attempts_amount,
    calculated_amount: result.calculated_amount,
    final_amount: result.final_amount,
    status: 'open' as CompensationStatus,
    updated_at: now,
  };

  // 7. Upsert
  const { data: saved, error: saveError } = await supabase
    .from('driver_route_compensations')
    .upsert(compensationData, { onConflict: 'route_id,driver_id' })
    .select()
    .single();

  if (saveError) throw saveError;
  return saved as DriverRouteCompensation;
};

// ── Ajuste Manual ──────────────────────────────────────────────────────────────

export const updateCompensationAdjustment = async (params: {
  compensationId: string;
  manualAdjustment: number;
  adjustmentReason?: string;
}): Promise<void> => {
  const supabase = await createClient();

  const { data: comp, error: fetchError } = await supabase
    .from('driver_route_compensations')
    .select('calculated_amount, status')
    .eq('id', params.compensationId)
    .single();

  if (fetchError || !comp) throw new Error('Remuneração não encontrada');
  if (comp.status === 'paid') throw new Error('Não é possível alterar remuneração paga');

  const final_amount = comp.calculated_amount + params.manualAdjustment;
  if (final_amount < 0) throw new Error('O valor final não pode ser negativo');

  const { error } = await supabase
    .from('driver_route_compensations')
    .update({
      manual_adjustment:  params.manualAdjustment,
      adjustment_reason:  params.adjustmentReason || null,
      final_amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.compensationId);

  if (error) throw error;
};

// ── Aprovação ──────────────────────────────────────────────────────────────────

export const approveCompensation = async (compensationId: string): Promise<void> => {
  const supabase = await createClient();
  const { error } = await supabase
    .from('driver_route_compensations')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', compensationId)
    .eq('status', 'open');

  if (error) throw error;
};

// ── Pagamento ──────────────────────────────────────────────────────────────────

export const markCompensationAsPaid = async (params: {
  compensationId: string;
  notes?: string;
}): Promise<void> => {
  const supabase = await createClient();
  const { error } = await supabase
    .from('driver_route_compensations')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      notes: params.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.compensationId)
    .eq('status', 'approved');

  if (error) throw error;
};

// ── Stats de Resumo ────────────────────────────────────────────────────────────

export interface DriversStats {
  total_active: number;
  total_in_route: number;
  total_open_amount: number;
  total_paid_this_month: number;
}

export const fetchDriversStats = async (): Promise<DriversStats> => {
  const supabase = await createClient();

  const [activeRes, inRouteRes, compensationsRes] = await Promise.all([
    supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('delivery_routes').select('driver_id').eq('status', 'Em Andamento').not('driver_id', 'is', null),
    supabase.from('driver_route_compensations').select('final_amount, status, paid_at'),
  ]);

  const inRouteDriverIds = new Set(
    (inRouteRes.data || []).map((r: any) => r.driver_id).filter(Boolean)
  );

  const comps = compensationsRes.data || [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let total_open_amount = 0;
  let total_paid_this_month = 0;

  comps.forEach((c: any) => {
    if (c.status === 'open' || c.status === 'approved') {
      total_open_amount += Number(c.final_amount) || 0;
    }
    if (c.status === 'paid' && c.paid_at && c.paid_at >= monthStart) {
      total_paid_this_month += Number(c.final_amount) || 0;
    }
  });

  return {
    total_active: activeRes.count || 0,
    total_in_route: inRouteDriverIds.size,
    total_open_amount,
    total_paid_this_month,
  };
};

// ── Helper interno ─────────────────────────────────────────────────────────────

function sanitizeDriverInput(input: DriverFormInput) {
  return {
    full_name:                input.full_name.trim(),
    phone:                    input.phone.replace(/\D/g, ''),
    city:                     input.city?.trim() || null,
    vehicle_type:             input.vehicle_type || null,
    vehicle_model:            input.vehicle_model?.trim() || null,
    vehicle_plate:            input.vehicle_plate?.toUpperCase().trim() || null,
    status:                   input.status,
    notes:                    input.notes?.trim() || null,
    compensation_model:       input.compensation_model,
    amount_per_delivery:      input.amount_per_delivery ?? null,
    amount_per_route:         input.amount_per_route ?? null,
    daily_amount:             input.daily_amount ?? null,
    pay_failed_attempt:       input.pay_failed_attempt,
    amount_per_failed_attempt:input.pay_failed_attempt
      ? (input.amount_per_failed_attempt ?? null)
      : null,
  };
}
