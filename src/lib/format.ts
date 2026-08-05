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
