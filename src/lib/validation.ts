/** true si el string representa un número negativo — usar para bloquear costos que nunca pueden ser negativos. */
export function isNegativeAmount(value: string): boolean {
  return value !== '' && Number(value) < 0
}

/** Parsea un monto que debe ser estrictamente mayor a cero. Devuelve null si está vacío, no es número, o es <= 0. */
export function toPositiveAmount(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  if (Number.isNaN(n) || n <= 0) return null
  return n
}
