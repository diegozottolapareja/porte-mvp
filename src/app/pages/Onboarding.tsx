import { useState } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { ShoppingBag, BarChart2, Bell, CheckCircle, ChevronRight } from 'lucide-react'
import { appConfig, type Role } from '@/config/appConfig'
import { useAuth } from '../contexts/AuthContext'
import { getDefaultRoute } from '@/config/navigationConfig'

function defaultRoute(role?: Role): string {
  return role ? getDefaultRoute(role) : '/'
}

const STEPS = [
  {
    Icon: ShoppingBag,
    title: `Explorá el catálogo`,
    description: `Accedé a todos los ${appConfig.ENTITY_NAME_PLURAL.toLowerCase()} disponibles, consultá stock y precio en tiempo real, y agregá al carrito con un tap.`,
    color: 'from-purple-500 to-primary',
  },
  {
    Icon: BarChart2,
    title: 'Seguí tus ventas',
    description: `Visualizá tu rendimiento diario, consultá el historial de pedidos y accedé a los reportes de tu actividad comercial.`,
    color: 'from-blue-500 to-primary',
  },
  {
    Icon: Bell,
    title: 'Notificaciones en tiempo real',
    description: `Recibí alertas de nuevos pedidos, actualizaciones de estado y avisos importantes de tu equipo al instante.`,
    color: 'from-green-500 to-emerald-600',
  },
  {
    Icon: CheckCircle,
    title: `Todo listo`,
    description: `Ya podés empezar a usar ${appConfig.APP_NAME}. Si tenés dudas, escribile a tu administrador o consultá el menú de ayuda.`,
    color: 'from-amber-500 to-orange-500',
  },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(0)

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  const finish = () => {
    localStorage.setItem('zantia_onboarding_done', '1')
    navigate(defaultRoute(user?.role), { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-dark via-surface-dark-mid to-surface-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />

      <div className="w-full max-w-sm z-10">
        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-10">
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              animate={{ width: i === step ? 24 : 8, opacity: i <= step ? 1 : 0.3 }}
              className="h-2 rounded-full bg-white"
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm mb-8"
          >
            <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${current.color} flex items-center justify-center mx-auto mb-6`}>
              <current.Icon className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white text-center mb-3">{current.title}</h2>
            <p className="text-white/50 text-center text-sm leading-relaxed">{current.description}</p>
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="space-y-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={isLast ? finish : () => setStep(s => s + 1)}
            className="w-full py-4 bg-white text-surface-dark rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/90 transition-all"
          >
            {isLast ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Comenzar
              </>
            ) : (
              <>
                Siguiente
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </motion.button>
          {!isLast && (
            <button onClick={finish} className="w-full py-3 text-white/40 hover:text-white/60 text-sm transition-colors">
              Omitir
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
