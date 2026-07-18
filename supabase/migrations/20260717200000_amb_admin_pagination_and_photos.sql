-- ═══════════════════════════════════════════════════════════════════
-- BRYZA — Módulo Embaixadores: Fase Administrativa
-- Migration: 20260717200000_amb_admin_pagination_and_photos.sql
-- Descrição: photo_path, paginação server-side com JSONB e Storage privado.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Alterações estruturais em public.ambassadors
ALTER TABLE public.ambassadors ADD COLUMN IF NOT EXISTS photo_path TEXT;

-- 2. Função de paginação com retorno de JSONB e validações estritas de NULL e limites
CREATE OR REPLACE FUNCTION public.fn_get_embaixadores_paginados(
  p_limit        INT,
  p_offset       INT,
  p_search       TEXT DEFAULT NULL,
  p_cpf          TEXT DEFAULT NULL,
  p_city         TEXT DEFAULT NULL,
  p_status       TEXT DEFAULT NULL,
  p_plan_id      UUID DEFAULT NULL,
  p_start_date   TIMESTAMPTZ DEFAULT NULL,
  p_end_date     TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_search_pattern TEXT;
  v_total_count BIGINT;
  v_items JSONB;
BEGIN
  -- Validar limit e offset para impedir NULL e limites inválidos
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit deve estar entre 1 e 100'
      USING ERRCODE = '22023';
  END IF;

  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'p_offset deve ser igual ou maior que zero'
      USING ERRCODE = '22023';
  END IF;

  v_search_pattern := '%' || LOWER(COALESCE(p_search, '')) || '%';

  -- Contagem total com os mesmos filtros
  SELECT count(*)
  INTO v_total_count
  FROM public.ambassadors a
  WHERE 
    (p_search IS NULL OR LOWER(a.full_name) LIKE v_search_pattern OR LOWER(a.username) LIKE v_search_pattern OR LOWER(a.referral_code) LIKE v_search_pattern)
    AND (p_cpf IS NULL OR a.cpf = p_cpf)
    AND (p_city IS NULL OR LOWER(a.city) = LOWER(p_city))
    AND (p_status IS NULL OR a.status = p_status)
    AND (p_plan_id IS NULL OR a.commission_plan_id = p_plan_id)
    AND (p_start_date IS NULL OR a.created_at >= p_start_date)
    AND (p_end_date IS NULL OR a.created_at <= p_end_date);

  -- Lista de itens com ordenação estável por created_at DESC, id DESC
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT 
      a.id,
      a.user_id,
      a.full_name,
      a.display_name,
      a.username,
      a.referral_code,
      a.phone,
      a.email,
      a.instagram,
      a.city,
      a.state,
      cp.name AS plano_nome,
      a.commission_plan_id AS plano_id,
      a.status,
      a.created_at,
      a.photo_path,
      COALESCE(count(DISTINCT c.order_id), 0) AS total_vendas,
      COALESCE(sum(CASE WHEN c.status = 'liberada' THEN c.commission_amount ELSE 0 END), 0) AS comissao_liberada,
      COALESCE(sum(CASE WHEN c.status = 'paga' THEN c.commission_amount ELSE 0 END), 0) AS total_recebido
    FROM public.ambassadors a
    LEFT JOIN public.commission_plans cp ON cp.id = a.commission_plan_id
    LEFT JOIN public.commissions c ON c.ambassador_id = a.id
    WHERE 
      (p_search IS NULL OR LOWER(a.full_name) LIKE v_search_pattern OR LOWER(a.username) LIKE v_search_pattern OR LOWER(a.referral_code) LIKE v_search_pattern)
      AND (p_cpf IS NULL OR a.cpf = p_cpf)
      AND (p_city IS NULL OR LOWER(a.city) = LOWER(p_city))
      AND (p_status IS NULL OR a.status = p_status)
      AND (p_plan_id IS NULL OR a.commission_plan_id = p_plan_id)
      AND (p_start_date IS NULL OR a.created_at >= p_start_date)
      AND (p_end_date IS NULL OR a.created_at <= p_end_date)
    GROUP BY a.id, cp.name, a.commission_plan_id
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total_count
  );
END;
$$;

-- Privilégios restritos da RPC
REVOKE ALL ON FUNCTION public.fn_get_embaixadores_paginados(INT, INT, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixadores_paginados(INT, INT, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- 3. Configurações de Storage
-- Inserir o bucket se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ambassador-photos', 'ambassador-photos', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE 
SET public = FALSE, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Políticas de RLS para o bucket com checagem rígida de bucket_id
DROP POLICY IF EXISTS "Acesso total de admin no storage de embaixadores" ON storage.objects;
CREATE POLICY "Acesso total de admin no storage de embaixadores" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'ambassador-photos' 
    AND public.get_user_role() = 'admin'
  )
  WITH CHECK (
    bucket_id = 'ambassador-photos' 
    AND public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Leitura de fotos próprias por embaixadores" ON storage.objects;
CREATE POLICY "Leitura de fotos próprias por embaixadores" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ambassador-photos' 
    AND public.get_user_role() = 'embaixador' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Escrita de fotos próprias por embaixadores" ON storage.objects;
CREATE POLICY "Escrita de fotos próprias por embaixadores" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ambassador-photos' 
    AND public.get_user_role() = 'embaixador' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Atualizacao de fotos próprias por embaixadores" ON storage.objects;
CREATE POLICY "Atualizacao de fotos próprias por embaixadores" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ambassador-photos' 
    AND public.get_user_role() = 'embaixador' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'ambassador-photos' 
    AND public.get_user_role() = 'embaixador' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Delecao de fotos próprias por embaixadores" ON storage.objects;
CREATE POLICY "Delecao de fotos próprias por embaixadores" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ambassador-photos' 
    AND public.get_user_role() = 'embaixador' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
