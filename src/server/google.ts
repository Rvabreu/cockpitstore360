import { createHash } from 'node:crypto'
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose'
import type { JWTVerifyGetKey } from 'jose'
import { authConfig, validEmail } from './auth.ts'
import type { GoogleFlow } from './auth.ts'

const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const JWKS = 'https://www.googleapis.com/oauth2/v3/certs'
const RETURN_PATHS = new Set(['/', '/#colecao', '/#pedidos', '/#fluxo'])
export const safeGoogleReturnPath = (value: string) => RETURN_PATHS.has(value) ? value : '/'

export function googleConfig(env: NodeJS.ProcessEnv = process.env) {
  try {
    if (!env.AUTH_ORIGIN || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) return undefined
    const { origin } = authConfig(env)
    if (env.GOOGLE_REDIRECT_URI !== `${origin}/api/auth/google/callback` ||
        !/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID) ||
        !env.GOOGLE_CLIENT_SECRET.trim() || env.GOOGLE_CLIENT_SECRET.length > 4096) return undefined
    return { origin, clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: env.GOOGLE_REDIRECT_URI }
  } catch { return undefined }
}

// Bound both the token response and JWKS, including streamed bodies and redirects.
async function boundedFetch(fetcher: typeof fetch, input: string | URL | Request, init?: RequestInit) {
  const timeout = AbortSignal.timeout(5000)
  const signal = init?.signal ? AbortSignal.any([timeout, init.signal]) : timeout
  const response = await fetcher(input, { ...init, redirect: 'error', signal })
  if (!response.ok || !response.body || !response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    await response.body?.cancel().catch(() => {})
    throw new Error('Resposta inválida')
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  const abort = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', abort, { once: true })
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      size += value.byteLength
      if (size > 64 * 1024) throw new Error('Resposta excessiva')
      chunks.push(value)
    }
    return new Response(Buffer.concat(chunks), { status: response.status, headers: { 'Content-Type': 'application/json' } })
  } finally {
    signal.removeEventListener('abort', abort)
    await reader.cancel().catch(() => {})
  }
}

export type GoogleOptions = { config?: ReturnType<typeof googleConfig>; fetcher?: typeof fetch; keyResolver?: JWTVerifyGetKey }
export class GoogleOidc {
  readonly config: ReturnType<typeof googleConfig>
  private readonly fetcher: typeof fetch
  private readonly keys: JWTVerifyGetKey

  constructor(options: GoogleOptions = {}) {
    this.config = options.config ?? googleConfig()
    this.fetcher = options.fetcher ?? fetch
    this.keys = options.keyResolver ?? createRemoteJWKSet(new URL(JWKS), {
      timeoutDuration: 5000, [customFetch]: (input, init) => boundedFetch(this.fetcher, input, init),
    })
  }

  authorization(flow: { state: string; verifier: string; nonce: string }) {
    if (!this.config) throw new Error('Indisponível')
    const url = new URL(AUTHORIZE)
    url.search = new URLSearchParams({ client_id: this.config.clientId, redirect_uri: this.config.redirectUri,
      response_type: 'code', scope: 'openid email profile', state: flow.state, nonce: flow.nonce,
      code_challenge: createHash('sha256').update(flow.verifier).digest('base64url'), code_challenge_method: 'S256' }).toString()
    return url.href
  }

  async exchange(code: string, flow: GoogleFlow, clock: () => number) {
    if (!this.config) throw new Error('Indisponível')
    const response = await boundedFetch(this.fetcher, TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: this.config.clientId,
        client_secret: this.config.clientSecret, redirect_uri: this.config.redirectUri, code_verifier: flow.verifier }) })
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || !('id_token' in data) || typeof data.id_token !== 'string' || data.id_token.length > 16 * 1024) throw new Error('Token inválido')
    const now = clock()
    const { payload } = await jwtVerify(data.id_token, this.keys, { algorithms: ['RS256'],
      issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: this.config.clientId,
      requiredClaims: ['sub', 'exp', 'iat', 'nonce', 'email', 'email_verified'], currentDate: new Date(now), maxTokenAge: '1h' })
    const finishedAt = Math.floor(clock() / 1000)
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255 || payload.nonce !== flow.nonce || payload.email_verified !== true || !validEmail(payload.email) ||
        typeof payload.exp !== 'number' || payload.exp <= finishedAt ||
        typeof payload.iat !== 'number' || payload.iat > finishedAt || finishedAt - payload.iat > 3600 ||
        (payload.azp !== undefined && payload.azp !== this.config.clientId) ||
        (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== this.config.clientId)) throw new Error('Claims inválidos')
    return { subject: payload.sub, email: payload.email }
  }
}

export function googleCallbackQuery(originalUrl: string) {
  const query = new URL(originalUrl, 'http://callback.invalid').searchParams
  const known = new Set(['state', 'code', 'error', 'error_description', 'error_uri', 'scope', 'authuser', 'prompt', 'hd', 'iss'])
  for (const [key, value] of query) {
    if (!known.has(key) || query.getAll(key).length !== 1 || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Query inválida')
  }
  const state = query.get('state') ?? '', code = query.get('code'), error = query.get('error')
  if (!/^[A-Za-z0-9_-]{43}$/.test(state) || (!code && !error) || (code !== null && error !== null) ||
      (query.has('iss') && !['https://accounts.google.com', 'accounts.google.com'].includes(query.get('iss')!))) throw new Error('Query inválida')
  return { state, code, error }
}
