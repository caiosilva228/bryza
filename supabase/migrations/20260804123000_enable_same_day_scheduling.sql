-- A loja optou por abrir o checkout com entrega no mesmo dia habilitada.
UPDATE public.agendamento_controle
SET mesmo_dia_ativo = true,
    antecedencia_mesmo_dia_horas = 3,
    updated_at = now()
WHERE singleton = true;
