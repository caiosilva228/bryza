'use server';

import { revalidatePath } from 'next/cache';
import * as produtoService from '@/services/produtos';
import { Kit, Produto } from '@/models/types';
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

export interface KitInput {
  id?: string;
  nome: string;
  descricao?: string | null;
  preco_venda: number;
  preco_referencia?: number | null;
  imagem_url?: string | null;
  ativo: boolean;
  ativo_loja: boolean;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  itens: Array<{ produto_id: string; quantidade: number }>;
}

export async function fetchKitsAction(): Promise<{ success: boolean; data?: Kit[]; error?: string }> {
  try {
    const admin = await checkAdminAccess();
    const { data, error } = await admin
      .from('kits')
      .select(`*, itens:kit_itens(*, produto:produtos(id, nome_produto, preco_venda, imagem_url, estoque_atual, estoque_reservado, ativo))`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true, data: (data || []) as Kit[] };
  } catch (error: any) {
    console.error('Erro ao buscar kits:', error);
    return { success: false, error: error?.message || 'Erro ao carregar kits.' };
  }
}

export async function saveKitAction(input: KitInput): Promise<{ success: boolean; data?: Kit; error?: string }> {
  try {
    const admin = await checkAdminAccess();
    const nome = input.nome.trim();
    const itens = input.itens || [];
    if (!nome || !Number.isFinite(input.preco_venda) || input.preco_venda < 0 || itens.length === 0) {
      return { success: false, error: 'Informe nome, preco e pelo menos um componente.' };
    }
    if (itens.some(item => !item.produto_id || !Number.isInteger(item.quantidade) || item.quantidade < 1)) {
      return { success: false, error: 'As quantidades dos componentes devem ser inteiras e positivas.' };
    }
    if (new Set(itens.map(item => item.produto_id)).size !== itens.length) {
      return { success: false, error: 'Um produto nao pode aparecer duas vezes no mesmo kit.' };
    }
    if (input.vigencia_inicio && input.vigencia_fim && input.vigencia_fim < input.vigencia_inicio) {
      return { success: false, error: 'A data final nao pode ser anterior a inicial.' };
    }

    let previousKitId: string | null = null;
    if (input.id) {
      const { data: previousKit, error: previousKitError } = await admin
        .from('kits')
        .select('id')
        .eq('id', input.id)
        .maybeSingle();
      if (previousKitError) throw previousKitError;
      if (!previousKit) return { success: false, error: 'Kit nao encontrado.' };
      previousKitId = previousKit.id;
    }

    // Kits publicados sao imutaveis para o checkout: uma edicao cria uma nova
    // versao (novo id) e invalida qualquer carrinho que ainda carregue a antiga.
    const payload = {
      id: crypto.randomUUID(),
      nome,
      descricao: input.descricao?.trim() || null,
      preco_venda: Number(input.preco_venda.toFixed(2)),
      preco_referencia: input.preco_referencia == null ? null : Number(input.preco_referencia.toFixed(2)),
      imagem_url: input.imagem_url?.trim() || null,
      ativo: input.ativo,
      ativo_loja: input.ativo_loja,
      vigencia_inicio: input.vigencia_inicio || null,
      vigencia_fim: input.vigencia_fim || null,
      updated_at: new Date().toISOString(),
    };

    const { data: kit, error: kitError } = await admin
      .from('kits')
      .insert(payload)
      .select()
      .single();
    if (kitError || !kit) throw kitError || new Error('Kit nao retornado.');

    const { error: deleteItemsError } = await admin.from('kit_itens').delete().eq('kit_id', kit.id);
    if (deleteItemsError) throw deleteItemsError;
    const { error: insertItemsError } = await admin.from('kit_itens').insert(
      itens.map(item => ({ kit_id: kit.id, produto_id: item.produto_id, quantidade: item.quantidade })),
    );
    if (insertItemsError) throw insertItemsError;

    if (previousKitId) {
      const { error: retirePreviousError } = await admin
        .from('kits')
        .update({ ativo: false, ativo_loja: false, updated_at: new Date().toISOString() })
        .eq('id', previousKitId);
      if (retirePreviousError) throw retirePreviousError;
    }

    const { data: fullKit, error: fullKitError } = await admin
      .from('kits')
      .select('*, itens:kit_itens(*, produto:produtos(id, nome_produto, preco_venda, imagem_url, estoque_atual, estoque_reservado, ativo))')
      .eq('id', kit.id)
      .single();
    if (fullKitError) throw fullKitError;
    revalidatePath('/produtos');
    revalidatePath('/loja');
    return { success: true, data: fullKit as Kit };
  } catch (error: any) {
    console.error('Erro ao salvar kit:', error);
    return { success: false, error: error?.message || 'Erro ao salvar kit.' };
  }
}

export async function toggleStatusKitAction(id: string, ativo: boolean) {
  try {
    const admin = await checkAdminAccess();
    const { error } = await admin.from('kits').update({ ativo, ativo_loja: ativo ? undefined : false, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    revalidatePath('/produtos');
    revalidatePath('/loja');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Erro ao alterar status do kit.' };
  }
}

export async function toggleStatusKitLojaAction(id: string, ativo_loja: boolean) {
  try {
    const admin = await checkAdminAccess();
    const { data: kit } = await admin.from('kits').select('ativo').eq('id', id).maybeSingle();
    if (ativo_loja && !kit?.ativo) return { success: false, error: 'Ative o kit antes de publica-lo na loja.' };
    const { error } = await admin.from('kits').update({ ativo_loja, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    revalidatePath('/produtos');
    revalidatePath('/loja');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Erro ao alterar visibilidade do kit.' };
  }
}

export async function deleteKitAction(id: string) {
  try {
    const admin = await checkAdminAccess();
    const { error } = await admin.from('kits').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/produtos');
    revalidatePath('/loja');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Erro ao excluir kit.' };
  }
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

export async function toggleStatusProdutoLoja(id: string, ativo_loja: boolean) {
  try {
    await produtoService.toggleProdutoAtivoLoja(id, ativo_loja);
    revalidatePath('/produtos');
    revalidatePath('/loja');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro ao alterar visibilidade na loja' };
  }
}

export async function fetchCategoriasAction() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('categorias_produtos')
      .select('*')
      .order('ordem', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Erro ao buscar categorias:', error);
    return { success: false, error: error.message || 'Erro ao carregar categorias' };
  }
}

export async function saveCategoriaAction(categoria: { id?: string; nome: string; icone?: string; cor?: string; ativo_loja?: boolean; ordem?: number }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('categorias_produtos')
      .upsert(categoria)
      .select()
      .single();

    if (error) throw error;
    revalidatePath('/produtos');
    revalidatePath('/loja');
    return { success: true, data };
  } catch (error: any) {
    console.error('Erro ao salvar categoria:', error);
    return { success: false, error: error.message || 'Erro ao salvar categoria' };
  }
}

export async function toggleStatusCategoriaLojaAction(id: string, ativo_loja: boolean) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('categorias_produtos')
      .update({ ativo_loja })
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/produtos');
    revalidatePath('/loja');
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao alterar status da categoria:', error);
    return { success: false, error: error.message || 'Erro ao alterar categoria' };
  }
}

export async function deleteCategoriaAction(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('categorias_produtos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/produtos');
    revalidatePath('/loja');
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao excluir categoria:', error);
    return { success: false, error: error.message || 'Erro ao excluir categoria' };
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
