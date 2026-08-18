import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import { PrivateRoute } from './components/PrivateRoute'
import { PorteDataProvider } from '@/modules/porte/store'
import { queryClient } from '@/lib/queryClient'
import { OfflineBanner } from '@/components/OfflineBanner'
import { InstallBanner } from '@/components/InstallBanner'
import { UpdateBanner } from '@/components/UpdateBanner'

// Auth & shell
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'

// PORTE — Dashboard & carga rápida
import DashboardPage from './pages/DashboardPage'
import AsistentePage from './pages/AsistentePage'
import CargaRapidaPage from './pages/CargaRapidaPage'
import MisRegistrosPage from './pages/MisRegistrosPage'
import FinanzasPage from './pages/FinanzasPage'

// PORTE — Presupuestos y ventas
import PresupuestosPage from './pages/PresupuestosPage'
import PresupuestoFormPage from './pages/PresupuestoFormPage'
import VentasPage from './pages/VentasPage'
import ObraDetailPage from './pages/ObraDetailPage'

// PORTE — Ingresos y egresos
import IngresosPage from './pages/IngresosPage'
import IngresoFormPage from './pages/IngresoFormPage'
import EgresosPage from './pages/EgresosPage'
import EgresoFormPage from './pages/EgresoFormPage'

// PORTE — Proveedores, gastos fijos, variaciones, aprendizajes
import ProveedoresPage from './pages/ProveedoresPage'
import ProveedorDetailPage from './pages/ProveedorDetailPage'
import ClientesPage from './pages/ClientesPage'
import ClienteDetailPage from './pages/ClienteDetailPage'
import GastosFijosPage from './pages/GastosFijosPage'
import VariacionesPage from './pages/VariacionesPage'
import AprendizajesPage from './pages/AprendizajesPage'
import ConfigPage from './pages/ConfigPage'

function UnauthorizedPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const handleVolver = () => { logout(); navigate('/', { replace: true }) }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-dark via-surface-dark-mid to-surface-dark">
      <div className="text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="text-2xl font-bold text-white mb-2">Acceso denegado</p>
        <p className="text-white/50 mb-6">No tenés permisos para ver esta página.</p>
        <button onClick={handleVolver} className="text-white underline text-sm">Volver al inicio</button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PorteDataProvider>
      <Router>
        <div className="size-full">
          <OfflineBanner />
          <UpdateBanner />

          <Routes>
            {/* Public */}
            <Route path="/" element={<Login />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Admin */}
            <Route path="/dashboard" element={<PrivateRoute allowedRoles={['admin']}><DashboardPage /></PrivateRoute>} />

            {/* dataEntry */}
            <Route path="/carga" element={<PrivateRoute allowedRoles={['dataEntry', 'admin']}><CargaRapidaPage /></PrivateRoute>} />
            <Route path="/mis-registros" element={<PrivateRoute allowedRoles={['dataEntry', 'admin']}><MisRegistrosPage /></PrivateRoute>} />

            {/* Presupuestos — shared */}
            <Route path="/presupuestos" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><PresupuestosPage /></PrivateRoute>} />
            <Route path="/presupuestos/:id" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><PresupuestoFormPage /></PrivateRoute>} />

            {/* Obras / ventas — shared */}
            <Route path="/ventas" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><VentasPage /></PrivateRoute>} />
            <Route path="/ventas/:id" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><ObraDetailPage /></PrivateRoute>} />

            {/* Ingresos — shared: dataEntry tiene ingresos:read/write igual que admin */}
            <Route path="/ingresos" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><IngresosPage /></PrivateRoute>} />
            <Route path="/ingresos/nuevo" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><IngresoFormPage /></PrivateRoute>} />

            {/* Egresos — shared: dataEntry tiene egresos:read/write igual que admin */}
            <Route path="/egresos" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><EgresosPage /></PrivateRoute>} />
            <Route path="/egresos/nuevo" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><EgresoFormPage /></PrivateRoute>} />

            {/* Finanzas — shared: caja/proyección/flujo, lectura sobre ingresos/egresos ya cargados */}
            <Route path="/finanzas" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><FinanzasPage /></PrivateRoute>} />

            {/* Proveedores, gastos fijos, variaciones, aprendizajes — shared: dataEntry opera las 8 entidades */}
            <Route path="/proveedores" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><ProveedoresPage /></PrivateRoute>} />
            <Route path="/proveedores/:id" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><ProveedorDetailPage /></PrivateRoute>} />
            <Route path="/clientes" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><ClientesPage /></PrivateRoute>} />
            <Route path="/clientes/:id" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><ClienteDetailPage /></PrivateRoute>} />
            <Route path="/gastos-fijos" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><GastosFijosPage /></PrivateRoute>} />
            <Route path="/variaciones" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><VariacionesPage /></PrivateRoute>} />
            <Route path="/aprendizajes" element={<PrivateRoute allowedRoles={['admin', 'dataEntry']}><AprendizajesPage /></PrivateRoute>} />

            {/* Admin only */}
            <Route path="/config" element={<PrivateRoute allowedRoles={['admin']}><ConfigPage /></PrivateRoute>} />

            {/* Shared */}
            <Route path="/asistente" element={<PrivateRoute><AsistentePage /></PrivateRoute>} />
            <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />

            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>

          <InstallBanner />
          <Toaster position="top-center" richColors toastOptions={{ style: { borderRadius: '1rem' } }} />
        </div>
      </Router>
      </PorteDataProvider>
    </AuthProvider>
    </QueryClientProvider>
  )
}
