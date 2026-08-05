import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { PermissionGuard } from '../components/PermissionGuard'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { calcDiferencia, CONFIG_LISTS, type GastoFijo, type CategGastoFijo, type Periodicidad, type EstadoGastoFijo, type Cuenta, type TipoCaja } from '@/modules/porte'
import { usePorteData, gastoFijoKey } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/format'

const ESTADO_STYLE: Record<string, string> = {
  PAGADO: 'bg-green-100 text-green-700',
  PREVISTO: 'bg-amber-100 text-amber-700',
  VENCIDO: 'bg-red-100 text-red-700',
}

const PERIODICIDADES: Periodicidad[] = ['Mensual', 'Bimestral', 'Trimestral', 'Anual', 'Único']
const ESTADOS: EstadoGastoFijo[] = ['PREVISTO', 'PAGADO', 'VENCIDO']

export default function GastosFijosPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { gastosFijos, softDeleteGastoFijo } = usePorteData()
  const [editing, setEditing] = useState<GastoFijo | 'nuevo' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<GastoFijo | null>(null)

  const activos = gastosFijos.filter(g => g.activo)

  return (
    <AppShell
      title="Gastos fijos"
      onBack={() => navigate(-1)}
      actions={
        <PermissionGuard permission="gastosfijos:write">
          <button onClick={() => setEditing('nuevo')} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
            <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
          </button>
        </PermissionGuard>
      }
    >
      <EntityList
        items={activos}
        keyExtractor={g => gastoFijoKey(g)}
        emptyTitle="Sin gastos fijos"
        emptyAction={can('gastosfijos:write') ? { label: 'Nuevo gasto fijo', onClick: () => setEditing('nuevo') } : undefined}
        renderItem={g => {
          const diferencia = calcDiferencia(g)
          return (
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-sm">{g.concepto}</p>
                  <p className="text-xs text-muted-foreground">{g.categoria} · {g.periodicidad} · {formatDate(g.fecha)}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_STYLE[g.estado]}`}>{g.estado}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                <div><p className="text-[11px] text-muted-foreground uppercase">Previsto</p><p className="font-medium">{formatCurrency(g.montoPrevisto)}</p></div>
                <div><p className="text-[11px] text-muted-foreground uppercase">Real</p><p className="font-medium">{g.montoReal === null ? '—' : formatCurrency(g.montoReal)}</p></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase">Diferencia</p>
                  <p className={`font-medium ${diferencia === null ? '' : diferencia > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {diferencia === null ? '—' : formatCurrency(diferencia)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 border-t border-border pt-2">
                <PermissionGuard permission="gastosfijos:write">
                  <button onClick={() => setEditing(g)} className="text-sm font-medium text-primary">Editar</button>
                </PermissionGuard>
                <PermissionGuard permission="gastosfijos:delete">
                  <button onClick={() => setPendingDelete(g)} className="text-sm font-medium text-destructive">Eliminar</button>
                </PermissionGuard>
              </div>
            </div>
          )
        }}
      />

      <GastoFijoDialog value={editing} onClose={() => setEditing(null)} />

      <ConfirmModal
        open={!!pendingDelete}
        onOpenChange={open => !open && setPendingDelete(null)}
        title="Eliminar gasto fijo"
        description={pendingDelete ? `Se dará de baja "${pendingDelete.concepto}". No se borra físicamente, queda inactivo.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) softDeleteGastoFijo(gastoFijoKey(pendingDelete))
          toast.success('Gasto fijo eliminado')
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}

function GastoFijoDialog({ value, onClose }: { value: GastoFijo | 'nuevo' | null; onClose: () => void }) {
  const { user } = useAuth()
  const { addGastoFijo, updateGastoFijo } = usePorteData()
  const existing = value && value !== 'nuevo' ? value : undefined

  const [fecha, setFecha] = useState('')
  const [concepto, setConcepto] = useState('')
  const [categoria, setCategoria] = useState<CategGastoFijo>(CONFIG_LISTS.CATEG_GASTO_FIJO[0])
  const [montoPrevisto, setMontoPrevisto] = useState('')
  const [montoReal, setMontoReal] = useState('')
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('Mensual')
  const [cuenta, setCuenta] = useState<Cuenta>(CONFIG_LISTS.CUENTAS[0])
  const [tipoCaja, setTipoCaja] = useState<TipoCaja>('BLANCA')
  const [estado, setEstado] = useState<EstadoGastoFijo>('PREVISTO')
  const [observaciones, setObservaciones] = useState('')

  const open = value !== null

  const resetIfNeeded = () => {
    if (existing) {
      setFecha(existing.fecha); setConcepto(existing.concepto); setCategoria(existing.categoria)
      setMontoPrevisto(existing.montoPrevisto.toString()); setMontoReal(existing.montoReal?.toString() ?? '')
      setPeriodicidad(existing.periodicidad); setCuenta(existing.cuenta); setTipoCaja(existing.tipoCaja)
      setEstado(existing.estado); setObservaciones(existing.observaciones ?? '')
    } else {
      setFecha(new Date().toISOString().slice(0, 10)); setConcepto(''); setCategoria(CONFIG_LISTS.CATEG_GASTO_FIJO[0])
      setMontoPrevisto(''); setMontoReal(''); setPeriodicidad('Mensual'); setCuenta(CONFIG_LISTS.CUENTAS[0])
      setTipoCaja('BLANCA'); setEstado('PREVISTO'); setObservaciones('')
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (next) resetIfNeeded()
    if (!next) onClose()
  }

  const handleSave = () => {
    if (!concepto || !montoPrevisto || !user) {
      toast.error('Completá concepto y monto previsto')
      return
    }
    const payload = {
      fecha, concepto, categoria,
      montoPrevisto: Number(montoPrevisto),
      montoReal: montoReal === '' ? null : Number(montoReal),
      periodicidad, cuenta, tipoCaja, estado,
      proveedorId: existing?.proveedorId ?? null,
      observaciones: observaciones || undefined,
    }
    if (existing) {
      updateGastoFijo(gastoFijoKey(existing), payload)
      toast.success('Gasto fijo actualizado')
    } else {
      addGastoFijo(payload, user.id)
      toast.success('Gasto fijo creado')
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{existing ? existing.concepto : 'Nuevo gasto fijo'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Concepto *</label>
              <input value={concepto} onChange={e => setConcepto(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Categoría</label>
            <div className="flex gap-2 flex-wrap">
              {CONFIG_LISTS.CATEG_GASTO_FIJO.map(c => (
                <button key={c} onClick={() => setCategoria(c)} className={`px-3 py-2 rounded-xl border text-sm ${categoria === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Monto previsto *</label>
              <input type="number" value={montoPrevisto} onChange={e => setMontoPrevisto(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Monto real</label>
              <input type="number" value={montoReal} onChange={e => setMontoReal(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Periodicidad</label>
            <div className="flex gap-2 flex-wrap">
              {PERIODICIDADES.map(p => (
                <button key={p} onClick={() => setPeriodicidad(p)} className={`px-3 py-2 rounded-xl border text-sm ${periodicidad === p ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Cuenta</label>
            <div className="flex gap-2 flex-wrap">
              {CONFIG_LISTS.CUENTAS.map(c => (
                <button key={c} onClick={() => setCuenta(c)} className={`px-3 py-2 rounded-xl border text-sm ${cuenta === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Caja</label>
              <div className="flex gap-2">
                {CONFIG_LISTS.TIPO_CAJA.map(c => (
                  <button key={c} onClick={() => setTipoCaja(c)} className={`flex-1 py-2.5 rounded-xl border text-sm ${tipoCaja === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Estado</label>
              <div className="flex gap-2">
                {ESTADOS.map(e => (
                  <button key={e} onClick={() => setEstado(e)} className={`flex-1 py-2.5 rounded-xl border text-xs ${estado === e ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{e}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Observaciones</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-2xl border border-border text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
