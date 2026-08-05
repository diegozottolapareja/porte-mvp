import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { SearchableSelect } from './SearchableSelect'
import { CONFIG_LISTS, type Aprendizaje, type CausaDesvio, type Categoria } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '@/app/contexts/AuthContext'

interface AprendizajeDialogProps {
  open: boolean
  onClose: () => void
  editing?: Aprendizaje
  fixedObra?: { idPres: string; cliente: string; categoria: Categoria }
}

export function AprendizajeDialog({ open, onClose, editing, fixedObra }: AprendizajeDialogProps) {
  const { user } = useAuth()
  const { ventas, addAprendizaje, updateAprendizaje } = usePorteData()

  const obraOptions = ventas.map(v => ({ value: v.id.replace(' ', ''), label: v.id, sublabel: v.cliente }))

  const [obraId, setObraId] = useState(editing?.idPres ?? fixedObra?.idPres ?? '')
  const [queSalioBien, setQueSalioBien] = useState(editing?.queSalioBien ?? '')
  const [queSalioMal, setQueSalioMal] = useState(editing?.queSalioMal ?? '')
  const [causaDesvio, setCausaDesvio] = useState<CausaDesvio>(editing?.causaDesvio ?? CONFIG_LISTS.CAUSA_DESVIO[0])
  const [hariaDiferente, setHariaDiferente] = useState(editing?.hariaDiferente ?? '')
  const [aplicaAFuturas, setAplicaAFuturas] = useState(editing?.aplicaAFuturas ?? true)

  const handleOpenChange = (next: boolean) => { if (!next) onClose() }

  const handleSave = () => {
    if (!user) return
    const targetObraId = fixedObra?.idPres ?? obraId
    if (!targetObraId || !queSalioBien) {
      toast.error('Completá la venta y qué salió bien')
      return
    }
    const venta = ventas.find(v => v.id.replace(' ', '') === targetObraId)
    const cliente = fixedObra?.cliente ?? venta?.cliente ?? ''
    const categoria = fixedObra?.categoria ?? 'OTRO'

    const payload = {
      idPres: targetObraId, cliente, categoria, queSalioBien, queSalioMal, causaDesvio,
      hariaDiferente, aplicaAFuturas, registradoPor: user.name,
      fechaCierre: editing?.fechaCierre ?? new Date().toISOString().slice(0, 10),
    }

    if (editing) {
      updateAprendizaje(editing.idApr, payload)
      toast.success('Aprendizaje actualizado')
    } else {
      addAprendizaje(payload, user.id)
      toast.success('Aprendizaje registrado')
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Editar aprendizaje' : 'Nuevo aprendizaje'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {!fixedObra && (
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Venta</label>
              <SearchableSelect options={obraOptions} value={obraId} onChange={setObraId} placeholder="Buscar venta o cliente..." />
            </div>
          )}
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">¿Qué salió bien?</label>
            <textarea value={queSalioBien} onChange={e => setQueSalioBien(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-2xl border border-border text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">¿Qué salió mal?</label>
            <textarea value={queSalioMal} onChange={e => setQueSalioMal(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-2xl border border-border text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Causa del desvío</label>
            <div className="flex gap-2 flex-wrap">
              {CONFIG_LISTS.CAUSA_DESVIO.map(c => (
                <button key={c} onClick={() => setCausaDesvio(c)} className={`px-3 py-2 rounded-xl border text-xs ${causaDesvio === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">¿Qué harías diferente?</label>
            <textarea value={hariaDiferente} onChange={e => setHariaDiferente(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-2xl border border-border text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={aplicaAFuturas} onChange={e => setAplicaAFuturas(e.target.checked)} />
            Aplica a futuras ventas
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
