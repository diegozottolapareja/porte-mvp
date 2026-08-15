import type { ExtractedDocumentData } from './documentSchemas.js';
import { TIPO_EGRESO, TIPO_INGRESO, CATEG_DIRECTOS, CATEG_INDIRECTOS } from './configLists.js';
import { CATEGORIA } from '../presupuestos.js';

// Prefijo "_" — código compartido dentro del bundle de /api, no una ruta.
//
// Nunca se ejecuta una acción solo porque OpenAI devolvió un JSON con la forma
// correcta — acá se valida contra las reglas de negocio reales antes de que
// el resultado llegue al Action Executor. `cuenta`/`caja` (tesorería) nunca
// se piden acá: no están en ningún documento comercial real, se preguntan
// siempre en la confirmación conversacional (ver SYSTEM_PROMPT).

const CATEGORIA_EGRESO = [...new Set([...CATEG_DIRECTOS, ...CATEG_INDIRECTOS])];
const MATH_TOLERANCE_RATIO = 0.02;

export interface ValidationResult<T> {
  ok: boolean;
  payload?: T;
  missingFields: string[];
  warnings: string[];
}

function checkMathConsistency(data: ExtractedDocumentData): string[] {
  if (data.subtotal == null || data.impuestos == null || data.monto == null) return [];
  const expected = data.subtotal + data.impuestos;
  const tolerance = Math.max(1, Math.abs(data.monto) * MATH_TOLERANCE_RATIO);
  if (Math.abs(expected - data.monto) > tolerance) {
    return [`subtotal (${data.subtotal}) + impuestos (${data.impuestos}) no coincide con el total (${data.monto})`];
  }
  return [];
}

export interface EgresoPayload {
  fecha?: string; tipoEgreso: string; proveedor: string; categoria: string; monto: number;
  estado: 'Incompleto';
}

// Una factura (expense) siempre trae un proveedor y un monto — esos dos datos
// no se pueden inventar, así que son los únicos que bloquean la carga (mismo
// criterio que "cliente" en validateBudget). El resto (tipoEgreso, categoria)
// se completa con un default razonable ("OTROS") en vez de bloquear, porque
// una factura de compra real rara vez trae esa clasificación interna de
// Porte. El egreso se crea igual, siempre marcado "Incompleto": todavía no
// hay forma de asociar un egreso cargado por factura a una venta/obra.
export function validateExpense(data: ExtractedDocumentData): ValidationResult<EgresoPayload> {
  const missingFields: string[] = [];
  const monto = data.monto ?? (data.subtotal != null && data.impuestos != null ? data.subtotal + data.impuestos : null);

  if (!data.proveedor) missingFields.push('proveedor');
  if (monto == null || monto <= 0) missingFields.push('monto');

  if (missingFields.length > 0) return { ok: false, missingFields, warnings: [] };

  const warnings = checkMathConsistency(data);

  let tipoEgreso = data.tipoEgreso ?? undefined;
  if (!tipoEgreso || !TIPO_EGRESO.includes(tipoEgreso)) {
    tipoEgreso = 'OTROS';
    warnings.push('tipo de egreso (no encontrado en el documento, uso OTROS)');
  }

  let categoria = data.categoria?.toUpperCase();
  if (!categoria || !CATEGORIA_EGRESO.includes(categoria)) {
    categoria = 'OTROS';
    warnings.push('categoría (no encontrada en el documento, uso OTROS)');
  }

  return {
    ok: true,
    payload: {
      fecha: data.fecha ?? undefined,
      tipoEgreso,
      proveedor: data.proveedor!,
      categoria,
      monto: monto!,
      estado: 'Incompleto',
    },
    missingFields: [],
    warnings,
  };
}

export interface IngresoPayload {
  fecha?: string; tipoIngreso: string; concepto?: string; monto: number;
}

export function validateIncome(data: ExtractedDocumentData): ValidationResult<IngresoPayload> {
  const missingFields: string[] = [];
  const monto = data.monto ?? (data.subtotal != null && data.impuestos != null ? data.subtotal + data.impuestos : null);

  if (!data.tipoIngreso || !TIPO_INGRESO.includes(data.tipoIngreso)) missingFields.push('tipoIngreso');
  if (monto == null || monto <= 0) missingFields.push('monto');

  if (missingFields.length > 0) return { ok: false, missingFields, warnings: [] };

  return {
    ok: true,
    payload: {
      fecha: data.fecha ?? undefined,
      tipoIngreso: data.tipoIngreso!,
      concepto: data.concepto ?? undefined,
      monto: monto!,
    },
    missingFields: [],
    warnings: checkMathConsistency(data),
  };
}

export interface PresupuestoPayload {
  cliente: string; categoria: string; descripcion?: string; costoMat: number; costoMo: number;
  indVendidos?: number; impuestos?: number; comercial?: number; beneficio?: number;
  estadoComercial?: 'Incompleto';
}

// El cliente es el único dato que bloquea la creación — no se puede inventar un
// nombre. El resto (categoría, costos) se completa con un default razonable y el
// presupuesto se crea igual, marcado "Incompleto" para revisión manual después —
// así nunca queda un presupuesto de un documento real sin cargar por falta de un
// dato que el documento nunca iba a traer (ej. la categoría interna de Porte).
export function validateBudget(data: ExtractedDocumentData): ValidationResult<PresupuestoPayload> {
  if (!data.cliente) return { ok: false, missingFields: ['cliente'], warnings: [] };

  const defaulted: string[] = [];

  let categoria = data.categoria?.toUpperCase();
  if (!categoria || !CATEGORIA.includes(categoria)) {
    categoria = 'OTRO';
    defaulted.push('categoría (sin coincidencia en el documento, uso OTRO)');
  }

  // Un presupuesto clásico de Porte es una cotización al cliente (ítems + Sub
  // Total + IVA + Total) — nunca trae el desglose interno de costos
  // (materiales/mano de obra/indirectos/comercial/beneficio), eso es
  // información interna que el documento no expone. Como aproximación se usa
  // el Sub Total (precio de venta sin IVA) como costoMat y el IVA como
  // impuestos, para no perder el monto real del documento — pero sigue sin
  // ser el desglose interno real, por eso queda "Incompleto" igual.
  let costoMat = data.costoMat;
  if (costoMat == null && data.subtotal != null) {
    costoMat = data.subtotal;
    defaulted.push(`costo materiales (el documento no desglosa costos internos, se usó el Sub Total de la cotización: $${data.subtotal.toLocaleString('es-AR')})`);
  } else if (costoMat == null) {
    costoMat = 0;
    defaulted.push('costo materiales (no encontrado, uso $0)');
  }

  let costoMo = data.costoMo;
  if (costoMo == null) {
    costoMo = 0;
    defaulted.push('costo mano de obra (no encontrado, uso $0)');
  }

  let impuestos = data.impuestos;
  if (impuestos == null && data.subtotal != null && data.monto != null) {
    impuestos = data.monto - data.subtotal;
  }

  return {
    ok: true,
    payload: {
      cliente: data.cliente,
      categoria,
      descripcion: data.concepto ?? undefined,
      costoMat,
      costoMo,
      indVendidos: data.indVendidos ?? undefined,
      impuestos: impuestos ?? undefined,
      comercial: data.comercial ?? undefined,
      beneficio: data.beneficio ?? undefined,
      estadoComercial: defaulted.length > 0 ? 'Incompleto' : undefined,
    },
    missingFields: [],
    warnings: defaulted,
  };
}

