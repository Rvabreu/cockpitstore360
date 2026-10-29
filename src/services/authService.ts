export type AuthSession = {
  user: { authenticated: true } | null
  csrfToken: string
}

export const AUTH_ERROR = 'Não foi possível entrar. Confira seus dados e tente novamente.'
export const SESSION_ERROR = 'Não foi possível verificar sua sessão. Tente novamente.'
export const LOGOUT_ERROR = 'Não foi possível sair. Sua sessão continua conectada. Tente novamente.'

// Never persist credentials, session information or CSRF tokens in browser storage.
let csrfToken: string | null = null
let sessionRequest: Promise<AuthSession> | null = null

function requireBrowser() {
  if (typeof window === 'undefined') throw new Error(SESSION_ERROR)
}

async function readSession(response: Response): Promise<AuthSession> {
  if (!response.ok) throw new Error(SESSION_ERROR)
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('csrfToken' in data) ||
    typeof data.csrfToken !== 'string' || !data.csrfToken || !('user' in data) ||
    (data.user !== null && (typeof data.user !== 'object' ||
      !('authenticated' in data.user) || data.user.authenticated !== true))) {
    throw new Error(SESSION_ERROR)
  }
  const session = data as AuthSession
  csrfToken = session.csrfToken
  return session
}

export async function restoreSession(): Promise<AuthSession> {
  requireBrowser()
  if (!sessionRequest) {
    sessionRequest = fetch('/api/auth/session', {
      credentials: 'same-origin', cache: 'no-store',
    }).then(readSession).catch(() => { throw new Error(SESSION_ERROR) })
      .finally(() => { sessionRequest = null })
  }
  return sessionRequest
}

export async function csrfFetch(path: string, init: RequestInit): Promise<Response> {
  requireBrowser()
  // Restrict this credential-bearing helper to the application's API.
  if (!/^\/api\/[a-zA-Z0-9/_-]+$/.test(path)) throw new Error(SESSION_ERROR)
  if (!csrfToken) await restoreSession()
  const headers = new Headers(init.headers)
  headers.set('X-CSRF-Token', csrfToken!)
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' })
  // A rejected/expired token is refreshed on the next action, never by replaying a POST.
  if (response.status === 403) csrfToken = null
  return response
}

export async function login(email: string, password: string): Promise<AuthSession> {
  try {
    const session = await readSession(await csrfFetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }))
    if (!session.user) throw new Error(AUTH_ERROR)
    return session
  } catch {
    throw new Error(AUTH_ERROR)
  }
}

export async function logout(): Promise<AuthSession> {
  try {
    const session = await readSession(await csrfFetch('/api/auth/logout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    }))
    if (session.user !== null) throw new Error(LOGOUT_ERROR)
    return session
  } catch {
    throw new Error(LOGOUT_ERROR)
  }
}

const RETURN_PATHS = new Set(['/', '/#colecao', '/#pedidos', '/#fluxo'])
export function safeReturnPath(value: unknown): string {
  return typeof value === 'string' && RETURN_PATHS.has(value) ? value : '/'
}
