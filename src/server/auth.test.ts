// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import { request as httpRequest } from 'node:http'
import { execFileSync, spawnSync } from 'node:child_process'
import { AuthStore, authConfig, AUTH_TTL, ANON_TTL, RATE_WINDOW, hashPassword, verifyPassword } from './auth.ts'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-auth-'))
let now = 100000
let store: AuthStore
let server: Server
let base: string
const password = 'A-strong-password-2026'
const config = authConfig({ AUTH_ORIGIN: 'https://store.example', NODE_ENV: 'production' })

beforeAll(async () => {
  process.env.STORE_DB_PATH = path.join(tmp, 'store.db')
  store = new AuthStore(path.join(tmp, 'auth.db'), () => now)
  await store.provision('demo@example.com', password)
  const { createApiApp } = await import('./index.ts')
  server = createApiApp({ store, config }).listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
})
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  store.close()
  delete process.env.STORE_DB_PATH
  fs.rmSync(tmp, { recursive: true, force: true })
})

async function request(route: string, options: { method?: string; cookie?: string; csrf?: string; body?: string; origin?: string; site?: string; contentType?: string; host?: string; referer?: string } = {}) {
  const headers: Record<string, string> = {}
  if (options.origin !== '') headers.Origin = options.origin ?? config.origin
  if (options.cookie) headers.Cookie = options.cookie
  if (options.csrf) headers['X-CSRF-Token'] = options.csrf
  if (options.site) headers['Sec-Fetch-Site'] = options.site
  if (options.host) headers.Host = options.host
  if (options.referer) headers.Referer = options.referer
  if (options.body !== undefined) headers['Content-Type'] = options.contentType ?? 'application/json'
  const response = await fetch(base + route, { method: options.method ?? 'GET', headers, body: options.body })
  const body = await response.json()
  return { response, body, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}
async function anonymous() { return request('/auth/session') }
const post = (cookie: string | undefined, csrf: string, body = '{}') => ({ method: 'POST', cookie, csrf, body })

describe('configuration and passwords', () => {
  it('requires exact HTTPS origin in production', () => {
    for (const origin of ['', 'http://store.example', 'https://store.example/', 'https://store.example/path', 'https://user:pass@store.example']) {
      expect(() => authConfig({ NODE_ENV: 'production', AUTH_ORIGIN: origin })).toThrow()
    }
    expect(() => authConfig({ NODE_ENV: 'production' })).toThrow()
    expect(authConfig({}).secure).toBe(false)
    expect(config.cookieName).toMatch(/^__Host-/)
  })
  it('uses unique salted hashes and expensive fake verification for missing users', async () => {
    const first = await hashPassword(password)
    const second = await hashPassword(password)
    expect(first).not.toBe(second)
    expect(first).not.toContain(password)
    expect(await verifyPassword(password, first)).toBe(true)
    expect(await verifyPassword('wrong-password', first)).toBe(false)
    expect(await verifyPassword(password)).toBe(false)
    expect(await store.authenticate('missing@example.com', password)).toBeNull()
  })
})

describe('sessions, origin and CSRF', () => {
  it('rejects foreign, same-site sibling, missing origin/metadata GET without setting cookie', async () => {
    for (const options of [{ origin: 'https://evil.example' }, { site: 'same-site' }, { origin: '' }, { origin: 'null' }]) {
      const result = await request('/auth/session', options)
      expect(result.response.status).toBe(403)
      expect(result.cookie).toBeUndefined()
    }
  })
  it('sets protected cookie, persists only hashed ID and does not slide expiry', async () => {
    const result = await anonymous()
    expect(result.body.user).toBeNull()
    expect(result.body.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const header = result.response.headers.get('set-cookie')!
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(header).toContain(flag)
    expect(header).not.toContain('Domain=')
    expect(result.response.headers.get('cache-control')).toBe('no-store')
    const raw = result.cookie!.split('=')[1]
    const session = store.session(raw)!
    expect(session.id_hash).not.toBe(raw)
    expect(session.expires_at).toBe(now + ANON_TTL)
    now += 1000
    const again = await request('/auth/session', { cookie: result.cookie })
    expect(again.cookie).toBeUndefined()
    expect(again.body.csrfToken).toBe(result.body.csrfToken)
    expect(store.session(raw)!.expires_at).toBe(session.expires_at)
  })
  it('permits browser same-origin bootstrap but not forged host or sibling referer', async () => {
    const rawGet = (headers: Record<string, string>) => new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(base + '/auth/session', { headers }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)) })
      req.on('error', reject)
      req.end()
    })
    expect(await rawGet({ Host: 'store.example', 'Sec-Fetch-Site': 'same-origin' })).toBe(200)
    expect(await rawGet({ Host: 'store.example', Referer: 'https://store.example/login' })).toBe(200)
    expect(await rawGet({ Host: 'evil.example', 'Sec-Fetch-Site': 'same-origin' })).toBe(403)
    expect(await rawGet({ Host: 'store.example', Referer: 'https://sibling.example/login' })).toBe(403)
  })
  it('all mutations reject absent/mismatched token, Origin and duplicate cookies', async () => {
    const a = await anonymous()
    const b = await anonymous()
    for (const route of ['/auth/login', '/auth/logout', '/orders/CS-2048/advance', '/reset-seed', '/future']) {
      for (const options of [post(a.cookie, ''), post(a.cookie, b.body.csrfToken), { ...post(a.cookie, a.body.csrfToken), origin: '' }, { ...post(a.cookie, a.body.csrfToken), origin: 'https://evil.example' }, post(`${a.cookie}; ${a.cookie}`, a.body.csrfToken), post(a.cookie, 'é'.repeat(43))]) {
        expect((await request(route, options)).response.status).toBe(403)
      }
    }
  })
  it('strict JSON rejects extra keys, arrays, malformed, oversized and media type', async () => {
    const a = await anonymous()
    for (const [body, status] of [['{"x":1}', 400], ['[]', 400], ['null', 400], ['{', 400], [JSON.stringify({ x: 'a'.repeat(5000) }), 413]] as const) {
      expect((await request('/auth/logout', post(a.cookie, a.body.csrfToken, body))).response.status).toBe(status)
    }
    expect((await request('/auth/logout', { ...post(a.cookie, a.body.csrfToken), contentType: 'text/plain' })).response.status).toBe(415)
    for (const body of [{ email: 'bad', password }, { email: 'demo@example.com', password: 'short' }, { email: 'demo@example.com', password, role: 'admin' }]) {
      expect((await request('/auth/login', post(a.cookie, a.body.csrfToken, JSON.stringify(body)))).response.status).toBe(400)
    }
  })
  it('public demo reads and CSRF-valid anonymous mutations do not require login', async () => {
    expect((await request('/products')).response.status).toBe(200)
    expect((await request('/orders/CS-2048')).response.status).toBe(200)
    const a = await anonymous()
    expect((await request('/orders/CS-2048/advance', post(a.cookie, a.body.csrfToken))).response.status).toBe(200)
    expect((await request('/reset-seed', post(a.cookie, a.body.csrfToken))).response.status).toBe(200)
  })
  it('login/logout rotate and revoke cookies/tokens, failures never authenticate', async () => {
    const a = await anonymous()
    const invalid = await request('/auth/login', post(a.cookie, a.body.csrfToken, JSON.stringify({ email: 'demo@example.com', password: 'invalid-password' })))
    const missing = await request('/auth/login', post(a.cookie, a.body.csrfToken, JSON.stringify({ email: 'none@example.com', password: 'invalid-password' })))
    expect(invalid.response.status).toBe(401)
    expect(missing.body).toEqual(invalid.body)
    expect(invalid.cookie).toBeUndefined()
    const login = await request('/auth/login', post(a.cookie, a.body.csrfToken, JSON.stringify({ email: ' DEMO@EXAMPLE.COM ', password })))
    expect(login.response.status).toBe(200)
    expect(login.body.user).toEqual({ authenticated: true })
    expect(login.cookie).not.toBe(a.cookie)
    expect(login.body.csrfToken).not.toBe(a.body.csrfToken)
    expect(store.session(a.cookie!.split('=')[1])).toBeUndefined()
    const raw = login.cookie!.split('=')[1]
    expect(store.session(raw)!.expires_at).toBe(now + AUTH_TTL)
    expect((await request('/auth/logout', post(a.cookie, a.body.csrfToken))).response.status).toBe(403)
    const logout = await request('/auth/logout', post(login.cookie, login.body.csrfToken))
    expect(logout.body.user).toBeNull()
    expect(logout.cookie).not.toBe(login.cookie)
    expect(logout.body.csrfToken).not.toBe(login.body.csrfToken)
    expect(store.session(raw)).toBeUndefined()
  })
  it('absolute expiration replaces old session and rejects its mutation', async () => {
    const a = await anonymous()
    now += ANON_TTL
    expect((await request('/auth/logout', post(a.cookie, a.body.csrfToken))).response.status).toBe(403)
    const replacement = await request('/auth/session', { cookie: a.cookie })
    expect(replacement.cookie).not.toBe(a.cookie)
    expect(replacement.body.csrfToken).not.toBe(a.body.csrfToken)
  })
  it('authenticated sessions expire absolutely and cannot be restored by GET', async () => {
    const a = store.rotate(undefined, 1)
    now += AUTH_TTL
    const result = await request('/auth/session', { cookie: `${config.cookieName}=${a.raw}` })
    expect(result.body.user).toBeNull()
    expect(store.session(a.raw)).toBeUndefined()
  })
  it('HTTP limiter returns generic 429 for known and unknown email', async () => {
    const a = await anonymous()
    for (let i = 0; i < 5; i++) expect(store.consumeAttempt('blocked@example.com', `unique-${i}`)).toBe(true)
    const result = await request('/auth/login', post(a.cookie, a.body.csrfToken, JSON.stringify({ email: 'blocked@example.com', password })))
    expect(result.response.status).toBe(429)
    expect(result.response.headers.get('retry-after')).toBe('900')
    expect(result.cookie).toBeUndefined()
    expect(JSON.stringify(result.body)).not.toContain('blocked@example.com')
  })
})

describe('persistent limits and invalidation', () => {
  it('normalizes email limit and preserves limit + session across restart', () => {
    const filename = path.join(tmp, 'restart.db')
    let isolated = new AuthStore(filename, () => now)
    const a = isolated.rotate(undefined)
    for (let i = 0; i < 5; i++) expect(isolated.consumeAttempt(' User@Example.com ', `ip-${i}`)).toBe(true)
    isolated.close()
    isolated = new AuthStore(filename, () => now)
    expect(isolated.session(a.raw)).toEqual(a.session)
    expect(isolated.consumeAttempt('user@example.com', 'new-ip')).toBe(false)
    now += RATE_WINDOW
    expect(isolated.consumeAttempt('user@example.com', 'new-ip')).toBe(true)
    isolated.close()
    expect(fs.statSync(filename).mode & 0o777).toBe(0o600)
  })
  it('IP limit cannot be bypassed by rotating email; anonymous sessions bounded', () => {
    const isolated = new AuthStore(':memory:', () => now)
    for (let i = 0; i < 30; i++) expect(isolated.consumeAttempt(`user${i}@example.com`, 'same-ip')).toBe(true)
    expect(isolated.consumeAttempt('another@example.com', 'same-ip')).toBe(false)
    for (let i = 0; i < 120; i++) expect(isolated.consumeAnonymous('same-ip')).toBe(true)
    expect(isolated.consumeAnonymous('same-ip')).toBe(false)
    now += RATE_WINDOW
    expect(isolated.consumeAnonymous('same-ip')).toBe(true)
    isolated.close()
  })
  it('changing password revokes sessions and refuses previous password', async () => {
    const isolated = new AuthStore(':memory:', () => now)
    await isolated.provision('user@example.com', password)
    const id = await isolated.authenticate('user@example.com', password)
    const a = isolated.rotate(undefined, id!)
    await isolated.provision('user@example.com', 'A-different-password-2026')
    expect(isolated.session(a.raw)).toBeUndefined()
    expect(await isolated.authenticate('user@example.com', password)).toBeNull()
    expect(await isolated.authenticate('user@example.com', 'A-different-password-2026')).toBe(id)
    isolated.close()
  })
  it('bounds concurrent expensive hashing', async () => {
    const isolated = new AuthStore(':memory:', () => now)
    const attempts = Array.from({ length: 5 }, () => isolated.authenticate('none@example.com', password))
    expect(await attempts[4]).toBeUndefined()
    expect((await Promise.all(attempts)).filter((value) => value === null)).toHaveLength(4)
    isolated.close()
  })
  it('Node24 provisioning CLI requires env secrets and sanitizes output', () => {
    const filename = path.join(tmp, 'provision.db')
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production', AUTH_ORIGIN: config.origin, AUTH_DB_PATH: filename }
    delete env.AUTH_USER_EMAIL
    delete env.AUTH_USER_PASSWORD
    const missing = spawnSync(process.execPath, ['src/server/provision.ts'], { env, encoding: 'utf8' })
    expect(missing.status).toBe(1)
    expect(missing.stderr).not.toContain('Error:')
    const output = execFileSync(process.execPath, ['src/server/provision.ts'], { env: { ...env, AUTH_USER_EMAIL: 'operator@example.com', AUTH_USER_PASSWORD: password }, encoding: 'utf8' })
    expect(output).toContain('Usuário provisionado')
    expect(output).not.toContain(password)
    expect(output).not.toContain('operator@example.com')
    const isolated = new AuthStore(filename)
    expect(isolated.db.prepare('SELECT count(*) AS total FROM auth_users').get()).toEqual({ total: 1 })
    isolated.close()
  })
})
