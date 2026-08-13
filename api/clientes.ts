import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

function nextSeqId(prefix: string, ids: string[]): string {
  const max = ids.reduce((acc, id) => {
    const n = Number(id.replace(`${prefix}-`, ''));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

function strOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export default async function handler(request: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Solo se permite POST' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const botApiKey = process.env.PORTE_BOT_API_KEY;
  const authHeader = request.headers.get('authorization') ?? '';
  if (!botApiKey || authHeader !== `Bearer ${botApiKey}`) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ success: false, error: 'Config de Supabase incompleta en el servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Body inválido, se esperaba JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const jsonError = (error: string, status = 400) =>
    new Response(JSON.stringify({ success: false, error }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  if (!nombre) return jsonError('Falta el campo "nombre"');

  const emailPrincipal = strOrUndefined(body.emailPrincipal);
  const emailSecundario = strOrUndefined(body.emailSecundario);
  const telefonoPrincipal = strOrUndefined(body.telefonoPrincipal);
  const telefonoSecundario = strOrUndefined(body.telefonoSecundario);
  const direccion = strOrUndefined(body.direccion);
  const observaciones = strOrUndefined(body.observaciones);

  // Regla de negocio: todo cliente necesita al menos un email principal o un
  // teléfono principal — reforzada acá para dar un error específico al bot
  // (el trigger trg_validar_contacto_cliente en Supabase es la barrera real).
  if (!emailPrincipal && !telefonoPrincipal) {
    return jsonError('Falta "emailPrincipal" o "telefonoPrincipal" — el cliente necesita al menos uno de los dos');
  }

  const createdBy = typeof body.createdBy === 'string' && body.createdBy ? body.createdBy : null;

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const { data: existentes, error: existentesError } = await supabase.from('clientes').select('id_cli, nombre');
    if (existentesError) throw new Error(`Error leyendo clientes: ${existentesError.message}`);

    const yaExiste = (existentes ?? []).some((c) => c.nombre.trim().toLowerCase() === nombre.toLowerCase());
    if (yaExiste) return jsonError(`Ya existe un cliente llamado "${nombre}"`, 409);

    const idCli = nextSeqId('CLI', (existentes ?? []).map((c) => c.id_cli));

    const { data: creado, error: insertError } = await supabase
      .from('clientes')
      .insert({
        id_cli: idCli,
        nombre,
        email_principal: emailPrincipal ?? null,
        email_secundario: emailSecundario ?? null,
        telefono_principal: telefonoPrincipal ?? null,
        telefono_secundario: telefonoSecundario ?? null,
        direccion: direccion ?? null,
        observaciones: observaciones ?? null,
        activo: true,
        created_by: createdBy,
      })
      .select('id_cli, nombre, email_principal, email_secundario, telefono_principal, telefono_secundario, direccion')
      .single();
    if (insertError) throw new Error(`Error creando cliente: ${insertError.message}`);

    return new Response(JSON.stringify({ success: true, cliente: creado }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return jsonError(message, 500);
  }
}
