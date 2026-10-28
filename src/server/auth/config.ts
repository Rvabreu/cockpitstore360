export type AuthConfig = {
  mode: 'development' | 'production'
  origin: string
  secure: boolean
  sessionCookieName: string
  csrfCookieName: string
}

export function loadAuthConfig({ mode, env = process.env }: {
  mode: AuthConfig['mode']; env?: Record<string, string | undefined>
}): AuthConfig {
  const origin = env.APP_ORIGIN || (mode === 'development' ? 'http://localhost:5000' : '')
  let url: URL
  try { url = new URL(origin) } catch { throw new Error('APP_ORIGIN deve ser uma origem válida.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin ||
    url.username || url.password || (mode === 'production' && url.protocol !== 'https:')) {
    throw new Error('APP_ORIGIN deve ser uma origem exata; produção exige HTTPS.')
  }
  return {
    mode, origin, secure: url.protocol === 'https:',
    sessionCookieName: mode === 'production' ? '__Host-store_session' : 'store_session',
    csrfCookieName: mode === 'production' ? '__Host-store_csrf' : 'store_csrf',
  }
}
