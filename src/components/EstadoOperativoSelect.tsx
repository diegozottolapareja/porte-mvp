import { Select, SelectContent, SelectItem, SelectTrigger } from '@/app/components/ui/select'
import { CONFIG_LISTS, ESTADO_OPERATIVO_CONFIG, type EstadoOperativo } from '@/modules/porte'

interface EstadoOperativoSelectProps {
  value: EstadoOperativo
  onChange: (value: EstadoOperativo) => void
  className?: string
}

// Reemplaza la pill de solo lectura de estado operativo por un select funcional,
// manteniendo el mismo look (pill de color) tanto en la lista de ventas como en el detalle.
export function EstadoOperativoSelect({ value, onChange, className = '' }: EstadoOperativoSelectProps) {
  const estado = ESTADO_OPERATIVO_CONFIG[value]

  return (
    <Select value={value} onValueChange={v => onChange(v as EstadoOperativo)}>
      <SelectTrigger
        size="sm"
        className={`h-auto w-auto shrink-0 gap-1 rounded-full border-0 px-2 py-0.5 text-xs font-medium shadow-none focus-visible:ring-1 [&_svg]:size-3 ${estado.color} ${estado.bgColor} ${className}`}
      >
        {estado.label}
      </SelectTrigger>
      <SelectContent align="end">
        {CONFIG_LISTS.ESTADO_OPERATIVO.map(e => (
          <SelectItem key={e} value={e}>{ESTADO_OPERATIVO_CONFIG[e].label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
