import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { SearchableSelect } from '@/components/SearchableSelect'
import { ConfirmModal } from '@/components/ConfirmModal'
import { CONFIG_LISTS, type TipoIngreso, type Cuenta, type TipoCaja, type Ingreso } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, todayLocal } from '@/lib/format'
import { toPositiveAmount } from '@/lib/validation'

export default function IngresoFormPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { ventas, ingresos, addIngreso, updateIngreso, removeIngreso, findDuplicateIngreso } = usePorteData()
  const [searchParams] = useSearchParams()
  const editRef = searchParams.get('ref')
  const obraIdParam = searchParams.get('obraId')
  const editing = editRef ? ingresos.find(i => i.ref === editRef) : undefined
  // Si viene desde la ficha de venta, guardar tiene que volver ahí para ver el ingreso listado.
  const volverA = obraIdParam ? `/ventas/${encodeURIComponent(obraIdParam)}` : undefined

  const [fecha, setFecha] = useState(editing?.fecha ?? todayLocal())
  const [obraId, setObraId] = useState(editing?.id ?? obraIdParam ?? '')
  const [tipoIngreso, setTipoIngreso] = useState<TipoIngreso>(editing?.tipoIngreso ?? 'ANTICIPO')
  const [concepto, setConcepto] = useState(editing?.concepto ?? '')
  const [monto, setMonto] = useState(editing?.monto.toString() ?? '')
  const [cuenta, setCuenta] = useState<Cuenta>(editing?.cuenta ?? CONFIG_LISTS.CUENTAS[0])
  const [caja, setCaja] = useState<TipoCaja>(editing?.caja ?? 'BLANCA')
  const [pendingDuplicate, setPendingDuplicate] = useState<Ingreso | null>(null)
  const [pendingLoadAnother, setPendingLoadAnother] = useState(false)

  const obraOptions = ventas.map(v => ({ value: v.id, label: v.id, sublabel: v.cliente }))

  const doSave = (loadAnother: boolean, montoNum: number) => {
    if (!user) return

    if (editing) {
      updateIngreso(editing.ref, { fecha, id: obraId, tipoIngreso, concepto, monto: montoNum, cuenta, caja })
      // TODO: reemplazar con api.put(`/ingresos/${editing.ref}`, { ... })
      toast.success('Ingreso actualizado')
      navigate(volverA ?? '/mis-registros')
      return
    }

    const nuevo = addIngreso({
      fecha, id: obraId, tipoIngreso, concepto, monto: montoNum, cuenta, caja, estado: 'Confirmado',
    }, user.id)
    // TODO: reemplazar con api.post('/ingresos', nuevo)

    toast.success(`Ingreso de ${formatCurrency(nuevo.monto)} cargado en ${nuevo.id}`, {
      duration: 5000,
      action: { label: 'Deshacer', onClick: () => removeIngreso(nuevo.ref) },
    })

    if (loadAnother) {
      setConcepto('')
      setMonto('')
    } else {
      navigate(volverA ?? '/carga')
    }
  }

  const handleSave = (loadAnother: boolean) => {
    const montoNum = toPositiveAmount(monto)
    if (!obraId || !montoNum) {
      toast.error(!obraId ? 'Completá la venta' : 'El monto debe ser mayor a cero')
      return
    }
    const duplicado = findDuplicateIngreso(obraId, montoNum, fecha)
    if (duplicado && duplicado.ref !== editRef) {
      setPendingDuplicate(duplicado)
      setPendingLoadAnother(loadAnother)
      return
    }
    doSave(loadAnother, montoNum)
  }

  return (
    <AppShell title={editing ? 'Editar ingreso' : 'Nuevo ingreso'} onBack={() => navigate(-1)} narrow>
      <div className="max-w-md mx-auto w-full space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Venta</label>
          <SearchableSelect options={obraOptions} value={obraId} onChange={setObraId} placeholder="Buscar venta o cliente..." />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Tipo de ingreso</label>
          <div className="flex gap-2 flex-wrap">
            {CONFIG_LISTS.TIPO_INGRESO.map(t => (
              <button
                key={t}
                onClick={() => setTipoIngreso(t)}
                className={`px-3 py-2 rounded-xl border text-sm ${tipoIngreso === t ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Concepto</label>
          <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej: Anticipo 50%" className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
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
        title="Posible ingreso duplicado"
        description={pendingDuplicate ? `Ya existe un ingreso de ${formatCurrency(pendingDuplicate.monto)} en ${pendingDuplicate.id} el ${formatDate(pendingDuplicate.fecha)}. ¿Confirmás que este es un registro distinto?` : undefined}
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
