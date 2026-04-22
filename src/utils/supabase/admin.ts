import { createClient } from '@supabase/supabase-js';

// Cria um client com a service role key para operações admin (como criar usuários sem login)
// ATENÇÃO: NUNCA exponha a service_role_key no frontend
export const createAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};
