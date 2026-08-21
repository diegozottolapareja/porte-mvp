import { Landmark } from 'lucide-react'

export type FiltroEstadoAdmin = 'todos' | 'Pendiente' | 'Confirmado'

const ESTADO_LABEL: Record<FiltroEstadoAdmin, string> = {
  todos: 'Todos',
  Pendiente: 'Pendientes',
  Confirmado: 'Confirmados',
}

interface MovimientoFilterBarProps {
  filtroEstado: FiltroEstadoAdmin
  onFiltroEstadoChange: (value: FiltroEstadoAdmin) => void
  soloConCheque: boolean
  onSoloConChequeChange: (value: boolean) => void
}

/**
 * Filtro combinable de estado administrativo + "tiene cheque real asociado".
 * Compartido por EgresosPage/IngresosPage para que ambas listas filtren con
 * el mismo criterio que pintan sus pills (nunca una función propia por
 * pantalla) — "Cheque" no es un estado administrativo, es un criterio
 * independiente que se combina con Todos/Pendientes/Confirmados.
 */
export function MovimientoFilterBar({ filtroEstado, onFiltroEstadoChange, soloConCheque, onSoloConChequeChange }: MovimientoFilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1 bg-muted rounded-xl p-1">
        {(['todos', 'Pendiente', 'Confirmado'] as const).map(v => (
          <button
            key={v}
            onClick={() => onFiltroEstadoChange(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtroEstado === v ? 'bg-white text-gray-900 shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {ESTADO_LABEL[v]}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSoloConChequeChange(!soloConCheque)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
          soloConCheque ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-border text-muted-foreground'
        }`}
      >
        <Landmark className="w-3.5 h-3.5" />
        Cheques
      </button>
    </div>
  )
}
