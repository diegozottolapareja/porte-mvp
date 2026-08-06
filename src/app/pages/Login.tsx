import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Eye, EyeOff, Fingerprint, AlertCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { useAuth, isWebAuthnSupported, type LoginCredentials } from '../contexts/AuthContext'
import { SplashScreen } from '@/components/SplashScreen'
import { appConfig, type Role } from '@/config/appConfig'
import { getDefaultRoute } from '@/config/navigationConfig'
import logo from '/logo.svg'
import ForgotPassword from './ForgotPassword'

// ─── Real login: email + password + biometrics ────────────────────────────────

// Credenciales de demo — se precargan al elegir el rol para que cualquiera
// pueda entrar sin tener que buscar usuario/contraseña.
const DEMO_CREDENTIALS: Record<Role, { email: string; password: string }> = {
  admin: { email: 'admin@porte.com', password: 'Enfermo@1985' },
  dataEntry: { email: 'carga@porte.com', password: 'Enfermo@1985' },
}

function RealLogin() {
  const { login, loginWithBiometrics } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname

  const [email, setEmail] = useState(DEMO_CREDENTIALS.admin.email)
  const [password, setPassword] = useState(DEMO_CREDENTIALS.admin.password)
  const [role, setRole] = useState<Role>('admin')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Completá todos los campos')
      return
    }
    setError('')
    setLoading(true)
    try {
      const creds: LoginCredentials = { email, password, role }
      await login(creds)
      navigate(from ?? getDefaultRoute(role))
    } catch {
      setError('Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  const handleBiometric = async () => {
    setBiometricLoading(true)
    try {
      await loginWithBiometrics(role)
      navigate(from ?? getDefaultRoute(role))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de autenticación biométrica'
      toast.error(msg)
    } finally {
      setBiometricLoading(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Role selector */}
        <div className="flex gap-2 p-1 bg-white/10 rounded-2xl">
          {(['admin', 'dataEntry'] as Role[]).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRole(r)
                setEmail(DEMO_CREDENTIALS[r].email)
                setPassword(DEMO_CREDENTIALS[r].password)
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                role === r ? 'bg-white text-surface-dark shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              {appConfig.ROLES[r]}
            </button>
          ))}
        </div>

        {/* Email */}
        <div className="relative">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 text-red-300 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-white text-surface-dark rounded-2xl font-bold text-base disabled:opacity-60 hover:bg-white/90 transition-all duration-200 shadow-lg"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </motion.button>

        {/* Biometrics */}
        {isWebAuthnSupported() && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleBiometric}
            disabled={biometricLoading}
            className="w-full py-4 bg-white/10 border border-white/20 rounded-2xl text-white font-medium text-sm disabled:opacity-60 hover:bg-white/15 transition-all duration-200 flex items-center justify-center gap-3"
          >
            <Fingerprint className={`w-5 h-5 ${biometricLoading ? 'animate-pulse' : ''}`} />
            {biometricLoading ? 'Verificando biometría...' : 'Usar Face ID / Huella digital'}
          </motion.button>
        )}

        {/* Forgot password */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="text-white/40 hover:text-white/70 text-xs transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </form>

      <ForgotPassword open={showForgot} onClose={() => setShowForgot(false)} />
    </>
  )
}

// ─── Main Login page ──────────────────────────────────────────────────────────

export default function Login() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getDefaultRoute(user.role), { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-dark via-surface-dark-mid to-surface-dark flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />

      <AnimatePresence mode="wait">
        {showSplash ? (
          <SplashScreen logo={logo} appName={appConfig.APP_NAME} tagline={appConfig.APP_TAGLINE} />
        ) : (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md z-10"
          >
            <div className="text-center mb-10">
              <img src={logo} alt={appConfig.APP_NAME} className="w-48 h-auto rounded-2xl mx-auto mb-4" />
              <p className="text-white/50 text-sm tracking-wide">Bienvenido</p>
            </div>

            <RealLogin />

            <p className="text-center text-white/20 text-xs mt-10 tracking-wide">
              {appConfig.APP_NAME} · {appConfig.APP_TAGLINE}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
