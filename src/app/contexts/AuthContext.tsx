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
  login: (credentials: LoginCredentials) => Promise<AuthUser>
  loginWithBiometrics: (role: Role) => Promise<AuthUser>
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

// `buildAuthUser` termina disparándose para el mismo usuario desde hasta 3
// lugares casi al mismo tiempo (getSession() al montar, el evento
// INITIAL_SESSION de onAuthStateChange, y el SIGNED_IN que dispara
// signInWithPassword durante login()) — sin esto cada uno hacía su propio
// GET a `profiles` por separado. Cachea la promesa en vuelo por userId así
// las llamadas concurrentes comparten un único request real.
let pendingBuild: { userId: string; promise: Promise<AuthUser> } | null = null

function buildAuthUserOnce(supabaseUser: { id: string; email?: string }): Promise<AuthUser> {
  if (pendingBuild && pendingBuild.userId === supabaseUser.id) return pendingBuild.promise
  const promise = buildAuthUser(supabaseUser)
  pendingBuild = { userId: supabaseUser.id, promise }
  promise.finally(() => {
    if (pendingBuild?.promise === promise) pendingBuild = null
  })
  return promise
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try {
          setUser(await buildAuthUserOnce(session.user))
        } catch {
          setUser(null)
        }
      }
      setIsLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        buildAuthUserOnce(session.user).then(setUser).catch(() => setUser(null))
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
    const authUser = await buildAuthUserOnce(data.user)
    setUser(authUser)
    return authUser
  }

  const loginWithBiometrics = async (_role: Role): Promise<AuthUser> => {
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
