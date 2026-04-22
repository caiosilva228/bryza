-- Adicionar coluna usuario_id à tabela estoque_movimentacao
ALTER TABLE public.estoque_movimentacao 
ADD COLUMN usuario_id UUID REFERENCES public.profiles(id);

-- Atualizar trigger de venda paga para registrar o vendedor como responsável pela movimentação (opcional, pode ser o auth.uid())
CREATE OR REPLACE FUNCTION public.processar_estoque_venda_paga()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Se mudou de pendente para pago
  IF NEW.status_venda = 'pago' AND OLD.status_venda != 'pago' THEN
    -- Para cada item da venda
    FOR v_item IN (SELECT produto_id, quantidade FROM venda_itens WHERE venda_id = NEW.id) LOOP
      -- Inserir movimentacao de saida com usuario_id do vendedor
      INSERT INTO estoque_movimentacao (
        produto_id, 
        usuario_id, 
        tipo_movimento, 
        quantidade, 
        origem, 
        referencia_id, 
        observacoes
      )
      VALUES (
        v_item.produto_id, 
        NEW.vendedor_id, 
        'saida', 
        v_item.quantidade, 
        'venda', 
        NEW.id, 
        'Venda paga gerou saida automática'
      );
      
      -- Atualizar estoque do produto
      UPDATE produtos SET estoque_atual = estoque_atual - v_item.quantidade WHERE id = v_item.produto_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
