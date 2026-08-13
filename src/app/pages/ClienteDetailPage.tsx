import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Phone, MapPin, Users } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'
import { PermissionGuard } from '../components/PermissionGuard'
import { ConfirmModal } from '@/components/ConfirmModal'
import { usePorteData } from '@/modules/porte/store'
import { formatCurrency } from '@/lib/format'

export default function ClienteDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { clientes, ventas, softDeleteCliente } = usePorteData()
  const cliente = clientes.find(c => c.idCli === decodeURIComponent(id ?? ''))
  // Sin FK entre ventas.cliente y clientes: es texto libre, así que el match acá
  // es por nombre (case-insensitive) — puede no capturar variaciones de tipeo.
  const ventasCliente = cliente
    ? ventas.filter(v => v.cliente.trim().toLowerCase() === cliente.nombre.trim().toLowerCase())
    : []
  const [pendingDelete, setPendingDelete] = useState(false)

  if (!cliente) {
    return (
      <AppShell title="Cliente no encontrado" onBack={() => navigate('/clientes')}>
        <EmptyState Icon={Users} title="Cliente no encontrado" action={{ label: 'Volver', onClick: () => navigate('/clientes') }} />
      </AppShell>
    )
  }

  return (
    <AppShell
      title={cliente.nombre}
      onBack={() => navigate(-1)}
      actions={
        <PermissionGuard permission="clientes:delete">
          <button onClick={() => setPendingDelete(true)} className="text-sm font-medium text-destructive lg:px-3 lg:py-1.5">
            Eliminar
          </button>
        </PermissionGuard>
      }
    >
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-border p-4 grid grid-cols-2 gap-4">
          <div><p className="text-[11px] text-muted-foreground uppercase">Email principal</p><p className="text-sm font-medium">{cliente.emailPrincipal || '—'}</p></div>
          <div><p className="text-[11px] text-muted-foreground uppercase">Teléfono principal</p><p className="text-sm font-medium flex items-center gap-1"><Phone className="w-3 h-3" />{cliente.telefonoPrincipal || '—'}</p></div>
          <div><p className="text-[11px] text-muted-foreground uppercase">Email secundario</p><p className="text-sm font-medium">{cliente.emailSecundario || '—'}</p></div>
          <div><p className="text-[11px] text-muted-foreground uppercase">Teléfono secundario</p><p className="text-sm font-medium">{cliente.telefonoSecundario || '—'}</p></div>
          <div className="col-span-2"><p className="text-[11px] text-muted-foreground uppercase">Dirección</p><p className="text-sm font-medium flex items-center gap-1"><MapPin className="w-3 h-3" />{cliente.direccion || '—'}</p></div>
        </div>

        {cliente.observaciones && (
          <div className="bg-white rounded-2xl border border-border p-4">
            <p className="text-[11px] text-muted-foreground uppercase mb-1">Observaciones</p>
            <p className="text-sm">{cliente.observaciones}</p>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ventas asociadas</h3>
          {ventasCliente.length === 0
            ? <EmptyState Icon={Users} title="Sin ventas" description="No hay ventas registradas con este nombre de cliente." />
            : (
              <div className="space-y-3">
                {ventasCliente.map(v => (
                  <div key={v.id} className="bg-white rounded-2xl border border-border p-4 flex items-center justify-between cursor-pointer" onClick={() => navigate(`/ventas/${encodeURIComponent(v.id)}`)}>
                    <div>
                      <p className="font-medium text-sm">{v.id}</p>
                      <p className="text-xs text-muted-foreground">{v.estadoOp}</p>
                    </div>
                    <p className="font-semibold text-primary">{formatCurrency(v.ventaFinal)}</p>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      <ConfirmModal
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title="Eliminar cliente"
        description={`Se dará de baja "${cliente.nombre}". No se borra físicamente, queda inactivo.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          softDeleteCliente(cliente.idCli)
          toast.success('Cliente eliminado')
          navigate('/clientes')
        }}
      />
    </AppShell>
  )
}
