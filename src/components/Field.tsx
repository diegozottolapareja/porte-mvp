import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  required?: boolean
  className?: string
  children: ReactNode
}

/** Label + control de un form — usar junto con el wrapper `lg:grid lg:grid-cols-2` de los forms
 * de alta/edición (ver EgresoFormPage/IngresoFormPage/PresupuestoFormPage) para que en desktop
 * se vean como una pantalla web (grilla de 2 columnas), no como una sola columna angosta de mobile.
 * `className` pasa `lg:col-span-2` en los campos que deben ocupar todo el ancho en desktop. */
export function Field({ label, required, className = '', children }: FieldProps) {
  return (
    <div className={className}>
      <label className="text-sm text-muted-foreground mb-1.5 block">{label}{required && <span className="text-destructive"> *</span>}</label>
      {children}
    </div>
  )
}
