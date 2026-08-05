import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { CONFIG_LISTS } from '@/modules/porte'

const LIST_LABELS: Record<keyof typeof CONFIG_LISTS, string> = {
  CATEGORIA: 'Categorías',
  ESTADO_COMERCIAL: 'Estado comercial',
  ESTADO_OPERATIVO: 'Estado operativo',
  CUENTAS: 'Cuentas',
  TIPO_CAJA: 'Tipo de caja',
  TIPO_INGRESO: 'Tipo de ingreso',
  TIPO_EGRESO: 'Tipo de egreso',
  CATEG_DIRECTOS: 'Categorías directas',
  CATEG_INDIRECTOS: 'Categorías indirectas',
  CONDICION_PAGO: 'Condición de pago',
  TIPO_VARIACION: 'Tipo de variación',
  CAUSA_DESVIO: 'Causa de desvío',
  CATEG_GASTO_FIJO: 'Categorías de gasto fijo',
  RESPONSABLE: 'Responsables',
}

export default function ConfigPage() {
  const navigate = useNavigate()
  const [lists, setLists] = useState<Record<string, string[]>>(
    Object.fromEntries(Object.entries(CONFIG_LISTS).map(([k, v]) => [k, [...v]]))
  )
  const [newValue, setNewValue] = useState<Record<string, string>>({})

  const handleAdd = (key: string) => {
    const value = (newValue[key] ?? '').trim()
    if (!value) return
    // TODO: reemplazar con api.put('/config/lists', { key, values })
    setLists(prev => ({ ...prev, [key]: [...prev[key], value] }))
    setNewValue(prev => ({ ...prev, [key]: '' }))
    toast.success('Lista actualizada')
  }

  const handleRemove = (key: string, value: string) => {
    setLists(prev => ({ ...prev, [key]: prev[key].filter(v => v !== value) }))
    toast.success('Lista actualizada')
  }

  return (
    <AppShell title="Configuración" onBack={() => navigate(-1)}>
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
        {Object.entries(lists).map(([key, values]) => (
          <div key={key} className="bg-white rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {LIST_LABELS[key as keyof typeof CONFIG_LISTS] ?? key}
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {values.map(v => (
                <span key={v} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-sm">
                  {v}
                  <button onClick={() => handleRemove(key, v)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newValue[key] ?? ''}
                onChange={e => setNewValue(prev => ({ ...prev, [key]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd(key)}
                placeholder="Nuevo valor..."
                className="flex-1 h-10 px-3 rounded-xl border border-border text-sm"
              />
              <button onClick={() => handleAdd(key)} className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}
