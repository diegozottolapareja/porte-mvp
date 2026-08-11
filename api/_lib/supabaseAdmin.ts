import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Prefijo "_" para que Vercel NO trate este archivo (ni la carpeta) como una
// ruta de API — es código compartido entre las funciones de api/assistant/*.

export function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Config de Supabase incompleta en el servidor');
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

export interface AuthenticatedUser {
  id: string;
  role: 'admin' | 'data_entry';
}

// Valida el JWT de Supabase que manda la PWA (usuario logueado) y resuelve su
// perfil/rol. auth.getUser(token) verifica el token contra el Auth server de
// Supabase independientemente de con qué key se haya creado el cliente.
export async function authenticateRequest(request: Request, supabase: SupabaseClient): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!token) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, activo')
    .eq('id', userData.user.id)
    .single();
  if (profileError || !profile || !profile.activo) return null;

  return { id: userData.user.id, role: profile.role };
}
