import { PillSelect } from '@/components/PillSelect'
import { CONFIG_LISTS, ESTADO_OPERATIVO_CONFIG, type EstadoOperativo } from '@/modules/porte'

interface EstadoOperativoSelectProps {
  value: EstadoOperativo
  onChange: (value: EstadoOperativo) => void
  className?: string
}

// Reemplaza la pill de solo lectura de estado operativo por un select funcional,
// manteniendo el mismo look (pill de color) tanto en la lista de ventas como en el detalle.
export function EstadoOperativoSelect({ value, onChange, className }: EstadoOperativoSelectProps) {
  return (
    <PillSelect
      value={value}
      options={CONFIG_LISTS.ESTADO_OPERATIVO}
      style={v => ESTADO_OPERATIVO_CONFIG[v]}
      onChange={onChange}
      className={className}
    />
  )
}
