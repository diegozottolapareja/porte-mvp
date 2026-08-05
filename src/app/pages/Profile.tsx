import { useNavigate } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { useAuth } from '../contexts/AuthContext'
import { Mail, LogOut, User as UserIcon, Shield } from 'lucide-react'
import { motion } from 'motion/react'
import { appConfig } from '@/config/appConfig'

export default function Profile() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
    window.history.pushState(null, '', '/')
  }

  if (!user) return null

  return (
    <AppShell title="Perfil" onBack={() => navigate(-1)} narrow>
      <div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary to-accent rounded-3xl p-6 md:p-8 mb-6 text-white text-center"
        >
          <img src={user.avatarUrl} alt={user.name} className="w-24 h-24 rounded-full border-4 border-white/20 mx-auto mb-4" />
          <h2 className="text-2xl mb-1">{user.name}</h2>
          <p className="text-white/80">{appConfig.ROLES[user.role]}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl p-6 border border-border mb-6 space-y-4"
        >
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <UserIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-1">Nombre</p>
              <p className="text-dark-graphite">{user.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-1">Email</p>
              <p className="text-dark-graphite truncate">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-1">Rol</p>
              <p className="text-dark-graphite">{appConfig.ROLES[user.role]}</p>
            </div>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 py-4 bg-destructive/10 text-destructive rounded-2xl hover:bg-destructive/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Cerrar sesión</span>
        </motion.button>
      </div>
    </AppShell>
  )
}
