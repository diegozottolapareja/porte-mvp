import { useLocation, useNavigate } from 'react-router'
import { Mic } from 'lucide-react'

// Acceso rápido al asistente en desktop — en mobile ya está en el BottomNav
// (último ícono, extremo derecho), así que este botón solo se muestra en lg+.
export function AssistantFab() {
  const navigate = useNavigate()
  const location = useLocation()
  if (location.pathname.startsWith('/asistente')) return null

  return (
    <button
      onClick={() => navigate('/asistente')}
      aria-label="Abrir asistente"
      className="hidden lg:flex fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-white items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
    >
      <Mic className="w-6 h-6" />
    </button>
  )
}
