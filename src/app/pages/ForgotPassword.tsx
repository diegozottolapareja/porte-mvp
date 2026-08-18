import { useState } from 'react'
import { X, Mail, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { appConfig } from '@/config/appConfig'

interface ForgotPasswordProps {
  open: boolean
  onClose: () => void
}

export default function ForgotPassword({ open, onClose }: ForgotPasswordProps) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    // TODO: POST /auth/forgot-password { email }
    await new Promise(r => setTimeout(r, 1000))
    setSent(true)
    setLoading(false)
  }

  const handleClose = () => {
    onClose()
    // Reset after animation completes
    setTimeout(() => { setEmail(''); setSent(false) }, 300)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Sheet on mobile (< lg), centered dialog on desktop (>= lg) */}
          <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center pointer-events-none">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full lg:max-w-md lg:mx-4 pointer-events-auto bg-surface-dark rounded-t-3xl lg:rounded-3xl p-6 border-t lg:border border-white/10"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
            >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Recuperar contraseña</h2>
              <button
                onClick={handleClose}
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {sent ? (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6"
                >
                  <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <p className="text-white font-medium mb-2">¡Revisá tu email!</p>
                  <p className="text-white/50 text-sm">
                    Si <span className="text-white/80">{email}</span> está registrado en {appConfig.APP_NAME}, recibirás las instrucciones para restablecer tu contraseña.
                  </p>
                  <button
                    onClick={handleClose}
                    className="mt-6 w-full py-4 bg-white/10 border border-white/20 rounded-2xl text-white font-medium hover:bg-white/20 transition-all"
                  >
                    Entendido
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <p className="text-white/50 text-sm">
                    Ingresá tu email y te enviaremos un link para restablecer tu contraseña.
                  </p>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
                    />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading || !email}
                    className="w-full py-4 bg-white text-surface-dark rounded-2xl font-bold disabled:opacity-50 hover:bg-white/90 transition-all"
                  >
                    {loading ? 'Enviando...' : 'Enviar instrucciones'}
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
