'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PromotionalMaterialItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string;
  file_name: string | null;
  file_size_bytes: number | null;
  file_type: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getAdminPromotionalMaterialsAction(): Promise<{
  success: boolean;
  materials?: PromotionalMaterialItem[];
  error?: string;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('promotional_materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar materiais de divulgação:', error);
      return { success: false, error: 'Erro ao carregar materiais.' };
    }

    return { success: true, materials: (data || []) as PromotionalMaterialItem[] };
  } catch (err: any) {
    console.error('Erro inesperado em getAdminPromotionalMaterialsAction:', err);
    return { success: false, error: 'Erro inesperado ao carregar materiais.' };
  }
}

export async function createPromotionalMaterialAction(payload: {
  title: string;
  description?: string;
  category: string;
  file_url: string;
  file_name?: string;
  file_size_bytes?: number;
  file_type?: string;
}): Promise<{ success: boolean; data?: PromotionalMaterialItem; error?: string }> {
  try {
    if (!payload.title || !payload.title.trim()) {
      return { success: false, error: 'O título do material é obrigatório.' };
    }
    if (!payload.file_url || !payload.file_url.trim()) {
      return { success: false, error: 'O arquivo ou link do material é obrigatório.' };
    }

    const { data, error } = await supabaseAdmin
      .from('promotional_materials')
      .insert({
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        category: payload.category?.trim() || 'Geral',
        file_url: payload.file_url.trim(),
        file_name: payload.file_name?.trim() || null,
        file_size_bytes: payload.file_size_bytes || null,
        file_type: payload.file_type?.trim() || null,
        active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao cadastrar material:', error);
      return { success: false, error: 'Erro ao cadastrar material de divulgação.' };
    }

    revalidatePath('/embaixadores/materiais');
    revalidatePath('/embaixador/materiais');
    return { success: true, data: data as PromotionalMaterialItem };
  } catch (err: any) {
    console.error('Erro inesperado em createPromotionalMaterialAction:', err);
    return { success: false, error: 'Erro ao criar material de divulgação.' };
  }
}

export async function updatePromotionalMaterialAction(
  id: string,
  payload: {
    title?: string;
    description?: string;
    category?: string;
    active?: boolean;
    file_url?: string;
    file_name?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.title !== undefined) updateData.title = payload.title.trim();
    if (payload.description !== undefined) updateData.description = payload.description.trim() || null;
    if (payload.category !== undefined) updateData.category = payload.category.trim();
    if (payload.active !== undefined) updateData.active = payload.active;
    if (payload.file_url !== undefined) updateData.file_url = payload.file_url.trim();
    if (payload.file_name !== undefined) updateData.file_name = payload.file_name.trim();

    const { error } = await supabaseAdmin
      .from('promotional_materials')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar material:', error);
      return { success: false, error: 'Erro ao atualizar o material.' };
    }

    revalidatePath('/embaixadores/materiais');
    revalidatePath('/embaixador/materiais');
    return { success: true };
  } catch (err: any) {
    console.error('Erro inesperado em updatePromotionalMaterialAction:', err);
    return { success: false, error: 'Erro ao atualizar o material.' };
  }
}

export async function deletePromotionalMaterialAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('promotional_materials')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir material:', error);
      return { success: false, error: 'Erro ao excluir o material.' };
    }

    revalidatePath('/embaixadores/materiais');
    revalidatePath('/embaixador/materiais');
    return { success: true };
  } catch (err: any) {
    console.error('Erro inesperado em deletePromotionalMaterialAction:', err);
    return { success: false, error: 'Erro ao excluir o material.' };
  }
}

export async function uploadPromotionalFileAction(formData: FormData): Promise<{
  success: boolean;
  file_url?: string;
  file_name?: string;
  file_size_bytes?: number;
  file_type?: string;
  error?: string;
}> {
  try {
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File)) {
      return { success: false, error: 'Nenhum arquivo enviado.' };
    }

    const fileExt = file.name.split('.').pop() || '';
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${Date.now()}_${cleanFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('promotional-materials')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

    if (uploadErr) {
      console.error('Erro no upload para Supabase Storage:', uploadErr);
      return { success: false, error: 'Não foi possível salvar o arquivo no servidor.' };
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('promotional-materials')
      .getPublicUrl(storagePath);

    return {
      success: true,
      file_url: publicUrlData.publicUrl,
      file_name: file.name,
      file_size_bytes: file.size,
      file_type: file.type,
    };
  } catch (err: any) {
    console.error('Erro no upload de arquivo de divulgação:', err);
    return { success: false, error: 'Erro ao processar upload do arquivo.' };
  }
}
