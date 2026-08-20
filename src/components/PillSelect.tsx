import { Select, SelectContent, SelectItem, SelectTrigger } from '@/app/components/ui/select'

interface PillSelectProps<T extends string> {
  value: T
  options: readonly T[]
  style: (value: T) => { label: string; color: string; bgColor: string }
  onChange: (value: T) => void
  className?: string
}

// Pill de estado que también funciona como dropdown de cambio de estado.
// Usar para reemplazar cualquier badge de solo lectura por uno editable,
// manteniendo el mismo look (pill de color).
export function PillSelect<T extends string>({ value, options, style, onChange, className = '' }: PillSelectProps<T>) {
  const current = style(value)

  return (
    <Select value={value} onValueChange={v => onChange(v as T)}>
      <SelectTrigger
        size="sm"
        onClick={e => e.stopPropagation()}
        className={`h-auto w-auto shrink-0 gap-1 rounded-full border-0 px-2 py-0.5 text-xs font-medium shadow-none focus-visible:ring-1 [&_svg]:size-3 ${current.color} ${current.bgColor} ${className}`}
      >
        {current.label}
      </SelectTrigger>
      <SelectContent align="end">
        {options.map(option => {
          const s = style(option)
          return <SelectItem key={option} value={option}>{s.label}</SelectItem>
        })}
      </SelectContent>
    </Select>
  )
}
