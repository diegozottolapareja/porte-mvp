import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { type Role } from '@/config/appConfig'
import { hasPermission, rolesConfig, type Permission } from '@/config/rolesConfig'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  tenantId: string
  permissions: string[]
  avatarUrl?: string
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  /** Verifica si el usuario tiene un permiso específico. Preferir sobre chequear user.role. */
  can: (permission: Permission) => boolean
  login: (credentials: LoginCredentials) => Promise<void>
  loginWithBiometrics: (role: Role) => Promise<void>
  logout: () => Promise<void>
}

export interface LoginCredentials {
  email: string
  password: string
  role: Role
}

// ─── Mapeo rol de base (snake_case) ↔ rol de frontend (camelCase) ─────────────

const DB_ROLE_TO_APP_ROLE: Record<string, Role> = {
  admin: 'admin',
  data_entry: 'dataEntry',
}

// ─── WebAuthn helpers ─────────────────────────────────────────────────────────

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function buildAuthUser(supabaseUser: { id: string; email?: string }): Promise<AuthUser> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('nombre, role, activo')
    .eq('id', supabaseUser.id)
    .single()

  if (error || !profile || !profile.activo) {
    throw new Error('Usuario sin perfil activo')
  }

  const role = DB_ROLE_TO_APP_ROLE[profile.role] ?? 'dataEntry'
  return {
    id: supabaseUser.id,
    name: profile.nombre,
    email: supabaseUser.email ?? '',
    role,
    tenantId: 'porte-001',
    permissions: rolesConfig[role]?.permissions ?? [],
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try {
          setUser(await buildAuthUser(session.user))
        } catch {
          setUser(null)
        }
      }
      setIsLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        buildAuthUser(session.user).then(setUser).catch(() => setUser(null))
      } else {
        setUser(null)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  // Verifica si el usuario actual tiene un permiso. Usar esto en lugar de comparar user.role.
  const can = useCallback((permission: Permission): boolean => {
    if (!user) return false
    return hasPermission(user.permissions, permission)
  }, [user])

  const login = async ({ email, password }: LoginCredentials) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) throw new Error('Email o contraseña incorrectos')
    setUser(await buildAuthUser(data.user))
  }

  const loginWithBiometrics = async (_role: Role) => {
    // Scaffold — WebAuthn requiere un flujo de registro/verificación de credenciales
    // contra el backend (Supabase no lo resuelve out-of-the-box); no implementado aún.
    throw new Error('Login biométrico no disponible todavía')
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, can, login, loginWithBiometrics, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
