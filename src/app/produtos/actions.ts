'use server';

import { revalidatePath } from 'next/cache';
import * as produtoService from '@/services/produtos';
import { Produto } from '@/models/types';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const PRODUCT_IMAGES_BUCKET = 'product-images';

export interface ProductImageLibraryItem {
  name: string;
  publicUrl: string;
  createdAt: string | null;
  size: number;
  usedBy: Array<{
    id: string;
    name: string;
  }>;
}

async function checkAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Não autorizado.');
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.ativo !== true || profile.role !== 'admin') {
    throw new Error('Apenas administradores ativos podem gerenciar a biblioteca de imagens.');
  }

  return admin;
}

export async function fetchProdutos() {
  return await produtoService.getProdutos();
}

export async function saveProduto(produto: Partial<Produto>) {
  try {
    const data = await produtoService.upsertProduto(produto);
    revalidatePath('/produtos');
    revalidatePath('/estoque'); // Revalida estoque pois produtos aparecem lá
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Erro ao salvar produto' };
  }
}

export async function toggleStatusProduto(id: string, ativo: boolean) {
  try {
    await produtoService.toggleProdutoAtivo(id, ativo);
    revalidatePath('/produtos');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro ao alterar status do produto' };
  }
}

export async function fetchProductImageLibrary(): Promise<{
  success: boolean;
  data?: ProductImageLibraryItem[];
  error?: string;
}> {
  try {
    const admin = await checkAdminAccess();
    const { data: files, error: listError } = await admin.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (listError) {
      console.error('Erro ao listar imagens de produtos:', listError);
      return { success: false, error: 'Não foi possível carregar a biblioteca de imagens.' };
    }

    const imageFiles = (files ?? []).filter((file) => file.id !== null);
    const items = imageFiles.map((file) => {
      const { data } = admin.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(file.name);
      return {
        name: file.name,
        publicUrl: data.publicUrl,
        createdAt: file.created_at ?? null,
        size: Number(file.metadata?.size ?? 0),
        usedBy: [] as ProductImageLibraryItem['usedBy'],
      };
    });

    if (items.length === 0) {
      return { success: true, data: [] };
    }

    const { data: products, error: productsError } = await admin
      .from('produtos')
      .select('id, nome_produto, imagem_url')
      .in(
        'imagem_url',
        items.map((item) => item.publicUrl)
      );

    if (productsError) {
      console.error('Erro ao verificar uso das imagens:', productsError);
      return { success: false, error: 'Não foi possível verificar o uso das imagens.' };
    }

    const productsByImage = new Map<string, ProductImageLibraryItem['usedBy']>();
    for (const product of products ?? []) {
      if (!product.imagem_url) continue;
      const current = productsByImage.get(product.imagem_url) ?? [];
      current.push({ id: product.id, name: product.nome_produto });
      productsByImage.set(product.imagem_url, current);
    }

    return {
      success: true,
      data: items.map((item) => ({
        ...item,
        usedBy: productsByImage.get(item.publicUrl) ?? [],
      })),
    };
  } catch (error) {
    console.error('Erro ao carregar biblioteca de imagens:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao carregar a biblioteca de imagens.',
    };
  }
}

export async function deleteProductImage(imageName: string): Promise<{
  success: boolean;
  deletedUrl?: string;
  affectedProductIds?: string[];
  error?: string;
}> {
  try {
    if (!imageName || imageName.includes('..')) {
      return { success: false, error: 'Imagem inválida.' };
    }

    const admin = await checkAdminAccess();
    const { data: publicUrlData } = admin.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(imageName);
    const publicUrl = publicUrlData.publicUrl;

    const { data: referencedProducts, error: referencesError } = await admin
      .from('produtos')
      .select('id')
      .eq('imagem_url', publicUrl);

    if (referencesError) {
      console.error('Erro ao localizar produtos vinculados à imagem:', referencesError);
      return { success: false, error: 'Não foi possível verificar os produtos vinculados.' };
    }

    const affectedProductIds = (referencedProducts ?? []).map((product) => product.id);

    if (affectedProductIds.length > 0) {
      const { error: clearReferencesError } = await admin
        .from('produtos')
        .update({ imagem_url: null })
        .in('id', affectedProductIds);

      if (clearReferencesError) {
        console.error('Erro ao remover referências da imagem:', clearReferencesError);
        return { success: false, error: 'Não foi possível desvincular a imagem dos produtos.' };
      }
    }

    const { error: removeError } = await admin.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([imageName]);

    if (removeError) {
      if (affectedProductIds.length > 0) {
        await admin.from('produtos').update({ imagem_url: publicUrl }).in('id', affectedProductIds);
      }
      console.error('Erro ao excluir imagem do armazenamento:', removeError);
      return { success: false, error: 'Não foi possível excluir a imagem.' };
    }

    revalidatePath('/produtos');
    revalidatePath('/estoque');

    return {
      success: true,
      deletedUrl: publicUrl,
      affectedProductIds,
    };
  } catch (error) {
    console.error('Erro ao excluir imagem da biblioteca:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao excluir a imagem.',
    };
  }
}
