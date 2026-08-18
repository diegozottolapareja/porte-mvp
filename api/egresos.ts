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
  const comprobantePath = typeof body.comprobantePath === 'string' && body.comprobantePath ? body.comprobantePath : null;
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

    // Resuelve la caja real (0018_finanzas_cajas_metodos.sql) a partir de la
    // `cuenta` de texto para que este egreso participe de get_caja_actual —
    // sin esto quedaría invisible en Finanzas (esa RPC no lee `egresos`
    // directo, lee `compromisos_pago`, ver abajo).
    let cajaId: string | null = null;
    if (cuenta) {
      const { data: cajaMatch } = await supabase.from('cajas').select('id').eq('nombre', cuenta).maybeSingle();
      cajaId = cajaMatch?.id ?? null;
    }

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
        caja_id: cajaId,
        estado,
        fecha_emision: fechaEmision,
        fecha_acreditacion: fechaAcreditacion,
        comprobante_path: comprobantePath,
        activo: true,
        created_by: createdBy,
      })
      .select('ref, fecha, tipo_egreso, id_obra, proveedor_id, categoria, monto, cuenta, caja, estado, comprobante_path')
      .single();
    if (insertError) throw new Error(`Error creando egreso: ${insertError.message}`);

    // Genera el compromiso_pago del egreso (sección 6/8/9/10 del pedido) — el
    // asistente no conoce "método de pago", así que interpreta `estado` con
    // el mismo criterio que el backfill de 0020_finanzas_backfill_compromisos.sql:
    // Confirmado = ya pagado, Pendiente/Incompleto = a pagar sin vencimiento
    // real cargado, Emitido = cheque legacy pendiente de débito. Best-effort:
    // si esto falla, el egreso ya se creó — no debe romper la respuesta al
    // asistente, pero sí queda logueado para revisar en Finanzas.
    try {
      if (estado === 'Confirmado') {
        await supabase.from('compromisos_pago').insert({
          egreso_id: ref, monto, fecha_vencimiento: fecha, fecha_acreditacion: fecha,
          caja_id: cajaId, estado: 'PAGADO', created_by: createdBy,
        });
      } else if (estado === 'Emitido') {
        const { data: chequeCreado, error: chequeError } = await supabase
          .from('cheques')
          .insert({
            numero: null, banco: null, monto,
            fecha_emision: fechaEmision ?? fecha, fecha_vencimiento: fechaAcreditacion ?? fecha,
            caja_id: cajaId, estado: 'EMITIDO', created_by: createdBy,
          })
          .select('id')
          .single();
        if (chequeError) throw chequeError;
        await supabase.from('compromisos_pago').insert({
          egreso_id: ref, monto, fecha_vencimiento: fechaAcreditacion ?? fecha,
          caja_id: cajaId, estado: 'PENDIENTE', cheque_id: chequeCreado?.id ?? null, created_by: createdBy,
        });
      } else {
        await supabase.from('compromisos_pago').insert({
          egreso_id: ref, monto, fecha_vencimiento: fecha,
          caja_id: cajaId, estado: 'PENDIENTE', created_by: createdBy,
        });
      }
    } catch (compromisoError) {
      // eslint-disable-next-line no-console
      console.error('[api/egresos] no se pudo generar el compromiso_pago del egreso', ref, compromisoError);
    }

    return new Response(JSON.stringify({ success: true, egreso: creado }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return jsonError(message, 500);
  }
}
