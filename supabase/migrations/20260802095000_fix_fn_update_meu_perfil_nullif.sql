BEGIN;

-- Converte strings vazias em NULL antes de aplicar COALESCE em fn_update_meu_perfil
-- para evitar violação de constraints como chk_ambassador_state quando campos são vazios.
CREATE OR REPLACE FUNCTION public.fn_update_meu_perfil(
  p_phone text,
  p_instagram text,
  p_city text,
  p_state text,
  p_pix_type text,
  p_pix_key text,
  p_photo_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_amb_id UUID;
  v_old_pix_key TEXT;
  v_pix_changed BOOLEAN := FALSE;
  v_clean_phone TEXT;
  v_clean_insta TEXT;
  v_clean_city TEXT;
  v_clean_state TEXT;
  v_clean_pix_type TEXT;
  v_clean_photo TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;

  SELECT a.id, a.pix_key
  INTO v_amb_id, v_old_pix_key
  FROM public.ambassadors a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.user_id = auth.uid()
    AND p.role = 'embaixador'
    AND p.ativo = TRUE
    AND p.must_change_password = FALSE
    AND a.status = 'ativo';

  IF v_amb_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_pix_key IS NOT NULL AND p_pix_key <> '' AND p_pix_key NOT LIKE '%*%' AND p_pix_key <> COALESCE(v_old_pix_key, '') THEN
    v_pix_changed := TRUE;
  END IF;

  v_clean_phone := NULLIF(btrim(p_phone), '');
  v_clean_insta := NULLIF(btrim(p_instagram), '');
  v_clean_city := NULLIF(btrim(p_city), '');
  v_clean_state := NULLIF(btrim(p_state), '');
  v_clean_pix_type := NULLIF(btrim(p_pix_type), '');
  v_clean_photo := NULLIF(btrim(p_photo_path), '');

  UPDATE public.ambassadors
  SET
    phone = COALESCE(v_clean_phone, phone),
    instagram = COALESCE(v_clean_insta, instagram),
    city = COALESCE(v_clean_city, city),
    state = COALESCE(v_clean_state, state),
    pix_key_type = COALESCE(v_clean_pix_type, pix_key_type),
    pix_key = CASE WHEN p_pix_key IS NOT NULL AND p_pix_key <> '' AND p_pix_key NOT LIKE '%*%' THEN btrim(p_pix_key) ELSE pix_key END,
    photo_path = COALESCE(v_clean_photo, photo_path),
    updated_at = NOW()
  WHERE id = v_amb_id;

  IF v_pix_changed THEN
    INSERT INTO public.audit_logs (action, entity_type, entity_id, actor_id, metadata)
    VALUES (
      'update_pix_key', 
      'ambassadors', 
      v_amb_id, 
      auth.uid(), 
      jsonb_build_object('message', 'Chave Pix alterada pelo próprio embaixador.')
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

COMMIT;
