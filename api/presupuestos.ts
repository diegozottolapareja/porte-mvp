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

// presupuestos y ventas comparten el mismo espacio de IDs (PR-XXXX) — ver
// nextPresupuestoId en src/modules/porte/store.tsx.
function nextPresupuestoId(presupuestoIds: string[], ventaIds: string[]): string {
  const max = [...presupuestoIds, ...ventaIds].reduce((acc, id) => {
    const n = Number(id.replace('PR - ', '').replace('PR-', ''));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `PR - ${String(max + 1).padStart(4, '0')}`;
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

  const cliente = typeof body.cliente === 'string' ? body.cliente.trim() : '';
  const categoria = typeof body.categoria === 'string' ? body.categoria.toUpperCase() : '';
  const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
  const responsable = typeof body.responsable === 'string' && body.responsable.trim() ? body.responsable.trim() : RESPONSABLE_DEFAULT;
  const estadoComercial = typeof body.estadoComercial === 'string' && body.estadoComercial ? body.estadoComercial : 'Pedido';
  const observaciones = typeof body.observaciones === 'string' ? body.observaciones.trim() : undefined;
  // Presente cuando el caller conoce al usuario real (ej. el Action Executor del
  // asistente); el bot de Telegram no lo manda y el presupuesto queda sin dueño, como antes.
  const createdBy = typeof body.createdBy === 'string' && body.createdBy ? body.createdBy : null;

  // costoMat y costoMo son obligatorios; el resto de los montos son opcionales (default 0).
  const costoMat = typeof body.costoMat === 'number' ? body.costoMat : Number(body.costoMat);
  const costoMo = typeof body.costoMo === 'number' ? body.costoMo : Number(body.costoMo);
  const indVendidos = numOrUndefined(body.indVendidos);
  const impuestos = numOrUndefined(body.impuestos);
  const comercial = numOrUndefined(body.comercial);
  const beneficio = numOrUndefined(body.beneficio);

  if (!cliente) {
    return new Response(JSON.stringify({ success: false, error: 'Falta el campo "cliente"' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!CATEGORIA.includes(categoria)) {
    return new Response(
      JSON.stringify({ success: false, error: `"categoria" debe ser una de: ${CATEGORIA.join(', ')}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  if (!ESTADO_COMERCIAL.includes(estadoComercial)) {
    return new Response(
      JSON.stringify({ success: false, error: `"estadoComercial" debe ser una de: ${ESTADO_COMERCIAL.join(', ')}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  if (!Number.isFinite(costoMat)) {
    return new Response(JSON.stringify({ success: false, error: 'Falta el campo "costoMat" (numérico)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!Number.isFinite(costoMo)) {
    return new Response(JSON.stringify({ success: false, error: 'Falta el campo "costoMo" (numérico)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    // 1. findOrCreateCliente — misma lógica que el formulario web (match case-insensitive por nombre)
    const { data: clientesExistentes, error: clientesError } = await supabase
      .from('clientes')
      .select('id_cli, nombre');
    if (clientesError) throw new Error(`Error leyendo clientes: ${clientesError.message}`);

    const clienteExistente = (clientesExistentes ?? []).find(
      (c) => c.nombre.trim().toLowerCase() === cliente.toLowerCase(),
    );

    if (!clienteExistente) {
      const idCli = nextSeqId('CLI', (clientesExistentes ?? []).map((c) => c.id_cli));
      const { error: insertClienteError } = await supabase.from('clientes').insert({
        id_cli: idCli,
        nombre: cliente,
        activo: true,
      });
      if (insertClienteError) throw new Error(`Error creando cliente: ${insertClienteError.message}`);
    }

    // 2. Calcular próximo ID de presupuesto (comparte numeración con ventas)
    const [{ data: presupuestosIds, error: presError }, { data: ventasIds, error: ventasError }] = await Promise.all([
      supabase.from('presupuestos').select('id'),
      supabase.from('ventas').select('id'),
    ]);
    if (presError) throw new Error(`Error leyendo presupuestos: ${presError.message}`);
    if (ventasError) throw new Error(`Error leyendo ventas: ${ventasError.message}`);

    const id = nextPresupuestoId(
      (presupuestosIds ?? []).map((p) => p.id),
      (ventasIds ?? []).map((v) => v.id),
    );

    // 3. Insertar presupuesto
    const fecha = new Date().toISOString().slice(0, 10);
    const { data: creado, error: insertError } = await supabase
      .from('presupuestos')
      .insert({
        id,
        fecha,
        cliente,
        descripcion: descripcion || null,
        categoria,
        responsable,
        costo_mat: costoMat,
        costo_mo: costoMo,
        ind_vendidos: indVendidos ?? null,
        impuestos: impuestos ?? null,
        comercial: comercial ?? null,
        beneficio: beneficio ?? null,
        estado_comercial: estadoComercial,
        observaciones: observaciones || null,
        enviado: false,
        activo: true,
        created_by: createdBy,
      })
      .select('id, fecha, cliente, descripcion, categoria, responsable, estado_comercial, costo_mat, costo_mo, ind_vendidos, impuestos, comercial, beneficio, monto_total')
      .single();
    if (insertError) throw new Error(`Error creando presupuesto: ${insertError.message}`);

    return new Response(JSON.stringify({ success: true, presupuesto: creado }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
