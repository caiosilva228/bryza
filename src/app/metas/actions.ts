'use server';

import { revalidatePath } from 'next/cache';
import { MetasService } from '@/services/metas';

export async function salvarMetaAction(formData: FormData) {
  const valor = parseFloat(formData.get('valor_meta') as string);
  const periodo = formData.get('periodo') as string;

  if (!valor || isNaN(valor) || valor <= 0) {
    throw new Error('Valor da meta inválido.');
  }

  await MetasService.salvarMeta(valor, periodo);
  revalidatePath('/');
  revalidatePath('/metas');
}
