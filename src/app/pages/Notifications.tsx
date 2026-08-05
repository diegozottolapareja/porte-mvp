import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Bell, Hammer, Wallet, AlertTriangle, CheckCheck, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'

type NotifType = 'obra' | 'cobro' | 'cheque' | 'sistema'

interface Notification {
  id: string
  type: NotifType
  title: string
  body: string
  time: string
  read: boolean
}

const ICON_MAP: Record<NotifType, typeof Bell> = {
  obra: Hammer, cobro: Wallet, cheque: AlertTriangle, sistema: Bell,
}

const COLOR_MAP: Record<NotifType, string> = {
  obra:    'text-blue-600 bg-blue-50',
  cobro:   'text-green-600 bg-green-50',
  cheque:  'text-orange-600 bg-orange-50',
  sistema: 'text-purple-600 bg-purple-50',
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'cobro',   title: 'Anticipo cobrado',          body: 'Se registró un anticipo de $1.267.000 en PR - 0546 (VILCA JULIA)', time: 'Hace 5 min',    read: false },
  { id: 'n2', type: 'cheque',  title: 'Cheque próximo a vencer',    body: 'El cheque de EG-0006 acredita el 15/08/2026 — $900.000',            time: 'Hace 1 hora',   read: false },
  { id: 'n3', type: 'obra',    title: 'Presupuesto aceptado',       body: 'PR - 0552 (CASTRO ARIEL) pasó a estado Aceptado y generó la venta.', time: 'Hace 3 horas',  read: true },
  { id: 'n4', type: 'obra',    title: 'Entrega comprometida próxima', body: 'PR - 0546 tiene entrega comprometida el 05/07/2026.',              time: 'Ayer',          read: true },
  { id: 'n5', type: 'sistema', title: 'Actualización disponible',   body: 'Hay una nueva versión de la app lista para instalar.',              time: 'Hace 2 días',   read: true },
]

export default function Notifications() {
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState<Notification[]>(MOCK_NOTIFICATIONS)

  const unreadCount = notifs.filter(n => !n.read).length

  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  const markRead    = (id: string) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  const remove      = (id: string) => setNotifs(prev => prev.filter(n => n.id !== id))

  return (
    <AppShell
      title={unreadCount > 0 ? `Notificaciones (${unreadCount})` : 'Notificaciones'}
      onBack={() => navigate(-1)}
      narrow
      actions={
        unreadCount > 0 ? (
          <button onClick={markAllRead} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-muted lg:w-9 lg:h-9 flex items-center justify-center" title="Marcar todo como leído">
            <CheckCheck className="w-5 h-5 text-white lg:w-4 lg:h-4 lg:text-foreground" />
          </button>
        ) : undefined
      }
    >
      <div>
        {notifs.length === 0 ? (
          <EmptyState Icon={Bell} title="Sin notificaciones" description="Cuando haya novedades, aparecerán acá" />
        ) : (
          <AnimatePresence initial={false}>
            {notifs.map((notif, i) => {
              const Icon = ICON_MAP[notif.type]
              const color = COLOR_MAP[notif.type]
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40, height: 0, marginBottom: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => markRead(notif.id)}
                  className={`bg-white border rounded-2xl p-4 mb-3 flex gap-3 items-start cursor-pointer hover:shadow-md transition-all duration-200 ${notif.read ? 'border-border' : 'border-primary/30 shadow-sm shadow-primary/10'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${notif.read ? 'text-foreground' : 'text-primary'}`}>{notif.title}</p>
                      <button
                        onClick={e => { e.stopPropagation(); remove(notif.id) }}
                        className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-xs text-muted-foreground/70">{notif.time}</p>
                      {!notif.read && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </AppShell>
  )
}
