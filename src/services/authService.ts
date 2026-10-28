export interface AuthUser {
  id: string
  email: string
}

export interface AuthSession {
  user: AuthUser | null
  csrfToken: string
}

const GENERIC_ERROR = 'Não foi possível concluir a solicitação. Tente novamente.'
const ERROR_MESSAGES: Record<number, string> = {
  400: 'Dados de acesso inválidos',
  401: 'E-mail ou senha inválidos',
  403: 'Requisição não autorizada',
  429: 'Muitas tentativas. Tente novamente mais tarde.',
}

export class AuthError extends Error {
  readonly status: number
  recoveryFailed = false
  recoveredSession?: AuthSession

  constructor(status: number, context: 'login' | 'register' = 'login') {
    super(context === 'register' && status === 400 ? 'Dados de cadastro inválidos'
      : context === 'register' && status === 409 ? 'Não foi possível cadastrar com os dados informados'
        : ERROR_MESSAGES[status] ?? GENERIC_ERROR)
    this.name = 'AuthError'
    this.status = status
  }
}

function isUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Record<string, unknown>
  return typeof user.id === 'string' && user.id.trim().length > 0
    && typeof user.email === 'string' && user.email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
}

function isSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Record<string, unknown>
  return (session.user === null || isUser(session.user))
    && typeof session.csrfToken === 'string' && session.csrfToken.trim().length > 0
}

// Serialize cookie-changing requests across component lifecycles. StrictMode and
// remounts share only an in-flight bootstrap, never a persisted user or token.
let requestQueue: Promise<unknown> = Promise.resolve()
let pendingBootstrap: Promise<AuthSession> | null = null

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const request = requestQueue.then(operation, operation)
  requestQueue = request.then(() => undefined, () => undefined)
  return request
}

async function request(path: string, options: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(`/api/auth/${path}`, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (!response.ok) throw new AuthError(response.status, path === 'register' ? 'register' : 'login')
    if (path === 'register' && response.status !== 201) throw new AuthError(0)
    return await response.json()
  } catch (error) {
    if (error instanceof AuthError) throw error
    throw new AuthError(0)
  }
}

export function createAuthService() {
  let csrfToken: string | null = null

  async function bootstrap(): Promise<AuthSession> {
    if (!pendingBootstrap) {
      const currentBootstrap = enqueue(async () => {
        const value = await request('session', { method: 'GET' })
        if (!isSession(value)) throw new AuthError(0)
        return { user: value.user, csrfToken: value.csrfToken }
      }).finally(() => {
        if (pendingBootstrap === currentBootstrap) pendingBootstrap = null
      })
      pendingBootstrap = currentBootstrap
    }
    try {
      const session = await pendingBootstrap
      csrfToken = session.csrfToken
      return session
    } catch (error) {
      csrfToken = null
      throw error
    }
  }

  async function post(path: 'login' | 'logout' | 'register', body: string): Promise<unknown> {
    if (!csrfToken) throw new AuthError(0)
    // A bootstrap requested after this mutation must run after it, rather than
    // join an earlier GET whose response predates cookie rotation.
    pendingBootstrap = null
    try {
      return await enqueue(async () => {
        const value = await request(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken! },
          body,
        })
        if (path === 'login') {
          if (!isSession(value) || value.user === null) throw new AuthError(0)
          csrfToken = value.csrfToken
        } else if (path === 'register') {
          if (!isCreated(value)) throw new AuthError(0)
        } else {
          if (!value || typeof value !== 'object' || (value as Record<string, unknown>).user !== null) {
            throw new AuthError(0)
          }
          csrfToken = null
        }
        return value
      })
    } catch (error) {
      if (error instanceof AuthError && error.status === 403) {
        csrfToken = null
        try { error.recoveredSession = await bootstrap() } catch { error.recoveryFailed = true }
      }
      throw error
    }
  }

  return {
    bootstrap,
    async register(email: string, password: string): Promise<{ created: true }> {
      const value = await post('register', JSON.stringify({ email, password }))
      if (!isCreated(value)) throw new AuthError(0)
      return { created: true }
    },
    async login(email: string, password: string): Promise<AuthSession> {
      const value = await post('login', JSON.stringify({ email, password }))
      if (!isSession(value) || value.user === null) throw new AuthError(0)
      return { user: value.user, csrfToken: value.csrfToken }
    },
    async logout(): Promise<{ user: null }> {
      const value = await post('logout', '{}')
      if (!value || typeof value !== 'object' || (value as Record<string, unknown>).user !== null) {
        throw new AuthError(0)
      }
      return { user: null }
    },
  }
}

function isCreated(value: unknown): value is { created: true } {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 1 && (value as Record<string, unknown>).created === true)
}
