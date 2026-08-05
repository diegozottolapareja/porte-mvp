import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Home, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { appConfig } from '@/config/appConfig'
import { getDefaultRoute } from '@/config/navigationConfig'

export default function NotFound() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-dark via-surface-dark-mid to-surface-dark flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm"
      >
        <motion.div
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-8xl mb-6 select-none"
        >
          🔍
        </motion.div>
        <h1 className="text-6xl font-black text-white mb-2">404</h1>
        <p className="text-xl font-semibold text-white/80 mb-2">Página no encontrada</p>
        <p className="text-white/40 text-sm mb-10">
          La URL que intentás acceder no existe en {appConfig.APP_NAME}.
        </p>
        <div className="flex flex-col gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(user ? getDefaultRoute(user.role) : '/')}
            className="w-full py-4 bg-white text-surface-dark rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/90 transition-all"
          >
            <Home className="w-5 h-5" />
            Ir al inicio
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(-1)}
            className="w-full py-4 bg-white/10 border border-white/20 text-white rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver atrás
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
