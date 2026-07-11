import { createClient } from '@/utils/supabase/server';
import { 
  DeliveryRoute, 
  RouteOrder, 
  RouteStatus, 
  RouteOrderStatus,
  Pedido 
} from '@/models/types';

export interface CreateRouteInput {
  name: string;
  date: string;
  driver_id?: string;
  driver_name?: string;
  city?: string;
  neighborhoods?: string[];
  departure_time?: string;
  notes?: string;
  orderIds: string[];
}

export interface UpdateRouteInput {
  name?: string;
  date?: string;
  driver_id?: string;
  driver_name?: string;
  city?: string;
  neighborhoods?: string[];
  departure_time?: string;
  notes?: string;
}

export const fetchRoutes = async (filters?: {
  status?: string;
  driver_id?: string;
  driver_name?: string;
  dateFrom?: string;
  dateTo?: string;
  city?: string;
}) => {
  const supabase = await createClient();
  let query = supabase
    .from('delivery_routes')
    .select(`
      *,
      delivery_route_orders(id)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'todos') {
    query = query.eq('status', filters.status);
  }
  if (filters?.driver_id) {
    query = query.eq('driver_id', filters.driver_id);
  }
  if (filters?.driver_name) {
    query = query.ilike('driver_name', `%${filters.driver_name}%`);
  }
  if (filters?.city) {
    query = query.ilike('city', `%${filters.city}%`);
  }
  if (filters?.dateFrom) {
    query = query.gte('date', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('date', filters.dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data.map(route => ({
    ...route,
    totalOrders: route.delivery_route_orders?.length || 0,
  })) as DeliveryRoute[];
};

export const fetchRouteById = async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('delivery_routes')
    .select(`
      *,
      delivery_route_orders(
        *,
        pedido:pedidos(
          *,
          cliente:clientes(nome, telefone, bairro, cidade, estado, endereco, numero),
          vendedor:profiles(nome),
          itens:pedido_itens(
            *,
            produto:produtos(codigo_produto, nome_produto)
          )
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;

  const routeDetails = data;
  const routeOrders = (routeDetails.delivery_route_orders as any[]).sort((a, b) => a.sequence - b.sequence);
  
  let totalAmount = 0;
  let totalDelivered = 0;
  let totalPending = 0;
  let totalProblems = 0;

  routeOrders.forEach((ro: any) => {
    const amount = ro.pedido?.valor_total || 0;
    totalAmount += amount;
    
    if (ro.status === 'Entregue') {
      totalDelivered++;
    } else if (ro.status === 'Não Entregue' || ro.status === 'Cancelado') {
      totalProblems++;
    } else {
      totalPending++;
    }
  });

  return {
    ...(routeDetails as DeliveryRoute),
    delivery_route_orders: routeOrders as RouteOrder[],
    totalOrders: routeOrders.length,
    totalAmount,
    totalDelivered,
    totalPending,
    totalProblems
  };
};

export const fetchAvailableOrdersForRoute = async () => {
  const supabase = await createClient();
  
  // Buscar apenas pedidos "pronto_para_entrega"
  const { data: pedidos, error: pedidosError } = await supabase
    .from('pedidos')
    .select(`
      *,
      cliente:clientes(nome, telefone, bairro, cidade, estado, endereco, numero),
      vendedor:profiles(nome),
      itens:pedido_itens(
        *,
        produto:produtos(codigo_produto, nome_produto)
      )
    `)
    .eq('status_pedido', 'pronto_para_entrega')
    .order('created_at', { ascending: false });

  if (pedidosError) throw pedidosError;

  // Filtrar os pedidos que já estão em rotas não finalizadas (Planejada, Separando Produtos, Pronta para Sair, Em Andamento)
  // Como constraint garantimos unique_active_order_route, podemos checar se order_id está na route_orders 
  // e se a route ligada a ele está ativa.
  const { data: routeOrders, error: roError } = await supabase
    .from('delivery_route_orders')
    .select('order_id, delivery_routes(status)')
    .in('status', ['Pendente', 'Em Rota']); // Simplificado para orders ativas

  if (roError) throw roError;

  const activeOrderIds = new Set(routeOrders.map(ro => ro.order_id));
  const availablePedidos = pedidos.filter(p => !activeOrderIds.has(p.id));

  return availablePedidos as Pedido[];
};

export const createDeliveryRoute = async (input: CreateRouteInput) => {
  const supabase = await createClient();
  
  const routeData = {
    name: input.name,
    date: input.date,
    status: 'Planejada' as RouteStatus,
    driver_id: input.driver_id,
    driver_name: input.driver_name,
    city: input.city,
    neighborhoods: input.neighborhoods,
    departure_time: input.departure_time,
    notes: input.notes,
  };

  const { data: newRoute, error: routeError } = await supabase
    .from('delivery_routes')
    .insert(routeData)
    .select()
    .single();

  if (routeError) throw routeError;

  if (input.orderIds && input.orderIds.length > 0) {
    const routeOrders = input.orderIds.map((orderId, index) => ({
      route_id: newRoute.id,
      order_id: orderId,
      sequence: index + 1,
      status: 'Pendente' as RouteOrderStatus,
    }));

    const { error: roError } = await supabase
      .from('delivery_route_orders')
      .insert(routeOrders);

    if (roError) {
      // Rollback manual (pois não estamos num rpc)
      await supabase.from('delivery_routes').delete().eq('id', newRoute.id);
      throw roError;
    }
  }

  return newRoute as DeliveryRoute;
};

export const updateDeliveryRoute = async (id: string, input: UpdateRouteInput) => {
  const supabase = await createClient();
  const { error } = await supabase
    .from('delivery_routes')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
};

export const updateRouteStatus = async (id: string, status: RouteStatus) => {
  const supabase = await createClient();
  
  const updates: any = { 
    status, 
    updated_at: new Date().toISOString() 
  };

  if (status === 'Em Andamento') {
    updates.started_at = new Date().toISOString();
  } else if (status === 'Finalizada' || status === 'Finalizada com Pendências') {
    updates.finished_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('delivery_routes')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
};

export const startRoute = async (routeId: string) => {
  const supabase = await createClient();

  // 1. Atualizar a rota para Em Andamento
  await updateRouteStatus(routeId, 'Em Andamento');

  // 2. Buscar os pedidos dessa rota que estão pendentes
  const { data: routeOrders, error: getError } = await supabase
    .from('delivery_route_orders')
    .select('id, order_id')
    .eq('route_id', routeId)
    .eq('status', 'Pendente');

  if (getError) throw getError;
  if (!routeOrders || routeOrders.length === 0) return;

  const orderIds = routeOrders.map(ro => ro.order_id);
  const routeOrderIds = routeOrders.map(ro => ro.id);

  // 3. Atualizar route_orders para 'Em Rota'
  const { error: roUpdateError } = await supabase
    .from('delivery_route_orders')
    .update({ status: 'Em Rota', updated_at: new Date().toISOString() })
    .in('id', routeOrderIds);

  if (roUpdateError) throw roUpdateError;

  // 4. Atualizar pedidos no sistema principal para 'em_rota'
  const { error: pedidosUpdateError } = await supabase
    .from('pedidos')
    .update({ 
      status_pedido: 'em_rota', 
      delivery_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString() 
    })
    .in('id', orderIds)
    .eq('status_pedido', 'pronto_para_entrega'); // Só muda se ainda estiver pronto

  if (pedidosUpdateError) throw pedidosUpdateError;
};

export const cancelRoute = async (routeId: string) => {
  const supabase = await createClient();
  
  await updateRouteStatus(routeId, 'Cancelada');

  // Cancelar todos route_orders que estão pendentes ou em rota
  const { error: roUpdateError } = await supabase
    .from('delivery_route_orders')
    .update({ status: 'Cancelado', updated_at: new Date().toISOString() })
    .eq('route_id', routeId)
    .in('status', ['Pendente', 'Em Rota']);
    
  if (roUpdateError) throw roUpdateError;
};

export const markRouteOrderAsDelivered = async (routeId: string, routeOrderId: string, orderId: string) => {
  const supabase = await createClient();
  
  // Atualiza route_order
  const { error: roError } = await supabase
    .from('delivery_route_orders')
    .update({ status: 'Entregue', updated_at: new Date().toISOString() })
    .eq('id', routeOrderId);
    
  if (roError) throw roError;

  // Atualiza pedido
  const { error: pError } = await supabase
    .from('pedidos')
    .update({ 
      status_pedido: 'entregue', 
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString() 
    })
    .eq('id', orderId);
    
  if (pError) throw pError;
};

export const markRouteOrderAsNotDelivered = async (params: {
  routeId: string;
  routeOrderId: string;
  orderId: string;
  reason: string;
  notes: string;
  nextAction: 'back_to_ready' | 'keep_in_route' | 'cancel_order';
}) => {
  const supabase = await createClient();
  
  // Atualiza route_order
  const { error: roError } = await supabase
    .from('delivery_route_orders')
    .update({ 
      status: 'Não Entregue', 
      notes: `${params.reason}: ${params.notes}`,
      updated_at: new Date().toISOString() 
    })
    .eq('id', params.routeOrderId);
    
  if (roError) throw roError;

  // Atualiza pedido
  const updates: any = {
    delivery_problem_type: params.reason,
    delivery_notes: params.notes,
    updated_at: new Date().toISOString()
  };

  if (params.nextAction === 'back_to_ready') {
    updates.status_pedido = 'pronto_para_entrega';
  } else if (params.nextAction === 'cancel_order') {
    updates.status_pedido = 'cancelado';
  }

  const { error: pError } = await supabase
    .from('pedidos')
    .update(updates)
    .eq('id', params.orderId);
    
  if (pError) throw pError;
};

export const reorderRouteOrders = async (routeId: string, orders: { routeOrderId: string, sequence: number }[]) => {
  const supabase = await createClient();
  
  for (const o of orders) {
    const { error } = await supabase
      .from('delivery_route_orders')
      .update({ sequence: o.sequence, updated_at: new Date().toISOString() })
      .eq('id', o.routeOrderId);
      
    if (error) throw error;
  }
};

export const finishRoute = async (routeId: string) => {
  const supabase = await createClient();
  
  // Verifica se há alguma pendência
  const { data: pendingOrders, error: pError } = await supabase
    .from('delivery_route_orders')
    .select('id')
    .eq('route_id', routeId)
    .in('status', ['Pendente', 'Em Rota', 'Não Entregue', 'Cancelado']);
    
  if (pError) throw pError;

  const status = (pendingOrders && pendingOrders.length > 0) ? 'Finalizada com Pendências' : 'Finalizada';
  
  await updateRouteStatus(routeId, status);
};
