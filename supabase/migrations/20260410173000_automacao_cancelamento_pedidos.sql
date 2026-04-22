-- 1. Função para cancelar pedidos com mais de 3 dias de inatividade
-- Esta função será chamada pelo agendador (cron)
CREATE OR REPLACE FUNCTION public.fn_cancelar_pedidos_expirados()
RETURNS void AS $$
BEGIN
    -- Atualiza pedidos que estão em 'aguardando_preparacao' há mais de 3 dias
    UPDATE public.pedidos
    SET 
        status_pedido = 'cancelado',
        observacoes = COALESCE(observacoes, '') || CHR(10) || '>> Cancelamento Automático: Pedido expirou o prazo de 3 dias (Job em ' || now()::date || ')'
    WHERE 
        status_pedido = 'aguardando_preparacao'
        AND created_at < now() - interval '3 days';
    
    -- Nota: A trigger 'trg_confirmar_baixa_estoque_pedido' já configurada na migração anterior
    -- irá detectar essa mudança de status para 'cancelado' e liberar o estoque reservado automaticamente.
END;
$$ LANGUAGE plpgsql;

-- 2. Instrução para agendamento (Cron)
-- Execute o comando abaixo no Editor SQL do seu projeto Supabase para rodar todo dia à meia-noite:
-- SELECT cron.schedule('cancelar-pedidos-antigos', '0 0 * * *', 'SELECT public.fn_cancelar_pedidos_expirados()');
