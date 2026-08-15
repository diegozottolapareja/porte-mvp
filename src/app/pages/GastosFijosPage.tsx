import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { CardActionsMenu } from '@/components/CardActionsMenu'
import { PermissionGuard } from '../components/PermissionGuard'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { PillSelect } from '@/components/PillSelect'
import { calcDiferencia, CONFIG_LISTS, type GastoFijo, type CategGastoFijo, type Periodicidad, type EstadoGastoFijo, type Cuenta, type TipoCaja } from '@/modules/porte'
import { useGastosFijos, useGastoFijoActions } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, todayLocal } from '@/lib/format'
import { isNegativeAmount } from '@/lib/validation'

const ESTADO_STYLE: Record<EstadoGastoFijo, { label: string; color: string; bgColor: string }> = {
  PAGADO: { label: 'PAGADO', color: 'text-green-700', bgColor: 'bg-green-100' },
  PREVISTO: { label: 'PREVISTO', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  VENCIDO: { label: 'VENCIDO', color: 'text-red-700', bgColor: 'bg-red-100' },
}

const PERIODICIDADES: Periodicidad[] = ['Mensual', 'Bimestral', 'Trimestral', 'Anual', 'Único']
const ESTADOS: EstadoGastoFijo[] = ['PREVISTO', 'PAGADO', 'VENCIDO']

export default function GastosFijosPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const gastosFijos = useGastosFijos()
  const { updateGastoFijo, softDeleteGastoFijo } = useGastoFijoActions()
  const [editing, setEditing] = useState<GastoFijo | 'nuevo' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<GastoFijo | null>(null)
  const puedeEditar = can('gastosfijos:write')
  const puedeEliminar = can('gastosfijos:delete')

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
        keyExtractor={g => g.id}
        emptyTitle="Sin gastos fijos"
        emptyAction={can('gastosfijos:write') ? { label: 'Nuevo gasto fijo', onClick: () => setEditing('nuevo') } : undefined}
        renderItem={g => {
          const diferencia = calcDiferencia(g)
          return (
            <EntityCard
              title={g.concepto}
              subtitle={`${g.categoria} · ${g.periodicidad} · ${formatDate(g.fecha)}`}
              statusNode={
                puedeEditar ? (
                  <PillSelect
                    value={g.estado}
                    options={ESTADOS}
                    style={v => ESTADO_STYLE[v]}
                    onChange={estado => updateGastoFijo(g.id, { estado })}
                  />
                ) : (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_STYLE[g.estado].color} ${ESTADO_STYLE[g.estado].bgColor}`}>{g.estado}</span>
                )
              }
              fields={[
                { label: 'Previsto', value: formatCurrency(g.montoPrevisto), row: 1 },
                { label: 'Real', value: g.montoReal === null ? '—' : formatCurrency(g.montoReal), align: 'right', row: 1 },
                { label: 'Diferencia', value: diferencia === null ? '—' : formatCurrency(diferencia), row: 2, tone: diferencia === null ? undefined : diferencia > 0 ? 'negative' : 'positive' },
              ]}
              actions={
                (puedeEditar || puedeEliminar) && (
                  <div className="flex w-full justify-end">
                    <CardActionsMenu
                      onEdit={puedeEditar ? () => setEditing(g) : undefined}
                      onDelete={puedeEliminar ? () => setPendingDelete(g) : undefined}
                    />
                  </div>
                )
              }
            />
          )
        }}
      />

      <GastoFijoDialog
        key={editing === null ? 'closed' : editing === 'nuevo' ? 'nuevo' : editing.id}
        value={editing}
        onClose={() => setEditing(null)}
      />

      <ConfirmModal
        open={!!pendingDelete}
        onOpenChange={open => !open && setPendingDelete(null)}
        title="Eliminar gasto fijo"
        description={pendingDelete ? `Se dará de baja "${pendingDelete.concepto}". No se borra físicamente, queda inactivo.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) softDeleteGastoFijo(pendingDelete.id)
          toast.success('Gasto fijo eliminado')
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}

function GastoFijoDialog({ value, onClose }: { value: GastoFijo | 'nuevo' | null; onClose: () => void }) {
  const { user } = useAuth()
  const { addGastoFijo, updateGastoFijo } = useGastoFijoActions()
  const existing = value && value !== 'nuevo' ? value : undefined

  const [fecha, setFecha] = useState(existing?.fecha ?? todayLocal())
  const [concepto, setConcepto] = useState(existing?.concepto ?? '')
  const [categoria, setCategoria] = useState<CategGastoFijo>(existing?.categoria ?? CONFIG_LISTS.CATEG_GASTO_FIJO[0])
  const [montoPrevisto, setMontoPrevisto] = useState(existing?.montoPrevisto?.toString() ?? '')
  const [montoReal, setMontoReal] = useState(existing?.montoReal?.toString() ?? '')
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(existing?.periodicidad ?? 'Mensual')
  const [cuenta, setCuenta] = useState<Cuenta>(existing?.cuenta ?? CONFIG_LISTS.CUENTAS[0])
  const [tipoCaja, setTipoCaja] = useState<TipoCaja>(existing?.tipoCaja ?? 'BLANCA')
  const [estado, setEstado] = useState<EstadoGastoFijo>(existing?.estado ?? 'PREVISTO')
  const [observaciones, setObservaciones] = useState(existing?.observaciones ?? '')

  const open = value !== null

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose()
  }

  const handleSave = () => {
    if (!concepto || !montoPrevisto || !user) {
      toast.error('Completá concepto y monto previsto')
      return
    }
    if (isNegativeAmount(montoPrevisto) || isNegativeAmount(montoReal)) {
      toast.error('El monto no puede ser negativo')
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
      updateGastoFijo(existing.id, payload)
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
              <input type="number" min="0" value={montoPrevisto} onChange={e => setMontoPrevisto(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Monto real</label>
              <input type="number" min="0" value={montoReal} onChange={e => setMontoReal(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
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
