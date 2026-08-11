import { CATEGORIA } from '../presupuestos';

// Prompt de sistema y definición de tools del asistente de Porte. Portado de
// las toolDescription del workflow n8n "Telegram Voice Agent Pilot" (nunca
// commiteado — vivía solo en la instancia local) para no perder las reglas
// de negocio ya definidas: qué es obligatorio, qué formato exacto espera la
// API y cuándo hay que preguntar en vez de inventar.

export const SYSTEM_PROMPT = `Sos el asistente de Porte, una empresa de portones, cortinas y estructuras metálicas. Hablás en español rioplatense, con tono directo y profesional.

Tu trabajo es ayudar al usuario a cargar presupuestos por texto o por voz, usando exclusivamente las acciones (tools) que tenés disponibles.

Reglas:
- Nunca inventes datos. Si falta un dato obligatorio para ejecutar una acción, preguntalo antes de llamar a la tool.
- Los campos obligatorios para crear un presupuesto son: cliente, categoría, costo de materiales y costo de mano de obra. El resto es opcional (se usa 0 si no se menciona).
- La categoría tiene que ser EXACTAMENTE una de estas, en mayúsculas: ${CATEGORIA.join(', ')}. Si el usuario dice algo parecido pero ambiguo, preguntale cuál de esas opciones corresponde.
- Los montos son en pesos argentinos.
- Cuando tengas todos los datos obligatorios, ejecutá la acción — no sigas preguntando de más.
- Después de ejecutar una acción, confirmale al usuario el resultado de forma breve y clara (ej. número de presupuesto creado).
- Si una acción falla, explicaselo al usuario en una frase simple y preguntale cómo seguir — no reintentes solo.
- Solo podés ejecutar las acciones que tenés definidas como tools. Nunca inventes otra acción ni otro endpoint.`;

export const CREATE_PRESUPUESTO_TOOL = {
  type: 'function',
  function: {
    name: 'create_presupuesto',
    description:
      'Crea un nuevo presupuesto para un cliente. Usar cuando el usuario pida cargar, crear o armar un presupuesto nuevo.',
    parameters: {
      type: 'object',
      properties: {
        cliente: {
          type: 'string',
          description: 'Nombre del cliente para el presupuesto. Obligatorio.',
        },
        categoria: {
          type: 'string',
          enum: CATEGORIA,
          description: 'Categoría del trabajo. Obligatorio.',
        },
        descripcion: {
          type: 'string',
          description: 'Breve descripción del trabajo pedido por el cliente. Opcional.',
        },
        costoMat: {
          type: 'number',
          description: 'Costo de materiales en pesos argentinos. Obligatorio.',
        },
        costoMo: {
          type: 'number',
          description: 'Costo de mano de obra en pesos argentinos. Obligatorio.',
        },
        indVendidos: {
          type: 'number',
          description: 'Costos indirectos varios en pesos argentinos. Opcional, default 0.',
        },
        impuestos: {
          type: 'number',
          description: 'Impuestos aplicados al presupuesto en pesos argentinos. Opcional, default 0.',
        },
        comercial: {
          type: 'number',
          description: 'Costo comercial (marketing, ventas) en pesos argentinos. Opcional, default 0.',
        },
        beneficio: {
          type: 'number',
          description: 'Beneficio/ganancia esperada en pesos argentinos. Opcional, default 0.',
        },
      },
      required: ['cliente', 'categoria', 'costoMat', 'costoMo'],
      additionalProperties: false,
    },
  },
} as const;

export const ASSISTANT_TOOLS = [CREATE_PRESUPUESTO_TOOL];
