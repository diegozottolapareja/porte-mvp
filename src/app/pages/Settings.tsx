import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Bell, Lock, Smartphone, Globe, Palette, Trash2, ChevronRight, Moon, Sun, Info } from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { useAuth } from '../contexts/AuthContext'
import { appConfig } from '@/config/appConfig'

interface ToggleRowProps {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

interface LinkRowProps {
  Icon: typeof Bell
  label: string
  description?: string
  onClick: () => void
  danger?: boolean
}

function LinkRow({ Icon, label, description, onClick, danger }: LinkRowProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 py-3.5 border-b border-border last:border-0 text-left transition-colors hover:bg-muted/30 -mx-1 px-1 rounded-lg ${danger ? 'text-destructive' : ''}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? 'bg-destructive/10' : 'bg-primary/10'}`}>
        <Icon className={`w-4 h-4 ${danger ? 'text-destructive' : 'text-primary'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? 'text-destructive' : 'text-foreground'}`}>{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </button>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const [notifPush,    setNotifPush]    = useState(true)
  const [notifEmail,   setNotifEmail]   = useState(false)
  const [notifOrders,  setNotifOrders]  = useState(true)
  const [darkMode,     setDarkMode]     = useState(false)
  const [compactView,  setCompactView]  = useState(false)
  const [biometrics,   setBiometrics]   = useState(false)
  const [sessionPersist, setSessionPersist] = useState(true)

  const handleDeleteAccount = () => {
    toast.error('Esta acción requiere confirmación del administrador')
  }

  return (
    <AppShell title="Preferencias" onBack={() => navigate(-1)} narrow>
      <div className="space-y-4">
        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Notificaciones</h2>
          </div>
          <ToggleRow label="Notificaciones push"  description="Recibir alertas en el dispositivo" checked={notifPush}   onChange={setNotifPush} />
          <ToggleRow label="Notificaciones email"  description="Recibir resúmenes por correo"      checked={notifEmail}  onChange={v => { setNotifEmail(v); toast.success(v ? 'Notificaciones email activadas' : 'Desactivadas') }} />
          <ToggleRow label="Alertas de pedidos"    description="Notificar nuevos pedidos y cambios" checked={notifOrders} onChange={setNotifOrders} />
        </motion.div>

        {/* Appearance */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Apariencia</h2>
          </div>
          <ToggleRow
            label={darkMode ? 'Modo oscuro' : 'Modo claro'}
            description="Cambiar tema de la interfaz"
            checked={darkMode}
            onChange={v => { setDarkMode(v); toast.info('Modo oscuro: próximamente') }}
          />
          <div className="flex items-center gap-3 mt-2 pt-2">
            <button onClick={() => setDarkMode(false)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${!darkMode ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}>
              <Sun className="w-4 h-4" /> Claro
            </button>
            <button onClick={() => setDarkMode(true)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${darkMode ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}>
              <Moon className="w-4 h-4" /> Oscuro
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <ToggleRow label="Vista compacta" description="Reducir espacio entre elementos" checked={compactView} onChange={setCompactView} />
          </div>
        </motion.div>

        {/* Security */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Seguridad</h2>
          </div>
          <ToggleRow label="Autenticación biométrica" description="Usar huella o Face ID para ingresar" checked={biometrics} onChange={setBiometrics} />
          <ToggleRow label="Mantener sesión iniciada" description="No cerrar sesión al cerrar la app" checked={sessionPersist} onChange={setSessionPersist} />
          <div className="mt-3 pt-3 border-t border-border">
            <LinkRow Icon={Lock} label="Cambiar contraseña" description="Actualizar credenciales de acceso" onClick={() => toast.info('Próximamente')} />
          </div>
        </motion.div>

        {/* Device */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Dispositivo</h2>
          </div>
          <LinkRow Icon={Globe} label="Idioma" description="Español (Argentina)" onClick={() => toast.info('Próximamente')} />
          <LinkRow Icon={Smartphone} label="Instalar la app" description="Agregar al inicio del dispositivo" onClick={() => toast.info('Usá el botón de instalación del navegador')} />
        </motion.div>

        {/* About */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Acerca de</h2>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Aplicación', value: appConfig.APP_NAME },
              { label: 'Versión',    value: '1.0.0' },
              { label: 'Entorno',    value: appConfig.DEMO_MODE ? 'Demo' : 'Producción' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="text-sm font-medium text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Danger zone */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white border border-destructive/20 rounded-2xl p-4">
          <h2 className="font-semibold text-destructive mb-3">Zona de peligro</h2>
          <LinkRow Icon={Trash2} label="Eliminar cuenta" description="Esta acción es irreversible" onClick={handleDeleteAccount} danger />
        </motion.div>

        {/* Logout button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { logout(); navigate('/', { replace: true }); window.history.pushState(null, '', '/') }}
          className="w-full py-4 bg-destructive/10 text-destructive rounded-2xl font-semibold text-sm hover:bg-destructive/20 transition-colors"
        >
          Cerrar sesión
        </motion.button>
      </div>
    </AppShell>
  )
}
