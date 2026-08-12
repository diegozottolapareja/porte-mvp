import type { ExtractedDocumentData } from './documentSchemas';
import { TIPO_EGRESO, TIPO_INGRESO, CATEG_DIRECTOS, CATEG_INDIRECTOS } from './configLists';
import { CATEGORIA } from '../presupuestos';

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
  fecha?: string; tipoEgreso: string; proveedor?: string; categoria: string; monto: number;
}

export function validateExpense(data: ExtractedDocumentData): ValidationResult<EgresoPayload> {
  const missingFields: string[] = [];
  const monto = data.monto ?? (data.subtotal != null && data.impuestos != null ? data.subtotal + data.impuestos : null);

  if (!data.proveedor) missingFields.push('proveedor');
  if (!data.tipoEgreso || !TIPO_EGRESO.includes(data.tipoEgreso)) missingFields.push('tipoEgreso');
  if (!data.categoria || !CATEGORIA_EGRESO.includes(data.categoria.toUpperCase())) missingFields.push('categoria');
  if (monto == null || monto <= 0) missingFields.push('monto');

  if (missingFields.length > 0) return { ok: false, missingFields, warnings: [] };

  return {
    ok: true,
    payload: {
      fecha: data.fecha ?? undefined,
      tipoEgreso: data.tipoEgreso!,
      proveedor: data.proveedor ?? undefined,
      categoria: data.categoria!.toUpperCase(),
      monto: monto!,
    },
    missingFields: [],
    warnings: checkMathConsistency(data),
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
}

export function validateBudget(data: ExtractedDocumentData): ValidationResult<PresupuestoPayload> {
  const missingFields: string[] = [];

  if (!data.cliente) missingFields.push('cliente');
  if (!data.categoria || !CATEGORIA.includes(data.categoria.toUpperCase())) missingFields.push('categoria');
  if (data.costoMat == null) missingFields.push('costoMat');
  if (data.costoMo == null) missingFields.push('costoMo');

  if (missingFields.length > 0) return { ok: false, missingFields, warnings: [] };

  return {
    ok: true,
    payload: {
      cliente: data.cliente!,
      categoria: data.categoria!.toUpperCase(),
      descripcion: data.concepto ?? undefined,
      costoMat: data.costoMat!,
      costoMo: data.costoMo!,
      indVendidos: data.indVendidos ?? undefined,
      impuestos: data.impuestos ?? undefined,
      comercial: data.comercial ?? undefined,
      beneficio: data.beneficio ?? undefined,
    },
    missingFields: [],
    warnings: [],
  };
}

export function validateBudgetGroup(documents: ExtractedDocumentData[]): ValidationResult<PresupuestoPayload[]> {
  if (documents.length === 0) return { ok: false, missingFields: ['documents'], warnings: [] };

  const results = documents.map(validateBudget);
  const invalidIndexes = results
    .map((r, i) => (r.ok ? null : i))
    .filter((i): i is number => i !== null);

  if (invalidIndexes.length > 0) {
    return {
      ok: false,
      missingFields: invalidIndexes.map((i) => `presupuesto #${i + 1}: ${results[i].missingFields.join(', ')}`),
      warnings: [],
    };
  }

  return { ok: true, payload: results.map((r) => r.payload!), missingFields: [], warnings: [] };
}
