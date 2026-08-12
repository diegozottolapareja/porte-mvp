import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

// Mantener sincronizado con src/modules/porte/data/config.ts (CONFIG_LISTS).
// Se duplica acá porque las Edge Functions de /api se bundlean por separado
// y no comparten módulos con src/. Se exporta para que api/_lib/assistantTools.ts
// (dentro del mismo bundle de /api) no vuelva a duplicarla.
export const CATEGORIA = ['PORTON', 'CORTINA', 'ESTRUCTURA', 'FRENTE ASADOR', 'SERVICIO', 'OTRO'];
const ESTADO_COMERCIAL = ['Pedido', 'En presupuestación', 'Enviado', 'En negociación', 'Aceptado', 'Rechazado', 'Represupuestado', 'Cancelado'];
const RESPONSABLE_DEFAULT = 'Gonza';

function numOrUndefined(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function nextSeqId(prefix: string, ids: string[]): string {
  const max = ids.reduce((acc, id) => {
    const n = Number(id.replace(`${prefix}-`, ''));
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

  // Lote (budget_group del asistente) via { items: [...] }; caso normal es un objeto plano.
  const rawItems = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [body];
  if (rawItems.length === 0) return jsonError('"items" no puede estar vacío');

  const parsed: {
    cliente: string; categoria: string; descripcion: string; responsable: string; estadoComercial: string;
    observaciones?: string; costoMat: number; costoMo: number; indVendidos?: number; impuestos?: number;
    comercial?: number; beneficio?: number;
  }[] = [];

  for (const item of rawItems) {
    const cliente = typeof item.cliente === 'string' ? item.cliente.trim() : '';
    const categoria = typeof item.categoria === 'string' ? item.categoria.toUpperCase() : '';
    const descripcion = typeof item.descripcion === 'string' ? item.descripcion.trim() : '';
    const responsable = typeof item.responsable === 'string' && item.responsable.trim() ? item.responsable.trim() : RESPONSABLE_DEFAULT;
    const estadoComercial = typeof item.estadoComercial === 'string' && item.estadoComercial ? item.estadoComercial : 'Pedido';
    const observaciones = typeof item.observaciones === 'string' ? item.observaciones.trim() : undefined;
    const costoMat = typeof item.costoMat === 'number' ? item.costoMat : Number(item.costoMat);
    const costoMo = typeof item.costoMo === 'number' ? item.costoMo : Number(item.costoMo);
    const indVendidos = numOrUndefined(item.indVendidos);
    const impuestos = numOrUndefined(item.impuestos);
    const comercial = numOrUndefined(item.comercial);
    const beneficio = numOrUndefined(item.beneficio);

    if (!cliente) return jsonError('Falta el campo "cliente"');
    if (!CATEGORIA.includes(categoria)) return jsonError(`"categoria" debe ser una de: ${CATEGORIA.join(', ')}`);
    if (!ESTADO_COMERCIAL.includes(estadoComercial)) return jsonError(`"estadoComercial" debe ser una de: ${ESTADO_COMERCIAL.join(', ')}`);
    if (!Number.isFinite(costoMat)) return jsonError('Falta el campo "costoMat" (numérico)');
    if (!Number.isFinite(costoMo)) return jsonError('Falta el campo "costoMo" (numérico)');

    parsed.push({
      cliente, categoria, descripcion, responsable, estadoComercial, observaciones,
      costoMat, costoMo, indVendidos, impuestos, comercial, beneficio,
    });
  }

  // Presente cuando el caller conoce al usuario real (ej. el Action Executor del
  // asistente); el bot de Telegram no lo manda y el presupuesto queda sin dueño, como antes.
  const createdBy = typeof body.createdBy === 'string' && body.createdBy ? body.createdBy : null;

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    // 1. findOrCreateCliente para todos los clientes del lote — misma lógica que el
    // formulario web (match case-insensitive por nombre), sin crear duplicados.
    const { data: clientesExistentes, error: clientesError } = await supabase
      .from('clientes')
      .select('id_cli, nombre');
    if (clientesError) throw new Error(`Error leyendo clientes: ${clientesError.message}`);

    const clientesIds = (clientesExistentes ?? []).map((c) => c.id_cli);
    const nombresConocidos = new Set((clientesExistentes ?? []).map((c) => c.nombre.trim().toLowerCase()));
    const clientesNuevos: { id_cli: string; nombre: string; activo: boolean }[] = [];
    for (const item of parsed) {
      const key = item.cliente.toLowerCase();
      if (!nombresConocidos.has(key)) {
        const idCli = nextSeqId('CLI', [...clientesIds, ...clientesNuevos.map((c) => c.id_cli)]);
        clientesNuevos.push({ id_cli: idCli, nombre: item.cliente, activo: true });
        nombresConocidos.add(key);
      }
    }
    if (clientesNuevos.length > 0) {
      const { error: insertClientesError } = await supabase.from('clientes').insert(clientesNuevos);
      if (insertClientesError) throw new Error(`Error creando clientes: ${insertClientesError.message}`);
    }

    // 2. Calcular la secuencia de IDs de presupuesto una sola vez para todo el lote
    // (comparte numeración con ventas) — evita colisiones entre ítems del mismo lote.
    const [{ data: presupuestosIds, error: presError }, { data: ventasIds, error: ventasError }] = await Promise.all([
      supabase.from('presupuestos').select('id'),
      supabase.from('ventas').select('id'),
    ]);
    if (presError) throw new Error(`Error leyendo presupuestos: ${presError.message}`);
    if (ventasError) throw new Error(`Error leyendo ventas: ${ventasError.message}`);

    let maxId = [...(presupuestosIds ?? []).map((p) => p.id), ...(ventasIds ?? []).map((v) => v.id)].reduce((acc, id) => {
      const n = Number(id.replace('PR - ', '').replace('PR-', ''));
      return Number.isFinite(n) ? Math.max(acc, n) : acc;
    }, 0);

    const fecha = new Date().toISOString().slice(0, 10);
    const rows = parsed.map((item) => {
      maxId += 1;
      return {
        id: `PR - ${String(maxId).padStart(4, '0')}`,
        fecha,
        cliente: item.cliente,
        descripcion: item.descripcion || null,
        categoria: item.categoria,
        responsable: item.responsable,
        costo_mat: item.costoMat,
        costo_mo: item.costoMo,
        ind_vendidos: item.indVendidos ?? null,
        impuestos: item.impuestos ?? null,
        comercial: item.comercial ?? null,
        beneficio: item.beneficio ?? null,
        estado_comercial: item.estadoComercial,
        observaciones: item.observaciones || null,
        enviado: false,
        activo: true,
        created_by: createdBy,
      };
    });

    // 3. Insertar todo el lote en un único statement — atómico a nivel de Postgres,
    // no queda un lote a medio insertar si algo falla.
    const { data: creados, error: insertError } = await supabase
      .from('presupuestos')
      .insert(rows)
      .select('id, fecha, cliente, descripcion, categoria, responsable, estado_comercial, costo_mat, costo_mo, ind_vendidos, impuestos, comercial, beneficio, monto_total');
    if (insertError) throw new Error(`Error creando presupuesto: ${insertError.message}`);

    const isBatch = Array.isArray(body.items);
    return new Response(
      JSON.stringify(isBatch ? { success: true, presupuestos: creados } : { success: true, presupuesto: creados?.[0] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return jsonError(message, 500);
  }
}
