import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

interface Session {
  token: string
  user: AuthUser
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  sessionError: string | null
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => Promise<void>
  authenticatedFetch: (path: string, init?: RequestInit) => Promise<Response>
}

export const AUTH_STORAGE_KEY = 'cockpit_store_auth_v1'
const AuthContext = createContext<AuthContextValue | null>(null)

function isUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false
  const user = value as AuthUser
  return typeof user.id === 'string' && !!user.id && typeof user.name === 'string' &&
    typeof user.email === 'string' && typeof user.role === 'string'
}

function storage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try { return window[kind] } catch { return null }
}

function clearSession(): boolean {
  let cleared = true
  for (const kind of ['localStorage', 'sessionStorage'] as const) {
    try {
      const target = storage(kind)
      if (!target) cleared = false
      else target.removeItem(AUTH_STORAGE_KEY)
    } catch { cleared = false }
  }
  return cleared
}

function readSession(): { session: Session; rememberMe: boolean } | null {
  for (const kind of ['localStorage', 'sessionStorage'] as const) {
    const target = storage(kind)
    try {
      const raw = target?.getItem(AUTH_STORAGE_KEY)
      if (!raw) continue
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' &&
        typeof (parsed as Session).token === 'string' && (parsed as Session).token &&
        isUser((parsed as Session).user)) {
        return { session: parsed as Session, rememberMe: kind === 'localStorage' }
      }
      target?.removeItem(AUTH_STORAGE_KEY)
    } catch {
      try { target?.removeItem(AUTH_STORAGE_KEY) } catch { /* Storage is optional. */ }
    }
  }
  return null
}

function persistSession(session: Session, rememberMe: boolean): boolean {
  const cleared = clearSession()
  try {
    const target = storage(rememberMe ? 'localStorage' : 'sessionStorage')
    if (!target) return false
    target.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
    return cleared
  } catch { return false }
}

async function authRequest(path: string, options: RequestInit): Promise<Response> {
  return fetch(`/api/auth/${path}`, { ...options, signal: AbortSignal.timeout(15000) })
}

async function revoke(token: string): Promise<void> {
  const response = await authRequest('logout', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok && response.status !== 401) throw new Error('Falha ao encerrar sessão')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // SSR and the first hydration render never read browser storage.
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const token = useRef<string | null>(null)
  const generation = useRef(0)
  const verified = useRef(false)

  useEffect(() => {
    const current = ++generation.current
    const saved = readSession()
    if (!saved) {
      setIsLoading(false)
      return () => { generation.current++; verified.current = false }
    }
    token.current = saved.session.token
    void (async () => {
      try {
        const response = await authRequest('me', {
          headers: { Authorization: `Bearer ${saved.session.token}` },
        })
        if (current !== generation.current) return
        if (response.status === 401) {
          clearSession()
          token.current = null
          return
        }
        if (!response.ok) throw new Error('Falha ao verificar sessão')
        const body = await response.json()
        if (current !== generation.current) return
        if (!isUser(body.user)) throw new Error('Resposta de sessão inválida')
        setUser(body.user)
        verified.current = true
        if (!persistSession({ token: saved.session.token, user: body.user }, saved.rememberMe)) {
          setSessionError('Seu navegador não permite salvar a sessão. Ela ficará disponível apenas nesta página.')
        }
      } catch {
        if (current === generation.current) {
          setSessionError('Não foi possível verificar sua sessão. Entre novamente ou recarregue a página para tentar de novo.')
        }
      } finally {
        if (current === generation.current) setIsLoading(false)
      }
    })()
    return () => { generation.current++; verified.current = false }
  }, [])

  const login = useCallback(async (email: string, password: string, rememberMe = true) => {
    const current = ++generation.current
    verified.current = false
    setUser(null)
    setIsLoading(true)
    setSessionError(null)
    try {
      let response: Response
      try {
        response = await authRequest('login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        })
      } catch {
        throw new Error('Não foi possível conectar. Verifique sua conexão e tente novamente.')
      }
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(typeof body?.error === 'string' ? body.error : 'Não foi possível entrar. Tente novamente.')
      }
      if (body?.success !== true || !isUser(body.user) || typeof body.token !== 'string' || !body.token) {
        throw new Error('Não foi possível entrar. O servidor retornou uma resposta inválida.')
      }
      if (current !== generation.current) {
        void revoke(body.token).catch(() => {})
        throw new Error('A tentativa de entrada foi cancelada. Tente novamente.')
      }
      const previous = token.current
      token.current = body.token
      setUser(body.user)
      verified.current = true
      if (!persistSession({ token: body.token, user: body.user }, rememberMe)) {
        setSessionError('Seu navegador não permite salvar a sessão. Ela ficará disponível apenas nesta página.')
      }
      if (previous && previous !== body.token) void revoke(previous).catch(() => {})
    } finally {
      if (current === generation.current) setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    const current = ++generation.current
    const previous = token.current
    token.current = null
    verified.current = false
    setUser(null)
    setSessionError(null)
    setIsLoading(true)
    const cleared = clearSession()
    try {
      if (previous) await revoke(previous)
      if (!cleared && current === generation.current) {
        setSessionError('Você saiu, mas não foi possível limpar o armazenamento do navegador.')
      }
    } catch {
      if (current === generation.current) {
        setSessionError('Você saiu neste dispositivo, mas não foi possível encerrar a sessão no servidor. Ela expirará automaticamente.')
      }
    } finally {
      if (current === generation.current) setIsLoading(false)
    }
  }, [])

  const authenticatedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    // Validate before attaching the private credential, including nested encodings.
    let pathname = path.split('?')[0]
    if (!path.startsWith('/api/crm/') || path.includes('#') || /[\u0000-\u0020\u007f]/.test(pathname)) throw new Error('Caminho do CRM inválido')
    for (let depth = 0; depth < 10; depth++) {
      if (!pathname.startsWith('/api/crm/') || /[\u0000-\u0020\u007f]/.test(pathname) || pathname.includes('\\') || pathname.split('/').some(part => part === '.' || part === '..')) {
        throw new Error('Caminho do CRM inválido')
      }
      let decoded: string
      try { decoded = decodeURIComponent(pathname) } catch { throw new Error('Caminho do CRM inválido') }
      if (decoded === pathname) break
      pathname = decoded
      if (depth === 9) throw new Error('Caminho do CRM inválido')
    }
    if (pathname.includes('?') || pathname.includes('#') || pathname.includes('//')) throw new Error('Caminho do CRM inválido')
    const credential = token.current
    const current = generation.current
    if (!verified.current || !credential) throw new Error('Não autenticado')
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${credential}`)
    const timeout = AbortSignal.timeout(15000)
    const response = await fetch(path, {
      ...init, headers, cache: 'no-store', redirect: 'error', credentials: 'omit',
      signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    })
    if (response.status === 401 && generation.current === current && token.current === credential) {
      generation.current++
      token.current = null
      verified.current = false
      setUser(null)
      setIsLoading(false)
      clearSession()
      setSessionError('Sua sessão expirou. Entre novamente.')
    }
    return response
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, isLoading, sessionError, login, logout, authenticatedFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
