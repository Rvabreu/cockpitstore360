// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import { request as httpRequest } from 'node:http'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import type { JWTPayload } from 'jose'
import Database from 'better-sqlite3'
import { AuthStore, authConfig, GOOGLE_FLOW_TTL, RATE_WINDOW } from './auth.ts'
import { googleCallbackQuery, googleConfig } from './google.ts'

const env = { AUTH_ORIGIN: 'https://store.example', NODE_ENV: 'production', GOOGLE_CLIENT_ID: 'client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'never-log-secret', GOOGLE_REDIRECT_URI: 'https://store.example/api/auth/google/callback' }
const config = authConfig(env)
const google = googleConfig(env)!
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'google-auth-'))
let keys: Awaited<ReturnType<typeof generateKeyPair>>
let jwks: { keys: object[] }
let now: number, store: AuthStore, server: Server, base: string
let claims: JWTPayload, pending: (() => Promise<void>) | undefined
let tokenResponse: Response | undefined
let signingAlgorithm: string
const fetcher = vi.fn<typeof fetch>()
beforeAll(async () => {
  keys = await generateKeyPair('RS256', { extractable: true })
  jwks = { keys: [{ ...await exportJWK(keys.publicKey), kid: 'test', alg: 'RS256', use: 'sig' }] }
  process.env.STORE_DB_PATH = path.join(tmp, 'store.db')
})
beforeEach(async () => {
  now = 1793300000000
  store = new AuthStore(':memory:', () => now)
  claims = {}; pending = undefined; tokenResponse = undefined; signingAlgorithm = 'RS256'
  fetcher.mockReset()
  fetcher.mockImplementation(async (input, init) => {
    expect(init?.redirect).toBe('error')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    if (String(input) === 'https://www.googleapis.com/oauth2/v3/certs') return Response.json(jwks)
    expect(String(input)).toBe('https://oauth2.googleapis.com/token')
    if (pending) await pending()
    if (tokenResponse) return tokenResponse
    const body = new URLSearchParams(String(init?.body))
    expect(body.get('client_secret')).toBe(env.GOOGLE_CLIENT_SECRET)
    expect(body.get('redirect_uri')).toBe(env.GOOGLE_REDIRECT_URI)
    expect(body.get('grant_type')).toBe('authorization_code')
    const token = await new SignJWT({ iss: 'https://accounts.google.com', aud: google.clientId, sub: 'subject-1',
      iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 300, email: 'social@example.com', email_verified: true, ...claims })
      .setProtectedHeader({ alg: signingAlgorithm, kid: 'test' }).sign(keys.privateKey)
    return Response.json({ id_token: token, access_token: 'discard-this' })
  })
  const { createApiApp } = await import('./index.ts')
  server = createApiApp({ store, config, google: { config: google, fetcher } }).listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
})
afterEach(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); store.close() })
afterAll(() => { delete process.env.STORE_DB_PATH; fs.rmSync(tmp, { recursive: true, force: true }) })

async function request(route: string, options: { cookie?: string; csrf?: string; body?: unknown; origin?: string } = {}) {
  const headers: Record<string, string> = { Origin: options.origin ?? config.origin }
  if (options.cookie) headers.Cookie = options.cookie
  if (options.csrf) headers['X-CSRF-Token'] = options.csrf
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  return fetch(base + route, { method: options.body === undefined ? 'GET' : 'POST', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body), redirect: 'manual' })
}
const cookies = (res: Response) => res.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ')
async function start(returnTo: unknown = '/#pedidos') {
  const anonymous = await request('/auth/session')
  const session = await anonymous.json()
  const sessionCookie = cookies(anonymous)
  const response = await request('/auth/google/start', { cookie: sessionCookie, csrf: session.csrfToken, body: { returnTo } })
  const body = await response.json()
  const url = new URL(body.authorizationUrl)
  claims.nonce = url.searchParams.get('nonce')!
  return { url, response, body, cookie: `${sessionCookie}; ${cookies(response)}`, sessionCookie, csrf: session.csrfToken, state: url.searchParams.get('state')! }
}
const callback = (flow: Awaited<ReturnType<typeof start>>, query = '') => request(`/auth/google/callback?state=${flow.state}&${query || 'code=provider-code'}`, { cookie: flow.cookie })

describe('Google configuration and strict requests', () => {
  it('requires explicit valid configuration, exact callback and production HTTPS', () => {
    expect(googleConfig(env)).toEqual(google)
    for (const overrides of [{ AUTH_ORIGIN: undefined }, { GOOGLE_CLIENT_SECRET: '' }, { GOOGLE_CLIENT_ID: 'wrong' },
      { GOOGLE_REDIRECT_URI: 'https://evil.example/callback' }, { AUTH_ORIGIN: 'https://store.example/' },
      { AUTH_ORIGIN: 'http://store.example' }, { GOOGLE_REDIRECT_URI: `${env.GOOGLE_REDIRECT_URI}?x=1` }]) {
      expect(googleConfig({ ...env, ...overrides })).toBeUndefined()
    }
    expect(googleConfig({})).toBeUndefined()
  })
  it('publishes only availability and protects start with existing Origin/CSRF and exact JSON', async () => {
    expect(await (await request('/auth/google/status')).json()).toEqual({ available: true })
    const flow = await start()
    for (const body of [{}, { returnTo: 2 }, { returnTo: '/', extra: true }, [], null]) {
      expect((await request('/auth/google/start', { cookie: flow.cookie, csrf: flow.csrf, body })).status).toBe(400)
    }
    expect((await request('/auth/google/start', { body: { returnTo: '/' } })).status).toBe(403)
    expect((await request('/auth/google/start', { cookie: flow.cookie, csrf: flow.csrf, body: { returnTo: '/' }, origin: 'https://evil.example' })).status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('restricts status to the configured Origin or verified same-origin GET metadata without cookies', async () => {
    const getStatus = (headers: Record<string, string>) => new Promise<{ status: number | undefined; cookie: string[] | undefined; body: unknown }>((resolve, reject) => {
      const req = httpRequest(base + '/auth/google/status', { headers }, (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => { body += chunk })
        res.on('end', () => resolve({ status: res.statusCode, cookie: res.headers['set-cookie'], body: JSON.parse(body) }))
      })
      req.on('error', reject)
      req.end()
    })
    const allowed: Record<string, string>[] = [{ Origin: config.origin }, { Host: 'store.example', 'Sec-Fetch-Site': 'same-origin' }]
    for (const headers of allowed) {
      const response = await getStatus(headers)
      expect(response).toEqual({ status: 200, cookie: undefined, body: { available: true } })
    }
    const denied: Record<string, string>[] = [{ Origin: 'https://evil.example' }, {}, { Host: 'store.example' },
      { Host: 'evil.example', 'Sec-Fetch-Site': 'same-origin' }, { Origin: config.origin, 'Sec-Fetch-Site': 'same-site' }]
    for (const headers of denied) {
      const response = await getStatus(headers)
      expect(response).toEqual({ status: 403, cookie: undefined, body: { error: 'Requisição não autorizada.' } })
    }
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('disables incomplete configuration without affecting local session endpoints', async () => {
    const { createApiApp } = await import('./index.ts')
    const disabled = createApiApp({ store, config, google: { config: googleConfig({}), fetcher } }).listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => disabled.once('listening', resolve))
    const oldBase = base
    base = `http://127.0.0.1:${(disabled.address() as { port: number }).port}/api`
    try {
      expect(await (await request('/auth/google/status')).json()).toEqual({ available: false })
      const anonymous = await request('/auth/session')
      const session = await anonymous.json()
      expect((await request('/auth/google/start', { cookie: cookies(anonymous), csrf: session.csrfToken, body: { returnTo: '/' } })).status).toBe(503)
      expect((await request(`/auth/google/callback?state=${'x'.repeat(43)}&code=x`)).headers.get('location')).toBe('/login?google=unavailable')
      expect(fetcher).not.toHaveBeenCalled()
    } finally {
      base = oldBase
      await new Promise<void>((resolve) => disabled.close(() => resolve()))
    }
  })
  it('uses cryptographic state, S256 verifier, nonce, minimal scopes and secure opaque cookie', async () => {
    const flow = await start('//evil.example')
    const stored = store.db.prepare('SELECT * FROM auth_google_flows').get() as { verifier: string; nonce: string; state_hash: string; binding_hash: string; return_to: string }
    expect(flow.url.origin).toBe('https://accounts.google.com')
    expect(flow.url.searchParams.get('scope')).toBe('openid email profile')
    expect(flow.url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(flow.url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(stored.verifier).digest('base64url'))
    for (const value of [flow.state, stored.verifier, stored.nonce]) expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(stored.state_hash).not.toBe(flow.state)
    expect(stored.return_to).toBe('/')
    const header = flow.response.headers.get('set-cookie')!
    for (const flag of ['__Host-cockpit-google=', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(header).toContain(flag)
    expect(header).not.toContain('Domain=')
    expect(JSON.stringify(flow.body).includes(env.GOOGLE_CLIENT_SECRET)).toBe(false)
  })
  it('accepts known Google callback metadata but rejects extras, duplicates and ambiguous responses', () => {
    const state = 'x'.repeat(43)
    expect(googleCallbackQuery(`/?state=${state}&code=x&scope=openid&authuser=0&prompt=consent&hd=example.com&iss=https%3A%2F%2Faccounts.google.com`).code).toBe('x')
    for (const tail of ['code=x&evil=1', 'code=x&code=y', 'code=x&error=access_denied', 'code=x&state=y', 'code=', 'error=', 'code=x&iss=evil', 'code=%00']) {
      expect(() => googleCallbackQuery(`/?state=${state}&${tail}`)).toThrow()
    }
  })
})

describe('one-use session-bound flows', () => {
  it('creates a social account, rotates the existing session and restores the same subject without email rebinding', async () => {
    const flow = await start()
    const response = await callback(flow)
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/#pedidos')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(store.session(flow.sessionCookie.split('=')[1])).toBeUndefined()
    const session = await (await request('/auth/session', { cookie: cookies(response) })).json()
    expect(session.user).toEqual({ authenticated: true })
    expect(session.csrfToken).not.toBe(flow.csrf)
    expect(await store.authenticate('social@example.com', 'A-strong-password-2026')).toBeNull()
    await expect(store.provision('social@example.com', 'A-strong-password-2026')).rejects.toThrow()
    const replay = await callback(flow)
    expect(replay.headers.get('location')).toBe('/login?google=error')
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/token'))).toHaveLength(1)
    const restored = await start('/')
    claims.email = 'changed@example.com'
    expect((await callback(restored)).headers.get('location')).toBe('/')
    expect(store.db.prepare('SELECT email FROM auth_users').all()).toEqual([{ email: 'social@example.com' }])
    const logout = await request('/auth/logout', { cookie: cookies(response), csrf: session.csrfToken, body: {} })
    expect((await logout.json()).user).toBeNull()
    expect(store.session(cookies(response).split('=')[1])).toBeUndefined()
  })
  it.each(['state', 'binding', 'duplicate binding', 'session', 'expiration', 'restart flow'])('rejects invalid %s before network', async (kind) => {
    const flow = await start()
    if (kind === 'state') flow.state = 'z'.repeat(43)
    if (kind === 'binding') flow.cookie = flow.sessionCookie
    if (kind === 'duplicate binding') flow.cookie += `; ${cookies(flow.response)}`
    if (kind === 'session') flow.cookie = cookies(flow.response)
    if (kind === 'expiration') now += GOOGLE_FLOW_TTL
    if (kind === 'restart flow') store.startGoogle(store.session(flow.sessionCookie.split('=')[1])!, '/')
    expect((await callback(flow)).headers.get('location')).toBe('/login?google=error')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each(['access_denied', 'server_error'])('consumes provider error %s without exchange', async (error) => {
    const flow = await start()
    expect((await callback(flow, `error=${error}&error_description=secret-details`)).headers.get('location')).toBe(`/login?google=${error === 'access_denied' ? 'cancelled' : 'error'}`)
    expect((await callback(flow)).headers.get('location')).toBe('/login?google=error')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each(['logout', 'rotate', 'expire'])('prevents success when session changes during network: %s', async (kind) => {
    const flow = await start()
    pending = async () => {
      if (kind === 'logout') await request('/auth/logout', { cookie: flow.sessionCookie, csrf: flow.csrf, body: {} })
      if (kind === 'rotate') store.rotate(store.session(flow.sessionCookie.split('=')[1]))
      if (kind === 'expire') now += GOOGLE_FLOW_TTL
    }
    expect((await callback(flow)).headers.get('location')).toBe('/login?google=error')
    expect(store.db.prepare('SELECT * FROM auth_users').all()).toHaveLength(0)
  })
  it('consumes state atomically against concurrent replay before awaiting provider', async () => {
    const flow = await start()
    let release!: () => void, entered!: () => void
    const ready = new Promise<void>((resolve) => { entered = resolve })
    pending = () => { entered(); return new Promise<void>((resolve) => { release = resolve }) }
    const first = callback(flow)
    await ready
    const replay = await callback(flow)
    expect(replay.headers.get('location')).toBe('/login?google=error')
    release()
    expect((await first).headers.get('location')).toBe('/#pedidos')
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/token'))).toHaveLength(1)
  })
  it('refuses email collisions without linking or altering local credentials', async () => {
    await store.provision('social@example.com', 'A-strong-password-2026')
    const flow = await start()
    expect((await callback(flow)).headers.get('location')).toBe('/login?google=error')
    expect(store.db.prepare('SELECT * FROM auth_identities').all()).toHaveLength(0)
    expect(await store.authenticate('social@example.com', 'A-strong-password-2026')).toBe(1)
    const local = await request('/auth/login', { cookie: flow.sessionCookie, csrf: flow.csrf, body: { email: 'social@example.com', password: 'A-strong-password-2026' } })
    expect(local.status).toBe(200)
  })
  it('refuses a new subject colliding with another social account', async () => {
    const first = await start()
    expect((await callback(first)).headers.get('location')).toBe('/#pedidos')
    const second = await start()
    claims.sub = 'different-subject'
    expect((await callback(second)).headers.get('location')).toBe('/login?google=error')
    expect(store.db.prepare('SELECT subject FROM auth_identities').all()).toEqual([{ subject: 'subject-1' }])
    expect(store.db.prepare('SELECT * FROM auth_users').all()).toHaveLength(1)
  })
})

describe('provider verification', () => {
  it.each([
    { iss: 'https://evil.example' }, { aud: 'other' }, { azp: 'other' }, { aud: [google.clientId, 'other'] },
    { exp: 1 }, { iat: 1793300100 }, { iat: 1 }, { nonce: 'wrong' }, { email_verified: false },
    { email_verified: 'true' }, { email: 'invalid' }, { sub: '' }, { sub: 'x'.repeat(256) }, { exp: 'bad' },
  ])('rejects signed invalid claims %j and never retries consumed state', async (invalid) => {
    const flow = await start()
    Object.assign(claims, invalid)
    expect((await callback(flow)).headers.get('location')).toBe('/login?google=error')
    expect((await callback(flow)).headers.get('location')).toBe('/login?google=error')
    expect(store.db.prepare('SELECT * FROM auth_users').all()).toHaveLength(0)
  })
  it('accepts multi-audience only with matching azp and Google bare issuer', async () => {
    const flow = await start()
    claims.aud = [google.clientId, 'other']; claims.azp = google.clientId; claims.iss = 'accounts.google.com'
    expect((await callback(flow)).headers.get('location')).toBe('/#pedidos')
  })
  it.each(['exp', 'iat', 'nonce', 'email_verified', 'email', 'sub'])('requires claim %s', async (claim) => {
    const flow = await start()
    claims[claim] = undefined
    expect((await callback(flow)).headers.get('location')).toBe('/login?google=error')
    expect(store.db.prepare('SELECT * FROM auth_users').all()).toHaveLength(0)
  })
  it('aborts stalled provider requests at the configured timeout', async () => {
    const flow = await start()
    const controller = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
    let entered!: () => void
    const ready = new Promise<void>((resolve) => { entered = resolve })
    fetcher.mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      entered()
      init?.signal?.addEventListener('abort', () => reject(new Error('timeout')), { once: true })
    }))
    try {
      const response = callback(flow)
      await ready
      expect(timeout).toHaveBeenCalledWith(5000)
      controller.abort()
      expect((await response).headers.get('location')).toBe('/login?google=error')
      expect(store.db.prepare('SELECT * FROM auth_users').all()).toHaveLength(0)
    } finally { timeout.mockRestore() }
  })
  it('rejects tokens expiring while JWKS is being fetched', async () => {
    const flow = await start()
    claims.exp = Math.floor(now / 1000) + 1
    const mock = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (input, init) => {
      if (String(input).includes('/certs')) now += 2000
      return mock(input, init)
    })
    expect((await callback(flow)).headers.get('location')).toBe('/login?google=error')
  })
  it('rejects invalid signature and algorithms', async () => {
    const flow = await start()
    const wrong = await generateKeyPair('RS256')
    tokenResponse = Response.json({ id_token: await new SignJWT({ nonce: claims.nonce }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(wrong.privateKey) })
    expect((await callback(flow)).headers.get('location')).toBe('/login?google=error')
    const next = await start()
    tokenResponse = Response.json({ id_token: await new SignJWT({ nonce: claims.nonce }).setProtectedHeader({ alg: 'HS256' }).sign(new Uint8Array(32)) })
    expect((await callback(next)).headers.get('location')).toBe('/login?google=error')
  })
  it('rejects non-string subject claims', async () => {
    const flow = await start()
    tokenResponse = Response.json({ id_token: await new SignJWT({ iss: 'https://accounts.google.com', aud: google.clientId,
      sub: 123 as unknown as string, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 300,
      nonce: claims.nonce, email: 'social@example.com', email_verified: true }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(keys.privateKey) })
    expect((await callback(flow)).headers.get('location')).toBe('/login?google=error')
  })
  it('rejects malformed JWKS without authenticating', async () => {
    const flow = await start()
    const mock = fetcher.getMockImplementation()!
    fetcher.mockImplementation((input, init) => String(input).includes('/certs') ? Promise.resolve(Response.json({ keys: [] })) : mock(input, init))
    expect((await callback(flow)).headers.get('location')).toBe('/login?google=error')
    expect(store.db.prepare('SELECT * FROM auth_users').all()).toHaveLength(0)
  })
  it.each(['http', 'malformed', 'oversized', 'missing token', 'network'])('sanitizes token exchange failure: %s', async (kind) => {
    const flow = await start()
    if (kind === 'http') tokenResponse = Response.json({ error: env.GOOGLE_CLIENT_SECRET }, { status: 400 })
    if (kind === 'malformed') tokenResponse = new Response('{', { headers: { 'Content-Type': 'application/json' } })
    if (kind === 'oversized') tokenResponse = new Response('x'.repeat(65537), { headers: { 'Content-Type': 'application/json' } })
    if (kind === 'missing token') tokenResponse = Response.json({ access_token: 'secret' })
    if (kind === 'network') fetcher.mockRejectedValue(new Error(env.GOOGLE_CLIENT_SECRET))
    const response = await callback(flow)
    expect(response.headers.get('location')).toBe('/login?google=error')
    expect(await response.text()).not.toContain(env.GOOGLE_CLIENT_SECRET)
    expect(store.db.prepare('SELECT * FROM auth_users').all()).toHaveLength(0)
  })
  it('sends only the stored verifier and ignores callback metadata as credentials', async () => {
    const flow = await start()
    const { verifier } = store.db.prepare('SELECT verifier FROM auth_google_flows').get() as { verifier: string }
    await callback(flow, 'code=provider-code&scope=openid&authuser=0')
    const call = fetcher.mock.calls.find(([url]) => String(url).includes('/token'))!
    const body = new URLSearchParams(String(call[1]?.body))
    expect(body.get('code_verifier')).toBe(verifier)
    expect(body.get('code')).toBe('provider-code')
    expect(body.has('authuser')).toBe(false)
  })
})

describe('persistence and isolated rate limits', () => {
  it('persists identity and flow across restart with the existing NOT NULL schema', () => {
    const filename = path.join(tmp, 'restart.db')
    const legacy = new Database(filename)
    legacy.exec('CREATE TABLE auth_users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL)')
    legacy.close()
    let persistent = new AuthStore(filename, () => now)
    const session = persistent.rotate(undefined)
    const flow = persistent.startGoogle(session.session, '/')
    persistent.close()
    persistent = new AuthStore(filename, () => now)
    const consumed = persistent.consumeGoogle(flow.state, flow.binding, persistent.session(session.raw))!
    const login = persistent.finishGoogle(consumed, 'persistent', 'persist@example.com')
    persistent.close()
    persistent = new AuthStore(filename, () => now)
    expect(persistent.session(login.raw)?.user_id).toBe(1)
    expect(persistent.db.prepare('SELECT subject FROM auth_identities').all()).toEqual([{ subject: 'persistent' }])
    expect(persistent.db.prepare('SELECT password_hash FROM auth_users').get()).toEqual({ password_hash: '!social-only!' })
    persistent.close()
  })
  it('bounds start/callback IP independently from password and anonymous limits', () => {
    for (let i = 0; i < 20; i++) expect(store.consumeGoogleAttempt('start', 'ip')).toBe(true)
    expect(store.consumeGoogleAttempt('start', 'ip')).toBe(false)
    for (let i = 0; i < 60; i++) expect(store.consumeGoogleAttempt('callback', 'ip')).toBe(true)
    expect(store.consumeGoogleAttempt('callback', 'ip')).toBe(false)
    expect(store.consumeAttempt('x@example.com', 'ip')).toBe(true)
    expect(store.consumeAnonymous('ip')).toBe(true)
    now += RATE_WINDOW
    expect(store.consumeGoogleAttempt('start', 'ip')).toBe(true)
    expect(store.consumeGoogleAttempt('callback', 'ip')).toBe(true)
  })
  it('enforces independent limits at HTTP endpoints using socket IP', async () => {
    const flow = await start()
    for (let i = 1; i < 20; i++) expect(store.consumeGoogleAttempt('start', '127.0.0.1')).toBe(true)
    const blocked = await request('/auth/google/start', { cookie: flow.cookie, csrf: flow.csrf, body: { returnTo: '/' } })
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBe('900')
    for (let i = 0; i < 60; i++) expect(store.consumeGoogleAttempt('callback', '127.0.0.1')).toBe(true)
    expect((await callback(flow)).headers.get('location')).toBe('/login?google=error')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
