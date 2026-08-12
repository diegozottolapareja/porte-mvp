import { TIPO_EGRESO, TIPO_INGRESO } from './configLists';

// Prefijo "_" — código compartido dentro del bundle de /api, no una ruta.
//
// Un solo schema de "data" cubre egreso/ingreso/presupuesto en vez de un
// schema distinto por tipo (con oneOf/anyOf según documentType): los
// Structured Outputs de OpenAI en modo strict exigen que TODOS los campos de
// properties estén en required (se simula "opcional" con `["tipo", "null"]"),
// y mezclar eso con oneOf a nivel raíz es frágil. Es más simple y confiable
// tener un shape ancho con nulls que no aplican según el tipo de documento —
// el mapeo a Egreso/Ingreso/Presupuesto interpreta los campos relevantes por
// documentType, ver documentValidation.ts.

export const DOCUMENT_TYPES = ['expense', 'income', 'budget', 'budget_group', 'unknown'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface ExtractedItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
}

export interface ExtractedDocumentData {
  fecha: string | null;
  cliente: string | null;
  proveedor: string | null;
  concepto: string | null;
  tipoEgreso: string | null;
  tipoIngreso: string | null;
  categoria: string | null;
  costoMat: number | null;
  costoMo: number | null;
  indVendidos: number | null;
  impuestos: number | null;
  comercial: number | null;
  beneficio: number | null;
  subtotal: number | null;
  monto: number | null;
  items: ExtractedItem[] | null;
}

export interface DocumentExtractionEnvelope {
  documentType: DocumentType;
  confidence: number;
  data: ExtractedDocumentData | null;
  documents: ExtractedDocumentData[] | null;
}

const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    quantity: { type: ['number', 'null'] },
    unitPrice: { type: ['number', 'null'] },
  },
  required: ['description', 'quantity', 'unitPrice'],
  additionalProperties: false,
};

const DATA_SCHEMA = {
  type: 'object',
  properties: {
    fecha: { type: ['string', 'null'], description: 'Fecha del documento en formato YYYY-MM-DD, tal como figura ahí — nunca la fecha de hoy.' },
    cliente: { type: ['string', 'null'], description: 'Nombre del cliente — solo para budget/budget_group o income.' },
    proveedor: { type: ['string', 'null'], description: 'Nombre del proveedor — solo para expense.' },
    concepto: { type: ['string', 'null'], description: 'Descripción breve del documento.' },
    tipoEgreso: { type: ['string', 'null'], enum: [...TIPO_EGRESO, null], description: 'Solo para expense.' },
    tipoIngreso: { type: ['string', 'null'], enum: [...TIPO_INGRESO, null], description: 'Solo para income.' },
    categoria: { type: ['string', 'null'], description: 'Categoría del gasto o del presupuesto, según corresponda — se valida contra las listas del sistema, no inventar.' },
    costoMat: { type: ['number', 'null'], description: 'Solo para budget.' },
    costoMo: { type: ['number', 'null'], description: 'Solo para budget.' },
    indVendidos: { type: ['number', 'null'] },
    impuestos: { type: ['number', 'null'] },
    comercial: { type: ['number', 'null'] },
    beneficio: { type: ['number', 'null'] },
    subtotal: { type: ['number', 'null'] },
    monto: { type: ['number', 'null'], description: 'Monto/total final del documento — para expense/income.' },
    items: { type: ['array', 'null'], items: ITEM_SCHEMA },
  },
  required: [
    'fecha', 'cliente', 'proveedor', 'concepto', 'tipoEgreso', 'tipoIngreso', 'categoria',
    'costoMat', 'costoMo', 'indVendidos', 'impuestos', 'comercial', 'beneficio', 'subtotal', 'monto', 'items',
  ],
  additionalProperties: false,
};

export const DOCUMENT_EXTRACTION_SCHEMA = {
  name: 'document_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      documentType: { type: 'string', enum: [...DOCUMENT_TYPES] },
      confidence: { type: 'number', description: 'Entre 0 y 1 — qué tan seguro estás de la clasificación.' },
      data: { ...DATA_SCHEMA, type: ['object', 'null'] },
      documents: {
        type: ['array', 'null'],
        items: DATA_SCHEMA,
        description: 'Solo para budget_group — un elemento por presupuesto encontrado en el documento.',
      },
    },
    required: ['documentType', 'confidence', 'data', 'documents'],
    additionalProperties: false,
  },
} as const;
