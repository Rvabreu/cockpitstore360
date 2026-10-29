import { csrfFetch, safeReturnPath } from './authService'

export const GOOGLE_ERROR = 'Não foi possível entrar com Google. Tente novamente ou use seu e-mail e senha.'
export const GOOGLE_UNAVAILABLE = 'Login com Google indisponível no momento. Use seu e-mail e senha.'
export const GOOGLE_CANCELLED = 'Login com Google cancelado. Você pode tentar novamente ou usar seu e-mail e senha.'

export type GoogleResult = 'cancelled' | 'error' | 'unavailable'
export function googleResult(value: unknown): GoogleResult | undefined {
  return value === 'cancelled' || value === 'error' || value === 'unavailable' ? value : undefined
}

export async function googleAvailable(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') throw new Error()
    const response = await fetch('/api/auth/google/status', { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) throw new Error()
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !('available' in data) || typeof data.available !== 'boolean') throw new Error()
    return data.available
  } catch {
    throw new Error(GOOGLE_UNAVAILABLE)
  }
}

export async function startGoogleLogin(returnTo: unknown): Promise<void> {
  try {
    const response = await csrfFetch('/api/auth/google/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnTo: safeReturnPath(returnTo) }),
    })
    if (!response.ok) throw new Error()
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || !('authorizationUrl' in data) ||
      typeof data.authorizationUrl !== 'string') throw new Error()
    const url = new URL(data.authorizationUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com' ||
      url.port || url.username || url.password || url.pathname !== '/o/oauth2/v2/auth' || url.hash) throw new Error()
    // Only an allowlisted Google authorization endpoint can leave this origin.
    // The browser supplies Origin on the same-origin POST; csrfFetch supplies the in-memory CSRF.
    window.location.assign(url.href)
  } catch {
    throw new Error(GOOGLE_ERROR)
  }
}
