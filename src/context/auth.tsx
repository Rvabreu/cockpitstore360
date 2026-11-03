import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as authService from '../services/authService'
import type { AuthSession } from '../services/authService'

type AuthContextValue = {
  user: AuthSession['user']
  loading: boolean
  error: string | null
  pending: 'login' | 'logout' | 'otp' | null
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<boolean>
  verifyBlackFridayOtp: (email: string, code: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSession['user']>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<AuthContextValue['pending']>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  async function refresh() {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    setError(null)
    try {
      setUser((await authService.restoreSession()).user)
    } catch {
      setError(authService.SESSION_ERROR)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  async function mutate(action: 'login' | 'logout' | 'otp', email = '', password = '') {
    if (busy.current) return false
    busy.current = true
    setPending(action)
    setError(null)
    try {
      const session = action === 'login'
        ? await authService.login(email, password)
        : action === 'otp' ? await authService.verifyBlackFridayOtp(email, password) : await authService.logout()
      setUser(session.user)
      return true
    } catch {
      setError(action === 'login' ? authService.AUTH_ERROR : action === 'otp' ? authService.OTP_ERROR : authService.LOGOUT_ERROR)
      return false
    } finally {
      busy.current = false
      setPending(null)
    }
  }

  return <AuthContext.Provider value={{ user, loading, pending, error, refresh,
    login: (email, password) => mutate('login', email, password),
    logout: () => mutate('logout'),
    verifyBlackFridayOtp: (email, code) => mutate('otp', email, code),
  }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
