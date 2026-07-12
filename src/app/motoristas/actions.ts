'use server';

import { revalidatePath } from 'next/cache';
import type { DriverFormInput, DriverStatus } from '@/models/types';
import {
  createDriver,
  updateDriver,
  updateDriverStatus,
  approveCompensation,
  markCompensationAsPaid,
  updateCompensationAdjustment,
} from '@/services/driversService';

export async function createDriverAction(input: DriverFormInput) {
  try {
    const driver = await createDriver(input);
    revalidatePath('/motoristas');
    return driver;
  } catch (error) {
    console.error('Erro ao criar motorista:', error);
    throw new Error('Não foi possível salvar o motorista.');
  }
}

export async function updateDriverAction(driverId: string, input: DriverFormInput) {
  try {
    const driver = await updateDriver(driverId, input);
    revalidatePath('/motoristas');
    revalidatePath('/rotas');
    return driver;
  } catch (error) {
    console.error('Erro ao atualizar motorista:', error);
    throw new Error('Não foi possível atualizar o motorista.');
  }
}

export async function updateDriverStatusAction(driverId: string, status: DriverStatus) {
  try {
    await updateDriverStatus(driverId, status);
    revalidatePath('/motoristas');
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar status do motorista:', error);
    throw new Error('Não foi possível atualizar o status.');
  }
}

export async function updateCompensationAdjustmentAction(params: {
  compensationId: string;
  manualAdjustment: number;
  adjustmentReason?: string;
}) {
  try {
    await updateCompensationAdjustment(params);
    revalidatePath('/motoristas');
    revalidatePath('/rotas');
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao ajustar remuneração:', error);
    throw new Error(error.message || 'Não foi possível ajustar a remuneração.');
  }
}

export async function approveCompensationAction(compensationId: string) {
  try {
    await approveCompensation(compensationId);
    revalidatePath('/motoristas');
    return { success: true };
  } catch (error) {
    console.error('Erro ao aprovar remuneração:', error);
    throw new Error('Não foi possível aprovar a remuneração.');
  }
}

export async function markCompensationAsPaidAction(params: {
  compensationId: string;
  notes?: string;
}) {
  try {
    await markCompensationAsPaid(params);
    revalidatePath('/motoristas');
    return { success: true };
  } catch (error) {
    console.error('Erro ao marcar remuneração como paga:', error);
    throw new Error('Não foi possível registrar o pagamento.');
  }
}
