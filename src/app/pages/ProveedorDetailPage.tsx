import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Phone, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'
import { PermissionGuard } from '../components/PermissionGuard'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ProveedorDialog } from '@/components/ProveedorDialog'
import { usePorteData } from '@/modules/porte/store'
import { formatCurrency, formatDate } from '@/lib/format'
import type { Proveedor } from '@/modules/porte'

export default function ProveedorDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { proveedores, egresos, softDeleteProveedor } = usePorteData()
  const proveedor = proveedores.find(p => p.idProv === decodeURIComponent(id ?? ''))
  const egresosProveedor = egresos.filter(e => e.proveedor === proveedor?.idProv)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)

  if (!proveedor) {
    return (
      <AppShell title="Proveedor no encontrado" onBack={() => navigate('/proveedores')}>
        <EmptyState Icon={Landmark} title="Proveedor no encontrado" action={{ label: 'Volver', onClick: () => navigate('/proveedores') }} />
      </AppShell>
    )
  }

  return (
    <AppShell
      title={proveedor.nombre}
      onBack={() => navigate(-1)}
      actions={
        <div className="flex items-center gap-4 lg:gap-2">
          <PermissionGuard permission="proveedores:write">
            <button onClick={() => setEditing(proveedor)} className="text-sm font-medium text-white lg:text-primary lg:px-3 lg:py-1.5">
              Editar
            </button>
          </PermissionGuard>
          <PermissionGuard permission="proveedores:delete">
            <button onClick={() => setPendingDelete(true)} className="text-sm font-medium text-destructive lg:px-3 lg:py-1.5">
              Eliminar
            </button>
          </PermissionGuard>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-border p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div><p className="text-[11px] text-muted-foreground uppercase">Rubro</p><p className="text-sm font-medium">{proveedor.rubro}</p></div>
          <div><p className="text-[11px] text-muted-foreground uppercase">Contacto</p><p className="text-sm font-medium flex items-center gap-1"><Phone className="w-3 h-3" />{proveedor.contacto}</p></div>
          <div><p className="text-[11px] text-muted-foreground uppercase">Plazo</p><p className="text-sm font-medium">{proveedor.plazoDias ? `${proveedor.plazoDias} días` : '—'}</p></div>
          <div><p className="text-[11px] text-muted-foreground uppercase">Caja</p><p className="text-sm font-medium">{proveedor.tipoCaja}</p></div>
        </div>

        <div className="bg-primary/5 rounded-2xl p-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Saldo cuenta corriente</p>
          <p className="text-lg font-semibold text-primary">{formatCurrency(proveedor.saldoCc)}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Egresos asociados</h3>
          {egresosProveedor.length === 0
            ? <EmptyState Icon={Landmark} title="Sin egresos" description="No hay pagos registrados a este proveedor." />
            : (
              <div className="space-y-3">
                {egresosProveedor.map(e => (
                  <div key={e.ref} className="bg-white rounded-2xl border border-border p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{e.tipoEgreso}{e.id ? ` · ${e.id}` : ''}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(e.fecha)}</p>
                    </div>
                    <p className="font-semibold text-red-700">{formatCurrency(e.monto)}</p>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      <ConfirmModal
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title="Eliminar proveedor"
        description={`Se dará de baja "${proveedor.nombre}". No se borra físicamente, queda inactivo.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          softDeleteProveedor(proveedor.idProv)
          toast.success('Proveedor eliminado')
          navigate('/proveedores')
        }}
      />

      <ProveedorDialog value={editing} onClose={() => setEditing(null)} />
    </AppShell>
  )
}
