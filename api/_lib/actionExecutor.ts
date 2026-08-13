import presupuestosHandler from '../presupuestos';
import egresosHandler from '../egresos';
import ingresosHandler from '../ingresos';
import clientesHandler from '../clientes';

// Whitelist explícita de acciones que el modelo puede pedir. El LLM elige el
// nombre y los parámetros, pero nunca ejecuta nada directamente — esta es la
// única puerta hacia la API real de Porte.

export interface ActionResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

const ALLOWED_ACTIONS = new Set(['create_presupuesto', 'create_egreso', 'create_ingreso', 'create_budget_batch', 'create_cliente']);

export async function executeAction(name: string, args: Record<string, unknown>, userId: string): Promise<ActionResult> {
  if (!ALLOWED_ACTIONS.has(name)) {
    return { ok: false, error: `Acción no permitida: ${name}` };
  }

  switch (name) {
    case 'create_presupuesto':
      return invokeInternal(presupuestosHandler, 'http://internal/api/presupuestos', args, userId, 'presupuesto', 'Error creando el presupuesto');
    case 'create_budget_batch':
      return invokeInternal(presupuestosHandler, 'http://internal/api/presupuestos', args, userId, 'presupuestos', 'Error creando el lote de presupuestos');
    case 'create_egreso':
      return invokeInternal(egresosHandler, 'http://internal/api/egresos', args, userId, 'egreso', 'Error creando el egreso');
    case 'create_ingreso':
      return invokeInternal(ingresosHandler, 'http://internal/api/ingresos', args, userId, 'ingreso', 'Error creando el ingreso');
    case 'create_cliente':
      return invokeInternal(clientesHandler, 'http://internal/api/clientes', args, userId, 'cliente', 'Error creando el cliente');
    default:
      return { ok: false, error: `Acción no implementada: ${name}` };
  }
}

// Invoca el handler de /api/*.ts directamente (mismo bundle), sin roundtrip
// HTTP — reutiliza toda su validación y lógica tal cual, sin duplicarla.
async function invokeInternal(
  handler: (request: Request) => Promise<Response>,
  url: string,
  args: Record<string, unknown>,
  userId: string,
  dataKey: string,
  defaultError: string,
): Promise<ActionResult> {
  const botApiKey = process.env.PORTE_BOT_API_KEY;
  if (!botApiKey) return { ok: false, error: 'Config del servidor incompleta (PORTE_BOT_API_KEY)' };

  const response = await handler(
    new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${botApiKey}` },
      body: JSON.stringify({ ...args, createdBy: userId }),
    }),
  );

  const body = (await response.json()) as { success: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || !body.success) {
    return { ok: false, error: body.error ?? defaultError };
  }
  return { ok: true, data: body[dataKey] };
}
