import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { CONFIG_LISTS } from '@/modules/porte'
import { useMetodosCobro, useMetodosPago, useCajas, useMetodoCobroActions, useMetodoPagoActions } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'

// ─── Métodos de cobro/pago (sección 4/7 del pedido) ────────────────────────
// A diferencia de las listas de arriba (todavía sin persistir — ver TODO en
// handleAdd), estos sí escriben en Supabase: los usan las RPC financieras
// (get_pendiente_acreditacion, get_disponible_financiero, etc.) en tiempo real.
function MetodosFinancierosConfig() {
  const { user } = useAuth()
  const metodosCobro = useMetodosCobro()
  const metodosPago = useMetodosPago()
  const cajas = useCajas()
  const { updateMetodoCobro } = useMetodoCobroActions()
  const { updateMetodoPago } = useMetodoPagoActions()

  return (
    <>
      <div className="bg-white rounded-2xl border border-border p-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Métodos de cobro</h3>
        <div className="space-y-3">
          {metodosCobro.map(m => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium min-w-24">{m.nombre}</span>
              <label className="text-xs text-muted-foreground">Días acreditación</label>
              <input
                type="number" min="0" step="1" defaultValue={m.diasAcreditacion}
                onBlur={e => { const v = Number(e.target.value); if (v !== m.diasAcreditacion && user) { updateMetodoCobro(m.id, { diasAcreditacion: v }); toast.success('Método actualizado') } }}
                className="w-16 h-9 px-2 rounded-lg border border-border text-sm"
              />
              <label className="text-xs text-muted-foreground">Comisión %</label>
              <input
                type="number" min="0" max="100" step="0.01" defaultValue={m.comisionPorcentaje * 100}
                onBlur={e => { const v = Number(e.target.value) / 100; if (v !== m.comisionPorcentaje && user) { updateMetodoCobro(m.id, { comisionPorcentaje: v }); toast.success('Método actualizado') } }}
                className="w-20 h-9 px-2 rounded-lg border border-border text-sm"
              />
              <span className="text-xs text-muted-foreground">→ {cajas.find(c => c.id === m.cajaId)?.nombre ?? 'sin caja'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Métodos de pago</h3>
        <div className="space-y-3">
          {metodosPago.map(m => {
            // Caja Negra solo admite instrumentos INMEDIATO — no ofrecerla acá
            // para Cheque/Cuenta corriente/Tarjeta (0022_finanzas_regla_caja_instrumento.sql).
            const cajasCompatibles = m.tipo === 'INMEDIATO' ? cajas : cajas.filter(c => c.tipoCaja === 'BLANCA')
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium min-w-32">{m.nombre}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{m.tipo}</span>
                <label className="text-xs text-muted-foreground">Caja por defecto</label>
                <select
                  defaultValue={m.cajaId ?? ''}
                  onChange={e => { if (user) { updateMetodoPago(m.id, { cajaId: e.target.value || null }); toast.success('Método actualizado') } }}
                  className="h-9 px-2 rounded-lg border border-border text-sm"
                >
                  <option value="">Sin definir</option>
                  {cajasCompatibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

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
        <MetodosFinancierosConfig />
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
