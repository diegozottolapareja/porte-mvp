// ─── Listas maestras — PORTE (00_CONFIG) ──────────────────────────────────────
// Todas las listas desplegables de la app salen de acá.
// Si el cliente redefine un valor, solo se cambia esta lista.

export const CONFIG_LISTS = {
  CATEGORIA: ['PORTON', 'CORTINA', 'ESTRUCTURA', 'FRENTE ASADOR', 'SERVICIO', 'OTRO'],
  ESTADO_COMERCIAL: ['Pedido', 'En presupuestación', 'Enviado', 'En negociación', 'Aceptado', 'Rechazado', 'Represupuestado', 'Cancelado'],
  // Lista maestra oficial (00_CONFIG) tiene solo 4 valores, pero las ventas reales del
  // cliente usan además "Pendiente" y "Planificado" — inconsistencia real, no error de carga.
  ESTADO_OPERATIVO: ['Pendiente', 'Planificado', 'En fabricación', 'En montaje', 'Entregado', 'Cerrado'],
  CUENTAS: ['Banco Macro', 'MercadoPago', 'Efectivo Blanco', 'Efectivo Negro'],
  TIPO_CAJA: ['BLANCA', 'NEGRA'],
  TIPO_INGRESO: ['ANTICIPO', 'SALDO', 'PAGO PARCIAL', 'OTRO'],
  TIPO_EGRESO: ['MATERIALES', 'MANO DE OBRA', 'FLETE', 'COMBUSTIBLE', 'HERRAMIENTAS', 'SERVICIOS', 'IMPUESTOS', 'OTROS'],
  CATEG_DIRECTOS: ['MATERIALES', 'MANO DE OBRA', 'FLETE', 'HERRAMIENTAS', 'SERVICIOS'],
  CATEG_INDIRECTOS: ['ALQUILER', 'SUELDOS', 'SERVICIOS', 'IMPUESTOS', 'HERRAMIENTAS', 'COMBUSTIBLE', 'OTROS'],
  CONDICION_PAGO: ['Transferencia', 'Efectivo', 'Tarjeta', 'Cheque', 'Otro'],
  TIPO_VARIACION: ['Precio', 'Plazo de entrega', 'Alcance del trabajo', 'Forma de pago', 'Material especificado', 'Condición de cobro', 'Cancelación parcial', 'Otro'],
  CAUSA_DESVIO: ['Diseño', 'Materiales', 'Proveedor', 'Montaje', 'Cliente', 'Estimación', 'Otro'],
  CATEG_GASTO_FIJO: ['Alquiler', 'Sueldos', 'Servicios', 'Impuestos', 'Herramientas', 'Combustible', 'Otros'],
  RESPONSABLE: ['Gonza'],
} as const

export type Categoria = (typeof CONFIG_LISTS.CATEGORIA)[number]
export type EstadoComercial = (typeof CONFIG_LISTS.ESTADO_COMERCIAL)[number]
export type EstadoOperativo = (typeof CONFIG_LISTS.ESTADO_OPERATIVO)[number]
export type Cuenta = (typeof CONFIG_LISTS.CUENTAS)[number]
export type TipoCaja = (typeof CONFIG_LISTS.TIPO_CAJA)[number]
export type TipoIngreso = (typeof CONFIG_LISTS.TIPO_INGRESO)[number]
export type TipoEgreso = (typeof CONFIG_LISTS.TIPO_EGRESO)[number]
export type CategDirectos = (typeof CONFIG_LISTS.CATEG_DIRECTOS)[number]
export type CategIndirectos = (typeof CONFIG_LISTS.CATEG_INDIRECTOS)[number]
export type CondicionPago = (typeof CONFIG_LISTS.CONDICION_PAGO)[number]
export type TipoVariacion = (typeof CONFIG_LISTS.TIPO_VARIACION)[number]
export type CausaDesvio = (typeof CONFIG_LISTS.CAUSA_DESVIO)[number]
export type CategGastoFijo = (typeof CONFIG_LISTS.CATEG_GASTO_FIJO)[number]

export const ESTADO_OPERATIVO_CONFIG: Record<EstadoOperativo, { label: string; color: string; bgColor: string }> = {
  Pendiente:           { label: 'Pendiente',        color: 'text-amber-700',  bgColor: 'bg-amber-100'  },
  Planificado:         { label: 'Planificado',      color: 'text-purple-700', bgColor: 'bg-purple-100' },
  'En fabricación':    { label: 'En fabricación',   color: 'text-blue-700',   bgColor: 'bg-blue-100'   },
  'En montaje':        { label: 'En montaje',       color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  Entregado:           { label: 'Entregado',        color: 'text-teal-700',   bgColor: 'bg-teal-100'   },
  Cerrado:             { label: 'Cerrado',          color: 'text-gray-600',   bgColor: 'bg-gray-100'   },
}

export const ESTADO_COMERCIAL_CONFIG: Record<EstadoComercial, { color: string; bgColor: string }> = {
  Pedido:               { color: 'text-gray-600',   bgColor: 'bg-gray-100'   },
  'En presupuestación': { color: 'text-blue-700',   bgColor: 'bg-blue-100'   },
  Enviado:               { color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  'En negociación':      { color: 'text-purple-700', bgColor: 'bg-purple-100' },
  Aceptado:               { color: 'text-green-700',  bgColor: 'bg-green-100'  },
  Rechazado:              { color: 'text-red-700',    bgColor: 'bg-red-100'    },
  Represupuestado:        { color: 'text-amber-700',  bgColor: 'bg-amber-100'  },
  Cancelado:              { color: 'text-gray-600',   bgColor: 'bg-gray-100'   },
}
