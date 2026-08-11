import presupuestosHandler from '../presupuestos';

// Whitelist explícita de acciones que el modelo puede pedir. El LLM elige el
// nombre y los parámetros, pero nunca ejecuta nada directamente — esta es la
// única puerta hacia la API real de Porte.

export interface ActionResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

const ALLOWED_ACTIONS = new Set(['create_presupuesto']);

export async function executeAction(name: string, args: Record<string, unknown>, userId: string): Promise<ActionResult> {
  if (!ALLOWED_ACTIONS.has(name)) {
    return { ok: false, error: `Acción no permitida: ${name}` };
  }

  if (name === 'create_presupuesto') {
    return createPresupuesto(args, userId);
  }

  return { ok: false, error: `Acción no implementada: ${name}` };
}

async function createPresupuesto(args: Record<string, unknown>, userId: string): Promise<ActionResult> {
  const botApiKey = process.env.PORTE_BOT_API_KEY;
  if (!botApiKey) return { ok: false, error: 'Config del servidor incompleta (PORTE_BOT_API_KEY)' };

  // Invoca el handler de api/presupuestos.ts directamente (mismo bundle de
  // /api), sin roundtrip HTTP — reutiliza toda su validación y lógica tal
  // cual, sin duplicarla.
  const response = await presupuestosHandler(
    new Request('http://internal/api/presupuestos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${botApiKey}` },
      body: JSON.stringify({ ...args, createdBy: userId }),
    }),
  );

  const body = (await response.json()) as { success: boolean; presupuesto?: unknown; error?: string };
  if (!response.ok || !body.success) {
    return { ok: false, error: body.error ?? 'Error creando el presupuesto' };
  }
  return { ok: true, data: body.presupuesto };
}
