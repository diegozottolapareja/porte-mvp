import { createClient } from '@supabase/supabase-js';
import { TIPO_EGRESO, CATEG_DIRECTOS, CATEG_INDIRECTOS, CUENTAS, TIPO_CAJA, ESTADO_EGRESO } from './_lib/configLists.js';

export const config = {
  runtime: 'edge',
};

const CATEGORIA_EGRESO = [...new Set([...CATEG_DIRECTOS, ...CATEG_INDIRECTOS])];

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

function nextProveedorId(ids: string[]): string {
  const max = ids.reduce((acc, id) => {
    const n = Number(id.replace('PROV-', ''));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `PROV-${String(max + 1).padStart(3, '0')}`;
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

  const tipoEgreso = typeof body.tipoEgreso === 'string' ? body.tipoEgreso.toUpperCase() : '';
  if (!TIPO_EGRESO.includes(tipoEgreso)) return jsonError(`"tipoEgreso" debe ser uno de: ${TIPO_EGRESO.join(', ')}`);

  const categoria = typeof body.categoria === 'string' ? body.categoria.toUpperCase() : '';
  if (!CATEGORIA_EGRESO.includes(categoria)) return jsonError(`"categoria" debe ser una de: ${CATEGORIA_EGRESO.join(', ')}`);

  const monto = typeof body.monto === 'number' ? body.monto : Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) return jsonError('Falta el campo "monto" (numérico positivo)');

  const cuenta = typeof body.cuenta === 'string' && body.cuenta ? body.cuenta : undefined;
  if (cuenta && !CUENTAS.includes(cuenta)) return jsonError(`"cuenta" debe ser una de: ${CUENTAS.join(', ')}`);

  const caja = typeof body.caja === 'string' && body.caja ? body.caja.toUpperCase() : undefined;
  if (caja && !TIPO_CAJA.includes(caja)) return jsonError(`"caja" debe ser una de: ${TIPO_CAJA.join(', ')}`);

  const estado = typeof body.estado === 'string' && body.estado ? body.estado : 'Confirmado';
  if (!ESTADO_EGRESO.includes(estado)) return jsonError(`"estado" debe ser uno de: ${ESTADO_EGRESO.join(', ')}`);

  const idObra = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null;
  const proveedorNombre = typeof body.proveedor === 'string' ? body.proveedor.trim() : '';
  const fechaEmision = typeof body.fechaEmision === 'string' && body.fechaEmision ? body.fechaEmision : null;
  const fechaAcreditacion = typeof body.fechaAcreditacion === 'string' && body.fechaAcreditacion ? body.fechaAcreditacion : null;
  const createdBy = typeof body.createdBy === 'string' && body.createdBy ? body.createdBy : null;

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    let proveedorId: string | null = null;
    if (proveedorNombre) {
      const { data: proveedoresExistentes, error: proveedoresError } = await supabase
        .from('proveedores')
        .select('id_prov, nombre');
      if (proveedoresError) throw new Error(`Error leyendo proveedores: ${proveedoresError.message}`);

      const existente = (proveedoresExistentes ?? []).find(
        (p) => p.nombre.trim().toLowerCase() === proveedorNombre.toLowerCase(),
      );

      if (existente) {
        proveedorId = existente.id_prov;
      } else {
        proveedorId = nextProveedorId((proveedoresExistentes ?? []).map((p) => p.id_prov));
        const { error: insertProveedorError } = await supabase.from('proveedores').insert({
          id_prov: proveedorId,
          nombre: proveedorNombre,
          tipo_caja: caja ?? 'BLANCA',
          saldo_inicial: 0,
          activo: true,
        });
        if (insertProveedorError) throw new Error(`Error creando proveedor: ${insertProveedorError.message}`);
      }
    }

    const { data: refsExistentes, error: refsError } = await supabase.from('egresos').select('ref');
    if (refsError) throw new Error(`Error leyendo egresos: ${refsError.message}`);
    const ref = nextRef('EG', (refsExistentes ?? []).map((r) => r.ref));

    const { data: creado, error: insertError } = await supabase
      .from('egresos')
      .insert({
        ref,
        fecha,
        tipo_egreso: tipoEgreso,
        id_obra: idObra,
        proveedor_id: proveedorId,
        categoria,
        monto,
        cuenta: cuenta ?? null,
        caja: caja ?? null,
        estado,
        fecha_emision: fechaEmision,
        fecha_acreditacion: fechaAcreditacion,
        activo: true,
        created_by: createdBy,
      })
      .select('ref, fecha, tipo_egreso, id_obra, proveedor_id, categoria, monto, cuenta, caja, estado')
      .single();
    if (insertError) throw new Error(`Error creando egreso: ${insertError.message}`);

    return new Response(JSON.stringify({ success: true, egreso: creado }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return jsonError(message, 500);
  }
}
