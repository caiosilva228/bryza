'use server';

import { revalidatePath } from 'next/cache';
import * as routesService from '@/services/routesService';
import { RouteStatus, RouteOrderStatus, DeliveryProblemType, DeliveryNextAction } from '@/models/types';

export async function createRouteAction(input: routesService.CreateRouteInput) {
  const route = await routesService.createDeliveryRoute(input);
  revalidatePath('/rotas');
  revalidatePath('/logistica');
  return route;
}

export async function updateRouteStatusAction(id: string, status: RouteStatus) {
  await routesService.updateRouteStatus(id, status);
  revalidatePath('/rotas');
  revalidatePath('/logistica');
}

export async function startRouteAction(routeId: string) {
  await routesService.startRoute(routeId);
  revalidatePath('/rotas');
  revalidatePath('/logistica');
}

export async function finishRouteAction(routeId: string) {
  await routesService.finishRoute(routeId);
  revalidatePath('/rotas');
  revalidatePath('/logistica');
}

export async function cancelRouteAction(routeId: string) {
  await routesService.cancelRoute(routeId);
  revalidatePath('/rotas');
  revalidatePath('/logistica');
}

export async function reorderRouteOrdersAction(routeId: string, orders: { routeOrderId: string, sequence: number }[]) {
  await routesService.reorderRouteOrders(routeId, orders);
  revalidatePath('/rotas');
}

export async function markRouteOrderAsDeliveredAction(routeId: string, routeOrderId: string, orderId: string) {
  await routesService.markRouteOrderAsDelivered(routeId, routeOrderId, orderId);
  revalidatePath('/rotas');
  revalidatePath('/logistica');
}

export async function markRouteOrderAsNotDeliveredAction(
  routeId: string, routeOrderId: string, orderId: string,
  reason: string, notes: string, nextAction: 'back_to_ready' | 'keep_in_route' | 'cancel_order'
) {
  await routesService.markRouteOrderAsNotDelivered({
    routeId, routeOrderId, orderId, reason, notes, nextAction
  });
  revalidatePath('/rotas');
  revalidatePath('/logistica');
}

export async function getRouteByIdAction(id: string) {
  return await routesService.fetchRouteById(id);
}
