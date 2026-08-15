import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import type { Cliente } from '@/modules/porte'
import { useClienteActions } from '@/modules/porte/store'
import { useAuth } from '@/app/contexts/AuthContext'

export function ClienteDialog({ value, onClose }: { value: Cliente | 'nuevo' | null; onClose: () => void }) {
  const { user } = useAuth()
  const { addCliente, updateCliente } = useClienteActions()
  const existing = value && value !== 'nuevo' ? value : undefined

  const [nombre, setNombre] = useState(existing?.nombre ?? '')
  const [emailPrincipal, setEmailPrincipal] = useState(existing?.emailPrincipal ?? '')
  const [emailSecundario, setEmailSecundario] = useState(existing?.emailSecundario ?? '')
  const [telefonoPrincipal, setTelefonoPrincipal] = useState(existing?.telefonoPrincipal ?? '')
  const [telefonoSecundario, setTelefonoSecundario] = useState(existing?.telefonoSecundario ?? '')
  const [direccion, setDireccion] = useState(existing?.direccion ?? '')
  const [observaciones, setObservaciones] = useState(existing?.observaciones ?? '')

  const open = value !== null

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose()
  }

  const handleSave = () => {
    if (!nombre || !user) {
      toast.error('Completá el nombre')
      return
    }
    if (!emailPrincipal.trim() && !telefonoPrincipal.trim()) {
      toast.error('Cargá al menos un email principal o un teléfono principal')
      return
    }
    const direccionValue = direccion || undefined
    const observacionesValue = observaciones || undefined

    if (existing) {
      // Edición: un campo de contacto vaciado por el usuario tiene que viajar
      // como `null` explícito (borrar de verdad) — de lo contrario
      // clienteToRow lo ignora y el valor anterior sobrevive en la base
      // aunque la UI ya lo muestre vacío.
      updateCliente(existing.idCli, {
        nombre,
        emailPrincipal: emailPrincipal.trim() || null,
        emailSecundario: emailSecundario.trim() || null,
        telefonoPrincipal: telefonoPrincipal.trim() || null,
        telefonoSecundario: telefonoSecundario.trim() || null,
        direccion: direccionValue,
        observaciones: observacionesValue,
      })
      toast.success('Cliente actualizado')
    } else {
      addCliente({
        nombre,
        emailPrincipal: emailPrincipal.trim() || undefined,
        emailSecundario: emailSecundario.trim() || undefined,
        telefonoPrincipal: telefonoPrincipal.trim() || undefined,
        telefonoSecundario: telefonoSecundario.trim() || undefined,
        direccion: direccionValue,
        observaciones: observacionesValue,
      }, user.id)
      toast.success('Cliente creado')
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{existing ? existing.nombre : 'Nuevo cliente'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
          </div>
          <p className="text-xs text-muted-foreground -mt-1">Cargá al menos un email principal o un teléfono principal.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Email principal</label>
              <input type="email" value={emailPrincipal} onChange={e => setEmailPrincipal(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Teléfono principal</label>
              <input value={telefonoPrincipal} onChange={e => setTelefonoPrincipal(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Email secundario</label>
              <input type="email" value={emailSecundario} onChange={e => setEmailSecundario(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Teléfono secundario</label>
              <input value={telefonoSecundario} onChange={e => setTelefonoSecundario(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Dirección</label>
            <input value={direccion} onChange={e => setDireccion(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
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
