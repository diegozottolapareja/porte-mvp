// ─── Entidad principal: Venta — PORTE ─────────────────────────────────────────

export type FieldType = 'text' | 'number' | 'currency' | 'date' | 'time' | 'select' | 'badge' | 'phone' | 'textarea'

export interface EntityField {
  key: string
  label: string
  type: FieldType
  sortable?: boolean
  filterable?: boolean
  showInTable?: boolean
  showInCard?: boolean
  showInForm?: boolean
  required?: boolean
  options?: Array<{ value: string; label: string }>
}

export interface EntityStatus {
  key: string
  label: string
  color: string
  bgColor: string
}

export const entityConfig = {
  nameSingular: 'Venta',
  namePlural: 'Ventas',
  primaryKey: 'id',

  fields: [
    { key: 'id',          label: 'N° venta',       type: 'text',     required: true, showInTable: true, showInCard: true },
    { key: 'cliente',     label: 'Cliente',         type: 'text',     required: true, showInTable: true, showInCard: true, sortable: true, filterable: true },
    { key: 'montoTotal',  label: 'Monto total',     type: 'currency', showInTable: true },
    { key: 'ventaFinal',  label: 'Venta final',     type: 'currency', showInTable: true, showInCard: true, showInForm: true },
    { key: 'condPago',    label: 'Condición de pago', type: 'select', showInForm: true },
    { key: 'vencCobro',   label: 'Vencimiento cobro', type: 'date',   showInForm: true },
    { key: 'entregaCompr',label: 'Entrega comprometida', type: 'date', showInForm: true },
    { key: 'entregaReal', label: 'Entrega real',    type: 'date',     showInForm: true },
    { key: 'estadoOp',    label: 'Estado',           type: 'badge',   showInTable: true, showInCard: true, filterable: true },
  ] as EntityField[],

  statuses: [
    { key: 'Pendiente',        label: 'Pendiente',        color: 'text-amber-700',   bgColor: 'bg-amber-100'  },
    { key: 'Planificado',      label: 'Planificado',      color: 'text-purple-700',  bgColor: 'bg-purple-100' },
    { key: 'En fabricación',   label: 'En fabricación',   color: 'text-blue-700',    bgColor: 'bg-blue-100'   },
    { key: 'En montaje',       label: 'En montaje',       color: 'text-indigo-700',  bgColor: 'bg-indigo-100' },
    { key: 'Entregado',        label: 'Entregado',        color: 'text-teal-700',    bgColor: 'bg-teal-100'   },
    { key: 'Cerrado',          label: 'Cerrado',          color: 'text-gray-600',    bgColor: 'bg-gray-100'   },
  ] as EntityStatus[],

  tableColumns: ['id', 'cliente', 'ventaFinal', 'estadoOp'],
  cardFields:   ['ventaFinal', 'condPago', 'vencCobro'],
  formFields:   ['ventaFinal', 'condPago', 'vencCobro', 'entregaCompr', 'entregaReal'],
} as const
