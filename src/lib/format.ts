import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const currencyFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—'
  return currencyFormatter.format(value)
}

export function formatDate(value: string | undefined | null, pattern = 'dd/MM/yyyy'): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), pattern, { locale: es })
  } catch {
    return value
  }
}

/** Fecha calendario local (no UTC) en formato YYYY-MM-DD — usar en vez de `date.toISOString().slice(0, 10)`,
 * que corre en UTC y corre la fecha un día para adelante en horario nocturno de Argentina (UTC-3). */
export function localDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayLocal(): string {
  return localDateString(new Date())
}
