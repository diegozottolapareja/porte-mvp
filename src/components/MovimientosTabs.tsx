import { useNavigate } from 'react-router'

interface MovimientosTabsProps {
  active: 'ingresos' | 'egresos'
}

// Selector rápido entre Ingresos y Egresos — evita depender del menú para moverse entre ambos.
export function MovimientosTabs({ active }: MovimientosTabsProps) {
  const navigate = useNavigate()

  return (
    <div className="flex gap-2 p-1 bg-muted rounded-2xl">
      <button
        onClick={() => navigate('/ingresos')}
        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${active === 'ingresos' ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}
      >
        Ingresos
      </button>
      <button
        onClick={() => navigate('/egresos')}
        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${active === 'egresos' ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}
      >
        Egresos
      </button>
    </div>
  )
}
