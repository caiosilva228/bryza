import { createClient } from '@/utils/supabase/server';
import { Venda } from '@/models/types';

interface VendaWithCliente extends Venda {
  cliente: {
    nome: string;
  };
}

export const getVendas = async (startDate?: string, endDate?: string): Promise<VendaWithCliente[]> => {
  const supabase = await createClient();
  
  let query = supabase
    .from('vendas')
    .select(`
      *,
      cliente:clientes(nome)
    `);

  if (startDate) {
    query = query.gte('data_venda', `${startDate}T00:00:00`);
  }
  if (endDate) {
    query = query.lte('data_venda', `${endDate}T23:59:59.999`);
  }

  const { data, error } = await query.order('data_venda', { ascending: false });

  if (error) {
    console.error('Erro ao buscar vendas:', error);
    return [];
  }

  return data as VendaWithCliente[];
};

export interface VendaWithItens extends Venda {
  venda_itens: {
    id: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
    produto: {
      nome_produto: string;
    };
  }[];
}

export const getVendasByCliente = async (clienteId: string): Promise<VendaWithItens[]> => {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('vendas')
    .select(`
      *,
      venda_itens(
        id,
        quantidade,
        preco_unitario,
        subtotal,
        produto:produtos(nome_produto)
      )
    `)
    .eq('cliente_id', clienteId)
    .order('data_venda', { ascending: false });

  if (error) {
    console.error('Erro ao buscar vendas do cliente:', error);
    return [];
  }

  return data as any[];
};
