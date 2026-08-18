import { createClient } from '@supabase/supabase-js';
import { TIPO_INGRESO, CUENTAS, TIPO_CAJA, ESTADO_INGRESO } from './_lib/configLists.js';

export const config = {
  runtime: 'edge',
};

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function nextRef(prefix: string, refs: string[]): string {
  const max = refs.reduce((acc, ref) => {
    const n = Number(ref.replace(`${prefix}-`, ''));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
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

  const fechaInput = typeof body.fecha === 'string' && body.fecha.trim() ? body.fecha.trim() : undefined;
  if (fechaInput && !isIsoDate(fechaInput)) return jsonError('"fecha" debe tener formato YYYY-MM-DD');
  const fecha = fechaInput ?? new Date().toISOString().slice(0, 10);

  const tipoIngreso = typeof body.tipoIngreso === 'string' ? body.tipoIngreso.toUpperCase() : '';
  if (!TIPO_INGRESO.includes(tipoIngreso)) return jsonError(`"tipoIngreso" debe ser uno de: ${TIPO_INGRESO.join(', ')}`);

  const monto = typeof body.monto === 'number' ? body.monto : Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) return jsonError('Falta el campo "monto" (numérico positivo)');

  const cuenta = typeof body.cuenta === 'string' && body.cuenta ? body.cuenta : undefined;
  if (cuenta && !CUENTAS.includes(cuenta)) return jsonError(`"cuenta" debe ser una de: ${CUENTAS.join(', ')}`);

  const caja = typeof body.caja === 'string' && body.caja ? body.caja.toUpperCase() : undefined;
  if (caja && !TIPO_CAJA.includes(caja)) return jsonError(`"caja" debe ser una de: ${TIPO_CAJA.join(', ')}`);

  const estado = typeof body.estado === 'string' && body.estado ? body.estado : 'Confirmado';
  if (!ESTADO_INGRESO.includes(estado)) return jsonError(`"estado" debe ser uno de: ${ESTADO_INGRESO.join(', ')}`);

  const idObra = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null;
  const concepto = typeof body.concepto === 'string' ? body.concepto.trim() : '';
  const createdBy = typeof body.createdBy === 'string' && body.createdBy ? body.createdBy : null;

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const { data: refsExistentes, error: refsError } = await supabase.from('ingresos').select('ref');
    if (refsError) throw new Error(`Error leyendo ingresos: ${refsError.message}`);
    const ref = nextRef('IN', (refsExistentes ?? []).map((r) => r.ref));

    // Resuelve la caja real (0018_finanzas_cajas_metodos.sql) a partir de la
    // `cuenta` de texto — get_caja_actual ya tiene fallback para ingresos
    // 'Confirmado' sin fecha_acreditacion (usa `fecha`), pero necesita
    // caja_id para poder desglosar/filtrar por caja correctamente.
    let cajaId: string | null = null;
    if (cuenta) {
      const { data: cajaMatch } = await supabase.from('cajas').select('id').eq('nombre', cuenta).maybeSingle();
      cajaId = cajaMatch?.id ?? null;
    }

    const { data: creado, error: insertError } = await supabase
      .from('ingresos')
      .insert({
        ref,
        fecha,
        tipo_ingreso: tipoIngreso,
        id_obra: idObra,
        concepto: concepto || null,
        monto,
        cuenta: cuenta ?? null,
        caja: caja ?? null,
        caja_id: cajaId,
        estado,
        activo: true,
        created_by: createdBy,
      })
      .select('ref, fecha, tipo_ingreso, id_obra, concepto, monto, cuenta, caja, estado')
      .single();
    if (insertError) throw new Error(`Error creando ingreso: ${insertError.message}`);

    return new Response(JSON.stringify({ success: true, ingreso: creado }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return jsonError(message, 500);
  }
}
