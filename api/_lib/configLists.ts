// Prefijo "_" — código compartido dentro del bundle de /api, no una ruta.
// Mantener sincronizado con src/modules/porte/data/config.ts (CONFIG_LISTS).
// Se duplica acá porque las funciones de /api se bundlean por separado y no
// comparten módulos con src/ (mismo criterio que CATEGORIA en api/presupuestos.ts).

export const TIPO_INGRESO = ['ANTICIPO', 'SALDO', 'PAGO PARCIAL', 'OTRO'];
export const TIPO_EGRESO = ['MATERIALES', 'MANO DE OBRA', 'FLETE', 'COMBUSTIBLE', 'HERRAMIENTAS', 'SERVICIOS', 'IMPUESTOS', 'OTROS'];
export const CATEG_DIRECTOS = ['MATERIALES', 'MANO DE OBRA', 'FLETE', 'HERRAMIENTAS', 'SERVICIOS'];
export const CATEG_INDIRECTOS = ['ALQUILER', 'SUELDOS', 'SERVICIOS', 'IMPUESTOS', 'HERRAMIENTAS', 'COMBUSTIBLE', 'OTROS'];
export const CUENTAS = ['Banco Macro', 'MercadoPago', 'Efectivo Blanco', 'Efectivo Negro'];
export const TIPO_CAJA = ['BLANCA', 'NEGRA'];
export const ESTADO_INGRESO = ['Confirmado', 'Pendiente'];
export const ESTADO_EGRESO = ['Confirmado', 'Pendiente', 'Emitido', 'Incompleto'];
