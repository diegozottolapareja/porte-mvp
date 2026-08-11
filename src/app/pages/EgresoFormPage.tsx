import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { SearchableSelect } from '@/components/SearchableSelect'
import { ConfirmModal } from '@/components/ConfirmModal'
import { CONFIG_LISTS, type TipoEgreso, type Cuenta, type TipoCaja, type Egreso } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, todayLocal } from '@/lib/format'
import { toPositiveAmount } from '@/lib/validation'

export default function EgresoFormPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { ventas, proveedores, egresos, addEgreso, updateEgreso, removeEgreso, findDuplicateEgreso } = usePorteData()
  const [searchParams] = useSearchParams()
  const editRef = searchParams.get('ref')
  const obraIdParam = searchParams.get('obraId')
  const editing = editRef ? egresos.find(e => e.ref === editRef) : undefined
  // Si viene desde la ficha de venta, guardar tiene que volver ahí para ver el egreso listado.
  const volverA = obraIdParam ? `/ventas/${encodeURIComponent(obraIdParam)}` : undefined

  const [fecha, setFecha] = useState(editing?.fecha ?? todayLocal())
  const [obraId, setObraId] = useState(editing?.id ?? obraIdParam ?? '')
  const [proveedorId, setProveedorId] = useState(editing?.proveedor ?? '')
  const [tipoEgreso, setTipoEgreso] = useState<TipoEgreso>(editing?.tipoEgreso ?? 'MATERIALES')
  const [categoria, setCategoria] = useState<string>(editing?.categoria ?? CONFIG_LISTS.CATEG_DIRECTOS[0])
  const [monto, setMonto] = useState(editing?.monto.toString() ?? '')
  const [cuenta, setCuenta] = useState<Cuenta>(editing?.cuenta ?? CONFIG_LISTS.CUENTAS[0])
  const [caja, setCaja] = useState<TipoCaja>(editing?.caja ?? 'BLANCA')
  const [esCheque, setEsCheque] = useState(!!editing?.fechaEmision)
  const [fechaEmision, setFechaEmision] = useState(editing?.fechaEmision ?? '')
  const [fechaAcreditacion, setFechaAcreditacion] = useState(editing?.fechaAcreditacion ?? '')
  const [pendingDuplicate, setPendingDuplicate] = useState<Egreso | null>(null)
  const [pendingLoadAnother, setPendingLoadAnother] = useState(false)

  const obraOptions = ventas.map(v => ({ value: v.id, label: v.id, sublabel: v.cliente }))
  const proveedorOptions = proveedores.filter(p => p.activo).map(p => ({ value: p.idProv, label: p.nombre, sublabel: p.rubro }))

  const doSave = (loadAnother: boolean, montoNum: number) => {
    if (!user) return
    const payload = {
      fecha, id: obraId || undefined, proveedor: proveedorId || undefined, tipoEgreso, categoria,
      monto: montoNum, cuenta, caja,
      estado: esCheque ? 'Emitido' as const : 'Confirmado' as const,
      fechaEmision: esCheque ? fechaEmision : undefined,
      fechaAcreditacion: esCheque ? fechaAcreditacion : undefined,
    }

    if (editing) {
      updateEgreso(editing.ref, payload)
      // TODO: reemplazar con api.put(`/egresos/${editing.ref}`, payload)
      toast.success('Egreso actualizado')
      navigate(volverA ?? '/mis-registros')
      return
    }

    const nuevo = addEgreso(payload, user.id)
    // TODO: reemplazar con api.post('/egresos', nuevo)

    toast.success(`Egreso de ${formatCurrency(nuevo.monto)} registrado${nuevo.id ? ` en ${nuevo.id}` : ''}`, {
      duration: 5000,
      action: { label: 'Deshacer', onClick: () => removeEgreso(nuevo.ref) },
    })

    if (loadAnother) {
      setMonto('')
    } else {
      navigate(volverA ?? '/carga')
    }
  }

  const handleSave = (loadAnother: boolean) => {
    const montoNum = toPositiveAmount(monto)
    if (!montoNum) {
      toast.error('El monto debe ser mayor a cero')
      return
    }
    const duplicado = findDuplicateEgreso(obraId || undefined, montoNum, fecha)
    if (duplicado && duplicado.ref !== editRef) {
      setPendingDuplicate(duplicado)
      setPendingLoadAnother(loadAnother)
      return
    }
    doSave(loadAnother, montoNum)
  }

  return (
    <AppShell title={editing ? 'Editar egreso' : 'Nuevo egreso'} onBack={() => navigate(-1)} narrow>
      <div className="max-w-md mx-auto w-full space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Venta (opcional si es gasto fijo)</label>
          <SearchableSelect options={obraOptions} value={obraId} onChange={setObraId} placeholder="Buscar venta o cliente..." />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Proveedor</label>
          <SearchableSelect options={proveedorOptions} value={proveedorId} onChange={setProveedorId} placeholder="Buscar proveedor..." />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Tipo de egreso</label>
          <div className="flex gap-2 flex-wrap">
            {CONFIG_LISTS.TIPO_EGRESO.map(t => (
              <button
                key={t}
                onClick={() => setTipoEgreso(t)}
                className={`px-3 py-2 rounded-xl border text-sm ${tipoEgreso === t ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Categoría</label>
          <div className="flex gap-2 flex-wrap">
            {[...CONFIG_LISTS.CATEG_DIRECTOS, ...CONFIG_LISTS.CATEG_INDIRECTOS].map(c => (
              <button
                key={c}
                onClick={() => setCategoria(c)}
                className={`px-3 py-2 rounded-xl border text-sm ${categoria === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Monto</label>
          <input type="number" min="0.01" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Cuenta</label>
          <div className="flex gap-2 flex-wrap">
            {CONFIG_LISTS.CUENTAS.map(c => (
              <button
                key={c}
                onClick={() => setCuenta(c)}
                className={`px-3 py-2 rounded-xl border text-sm ${cuenta === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Caja</label>
          <div className="flex gap-2">
            {CONFIG_LISTS.TIPO_CAJA.map(c => (
              <button
                key={c}
                onClick={() => setCaja(c)}
                className={`flex-1 py-2.5 rounded-xl border text-sm ${caja === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={esCheque} onChange={e => setEsCheque(e.target.checked)} />
          Es un cheque
        </label>

        {esCheque && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Fecha emisión</label>
              <input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Fecha acreditación</label>
              <input type="date" value={fechaAcreditacion} onChange={e => setFechaAcreditacion(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={() => handleSave(true)} className="flex-1 py-4 bg-white border border-border rounded-2xl font-medium text-sm">
            Guardar y cargar otro
          </button>
          <button onClick={() => handleSave(false)} className="flex-1 py-4 bg-primary text-white rounded-2xl font-semibold text-sm">
            Guardar
          </button>
        </div>
      </div>

      <ConfirmModal
        open={!!pendingDuplicate}
        onOpenChange={open => !open && setPendingDuplicate(null)}
        title="Posible egreso duplicado"
        description={pendingDuplicate ? `Ya existe un egreso de ${formatCurrency(pendingDuplicate.monto)}${pendingDuplicate.id ? ` en ${pendingDuplicate.id}` : ''} el ${formatDate(pendingDuplicate.fecha)}. ¿Confirmás que este es un registro distinto?` : undefined}
        confirmLabel="Cargar igual"
        onConfirm={() => {
          setPendingDuplicate(null)
          const montoNum = toPositiveAmount(monto)
          if (montoNum) doSave(pendingLoadAnother, montoNum)
        }}
      />
    </AppShell>
  )
}
