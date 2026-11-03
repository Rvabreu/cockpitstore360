// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import { AuthStore, authConfig, RATE_WINDOW, verifyPassword } from './auth.ts'
import { OTP_TTL, OtpError, OtpService } from './otp.ts'

const demo = { NODE_ENV: 'development' }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'otp-auth-'))
let store: AuthStore, otp: OtpService, now: number
beforeEach(() => { now = 1793300000000; store = new AuthStore(':memory:', () => now); otp = new OtpService(store, { env: demo }) })
afterEach(() => store.close())
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))
const email = 'vip@example.com'
const wrong = (code: string) => code === '000000' ? '000001' : '000000'
const flow = () => {
  const session = store.rotate(undefined)
  return { ...session, challenge: otp.request(email, session.session, 'ip') }
}
function failure(fn: () => unknown, status: number) {
  try { fn(); throw new Error('Expected OTP rejection') } catch (err) { expect(err).toBeInstanceOf(OtpError); expect((err as OtpError).status).toBe(status); return err as OtpError }
}

describe('OTP persistence, identity and atomic sessions', () => {
  it('generates six cryptographically random digits with keyed hash and five-minute expiry', () => {
    const f = flow()
    expect(f.challenge).toEqual({ expiresAt: now + OTP_TTL, demo: true, demoCode: expect.stringMatching(/^\d{6}$/) })
    const row = store.db.prepare('SELECT * FROM auth_otp_challenges').get() as Record<string, string>
    expect(row.code_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(row.nonce).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(row)).not.toContain(email)
    expect(row.code_hash).not.toBe(f.challenge.demoCode)
    const key = store.db.prepare('SELECT value FROM auth_otp_settings').get() as { value: string }
    expect(key.value).toMatch(/^[a-f0-9]{64}$/)
  })
  it('creates only demo OTP identity, invalid password, rotates cookie/CSRF and consumes once', async () => {
    const f = flow()
    const logged = otp.verify(' VIP@EXAMPLE.COM ', f.challenge.demoCode, f.session, 'ip')
    expect(logged.session.user_id).not.toBeNull()
    expect(logged.raw).not.toBe(f.raw)
    expect(logged.session.csrf).not.toBe(f.session.csrf)
    expect(store.session(f.raw)).toBeUndefined()
    expect(store.session(logged.raw)).toEqual(logged.session)
    expect(store.db.prepare('SELECT * FROM auth_otp_challenges').all()).toHaveLength(0)
    expect(store.db.prepare('SELECT provider FROM auth_identities').get()).toEqual({ provider: 'otp' })
    expect(store.db.prepare('SELECT delivery FROM auth_otp_provenance').get()).toEqual({ delivery: 'demo' })
    const user = store.db.prepare('SELECT password_hash FROM auth_users').get() as { password_hash: string }
    expect(await verifyPassword('password-of-at-least-12', user.password_hash)).toBe(false)
    failure(() => otp.verify(email, f.challenge.demoCode, f.session, 'ip'), 401)
    await expect(store.provision(email, 'valid-password-123')).rejects.toThrow()
  })
  it('allows a later code to log into the same demo OTP identity', () => {
    const f = flow(); const first = otp.verify(email, f.challenge.demoCode, f.session, 'ip')
    const second = flow(); const logged = otp.verify(email, second.challenge.demoCode, second.session, 'ip')
    expect(logged.session.user_id).toBe(first.session.user_id)
    expect(store.db.prepare('SELECT * FROM auth_users').all()).toHaveLength(1)
  })
  it('rolls back consumption/account creation if session rotation cannot commit', () => {
    const f = flow()
    const rotate = vi.spyOn(store, 'rotate').mockImplementation(() => { throw new Error('storage failure') })
    expect(() => otp.verify(email, f.challenge.demoCode, f.session, 'ip')).toThrow('storage failure')
    expect(store.db.prepare('SELECT * FROM auth_users').all()).toHaveLength(0)
    expect(store.db.prepare('SELECT attempts FROM auth_otp_challenges').get()).toEqual({ attempts: 0 })
    expect(store.session(f.raw)).toEqual(f.session)
    rotate.mockRestore()
    expect(otp.verify(email, f.challenge.demoCode, f.session, 'ip').session.user_id).not.toBeNull()
  })
  it('refuses demo access to a matching OTP identity whose provenance is real delivery', () => {
    const f = flow(); otp.verify(email, f.challenge.demoCode, f.session, 'ip')
    store.db.prepare("UPDATE auth_otp_provenance SET delivery='smtp'").run()
    const second = flow()
    failure(() => otp.verify(email, second.challenge.demoCode, second.session, 'ip'), 401)
    expect(store.session(second.raw)?.user_id).toBeNull()
  })
  it('rejects exactly at expiry without creating a user', () => {
    const f = flow(); now += OTP_TTL
    failure(() => otp.verify(email, f.challenge.demoCode, f.session, 'ip'), 401)
    expect(store.db.prepare('SELECT * FROM auth_users').all()).toHaveLength(0)
  })
  it('binds email and challenge to the initiating live session', () => {
    const f = flow(); const thief = store.rotate(undefined)
    failure(() => otp.verify(email, f.challenge.demoCode, thief.session, 'other-ip'), 401)
    failure(() => otp.verify('other@example.com', f.challenge.demoCode, f.session, 'ip'), 401)
    expect(otp.verify(email, f.challenge.demoCode, f.session, 'ip').session.user_id).not.toBeNull()
  })
  it('cannot revive a challenge after logout or session expiry', () => {
    const f = flow(); store.rotate(f.session)
    failure(() => otp.verify(email, f.challenge.demoCode, f.session, 'ip'), 401)
    const next = flow(); now += 60 * 60 * 1000
    failure(() => otp.verify(email, next.challenge.demoCode, next.session, 'ip'), 401)
  })
  it('resend replaces earlier challenges even across browsers without resetting verification budget', () => {
    const f = flow()
    for (let i = 0; i < 4; i++) failure(() => otp.verify(email, wrong(f.challenge.demoCode), f.session, 'ip'), 401)
    const second = flow()
    expect(second.challenge.demoCode).not.toBe(f.challenge.demoCode)
    expect(store.db.prepare('SELECT session_hash FROM auth_otp_challenges').all()).toEqual([{ session_hash: second.session.id_hash }])
    failure(() => otp.verify(email, f.challenge.demoCode, f.session, 'ip'), 401)
    failure(() => otp.verify(email, second.challenge.demoCode, second.session, 'ip'), 429)
  })
  it('resend in the same session invalidates the previous code', () => {
    const f = flow(); const next = otp.request(email, f.session, 'ip')
    expect(next.demoCode).not.toBe(f.challenge.demoCode)
    failure(() => otp.verify(email, f.challenge.demoCode, f.session, 'ip'), 401)
    expect(otp.verify(email, next.demoCode, f.session, 'ip').session.user_id).not.toBeNull()
  })
  it('accepts a correct fifth attempt but blocks a sixth after five failures', () => {
    const f = flow()
    for (let i = 0; i < 4; i++) failure(() => otp.verify(email, wrong(f.challenge.demoCode), f.session, 'ip'), 401)
    expect(otp.verify(email, f.challenge.demoCode, f.session, 'ip').session.user_id).not.toBeNull()
    const other = store.rotate(undefined)
    const challenge = otp.request('five@example.com', other.session, 'other-ip')
    for (let i = 0; i < 5; i++) failure(() => otp.verify('five@example.com', wrong(challenge.demoCode), other.session, 'other-ip'), 401)
    expect(store.db.prepare('SELECT attempts FROM auth_otp_challenges').get()).toEqual({ attempts: 5 })
    failure(() => otp.verify('five@example.com', challenge.demoCode, other.session, 'other-ip'), 429)
  })
  it.each(['local', 'google', 'real-otp', 'unknown-otp'])('refuses %s collisions without enumeration or conversion', (kind) => {
    store.db.prepare('INSERT INTO auth_users VALUES (1,?,?)').run(email, kind === 'local' ? 'local-hash' : '!otp-demo-only!')
    if (kind !== 'local') store.db.prepare('INSERT INTO auth_identities VALUES (?,?,1)').run(kind === 'google' ? 'google' : 'otp', 'subject')
    if (kind === 'real-otp') store.db.prepare("INSERT INTO auth_otp_provenance VALUES (1,'smtp')").run()
    const before = store.db.prepare('SELECT * FROM auth_users').all()
    const f = flow(); const unknown = store.rotate(undefined)
    const absentError = failure(() => otp.verify('absent@example.com', '123456', unknown.session, 'other-ip'), 401)
    const collisionError = failure(() => otp.verify(email, f.challenge.demoCode, f.session, 'ip'), 401)
    expect(collisionError.message).toBe(absentError.message)
    expect(store.db.prepare('SELECT * FROM auth_users').all()).toEqual(before)
    expect(store.session(f.raw)?.user_id).toBeNull()
    expect(store.db.prepare('SELECT * FROM auth_otp_challenges').all()).toHaveLength(0)
  })
  it('persists key/challenge/rates across reopening the database', () => {
    const filename = path.join(tmp, 'persist.db')
    const first = new AuthStore(filename, () => now)
    const service = new OtpService(first, { env: demo }); const session = first.rotate(undefined)
    const challenge = service.request(email, session.session, 'ip')
    for (let i = 0; i < 4; i++) failure(() => service.verify(email, wrong(challenge.demoCode), session.session, 'ip'), 401)
    first.close()
    const reopened = new AuthStore(filename, () => now)
    try { expect(new OtpService(reopened, { env: demo }).verify(email, challenge.demoCode, session.session, 'ip').session.user_id).not.toBeNull() } finally { reopened.close() }
  })
  it('limits request per normalized email independently from verify/password/Google', () => {
    const f = flow()
    for (let i = 1; i < 5; i++) otp.request(' VIP@EXAMPLE.COM ', f.session, `ip-${i}`)
    const err = failure(() => otp.request(email, f.session, 'new-ip'), 429)
    expect(err.retryAfter).toBe(900)
    expect(store.consumeAttempt(email, 'ip')).toBe(true)
    expect(store.consumeGoogleAttempt('start', 'ip')).toBe(true)
    const current = otp.request('different@example.com', f.session, 'ip')
    expect(otp.verify('different@example.com', current.demoCode, f.session, 'ip').session.user_id).not.toBeNull()
    now += RATE_WINDOW
    expect(otp.request(email, store.rotate(undefined).session, 'new-ip').demo).toBe(true)
  })
  it.each(['request', 'verify'] as const)('limits %s by IP across distinct emails and never trusts client IP headers', (kind) => {
    const session = store.rotate(undefined).session
    for (let i = 0; i < 30; i++) {
      if (kind === 'request') otp.request(`vip${i}@example.com`, session, 'same-ip')
      else failure(() => otp.verify(`vip${i}@example.com`, '123456', session, 'same-ip'), 401)
    }
    failure(() => kind === 'request' ? otp.request(email, session, 'same-ip') : otp.verify(email, '123456', session, 'same-ip'), 429)
  })
  it('fails closed in production and enables preview only in development or exact opt-in', () => {
    const session = store.rotate(undefined).session
    for (const env of [{}, { NODE_ENV: 'test' }, { NODE_ENV: 'production' }, { NODE_ENV: 'production', AUTH_OTP_DEMO_PREVIEW: 'TRUE' }, { NODE_ENV: 'production', AUTH_OTP_SMTP_HOST: 'smtp.example.com' }]) {
      const service = new OtpService(store, { env })
      failure(() => service.request(email, session, 'ip'), 503)
      failure(() => service.verify(email, '123456', session, 'ip'), 503)
    }
    expect(store.db.prepare('SELECT * FROM auth_otp_challenges').all()).toHaveLength(0)
    expect(store.db.prepare('SELECT * FROM auth_limits').all()).toHaveLength(0)
    const optIn = new OtpService(store, { env: { NODE_ENV: 'production', AUTH_OTP_DEMO_PREVIEW: 'true' } })
    expect(optIn.request(email, session, 'ip').demo).toBe(true)
  })
})

describe('OTP HTTP contract and mutation security', () => {
  let server: Server, base: string
  const config = authConfig({ NODE_ENV: 'production', AUTH_ORIGIN: 'https://store.example' })
  beforeAll(() => { process.env.STORE_DB_PATH = path.join(tmp, 'store.db') })
  beforeEach(async () => {
    const { createApiApp } = await import('./index.ts')
    server = createApiApp({ store, config, otp: { env: demo } }).listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
  })
  afterEach(async () => { await new Promise<void>((resolve) => server.close(() => resolve())) })
  afterAll(() => { delete process.env.STORE_DB_PATH })
  async function anon() {
    const response = await fetch(`${base}/auth/session`, { headers: { Origin: config.origin } })
    return { cookie: response.headers.getSetCookie()[0].split(';')[0], csrf: (await response.json()).csrfToken as string }
  }
  function post(route: string, body: unknown, session: { cookie: string; csrf: string }, headers: Record<string, string> = {}) {
    return fetch(`${base}/auth/otp/${route}`, { method: 'POST', headers: { Origin: config.origin, Cookie: session.cookie, 'X-CSRF-Token': session.csrf, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  }
  it('returns exact request/session responses and rotates secure HttpOnly session cookie', async () => {
    const session = await anon()
    const requested = await post('request', { email }, session)
    expect(requested.status).toBe(200)
    expect(requested.headers.get('cache-control')).toBe('no-store')
    const body = await requested.json()
    expect(body).toEqual({ expiresAt: now + OTP_TTL, demo: true, demoCode: expect.stringMatching(/^\d{6}$/) })
    const verified = await post('verify', { email, code: body.demoCode }, session)
    expect(verified.status).toBe(200)
    const auth = await verified.json()
    expect(auth).toEqual({ user: { authenticated: true }, csrfToken: expect.any(String) })
    expect(auth.csrfToken).not.toBe(session.csrf)
    const cookie = verified.headers.getSetCookie()[0]
    expect(cookie).toContain('__Host-cockpit-session='); expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Secure'); expect(cookie).toContain('SameSite=Lax')
    expect((await post('verify', { email, code: body.demoCode }, session)).status).toBe(403)
  })
  it('requires exact JSON, valid email and six-digit string codes', async () => {
    const session = await anon()
    for (const body of [{}, { email, extra: true }, { email: 1 }, { email: 'bad' }, [], null]) expect((await post('request', body, session)).status).toBe(400)
    for (const body of [{ email }, { email, code: 123456 }, { email, code: '12345' }, { email, code: '123456', extra: 1 }, { email, code: '１２３４５６' }]) expect((await post('verify', body, session)).status).toBe(400)
    expect(store.db.prepare('SELECT * FROM auth_otp_challenges').all()).toHaveLength(0)
  })
  it('protects both endpoints against wrong/missing Origin, CSRF and fetch metadata', async () => {
    const session = await anon()
    for (const endpoint of ['request', 'verify']) {
      const body = endpoint === 'request' ? { email } : { email, code: '123456' }
      const invalidHeaders: Record<string, string>[] = [{ Origin: 'https://evil.example' }, { Origin: '' }, { 'X-CSRF-Token': '' }, { Cookie: '' }, { 'Sec-Fetch-Site': 'cross-site' }]
      for (const headers of invalidHeaders) {
        expect((await post(endpoint, body, session, headers)).status).toBe(403)
      }
    }
    expect(store.db.prepare("SELECT * FROM auth_limits WHERE key LIKE 'otp:%'").all()).toHaveLength(0)
  })
  it('reports generic 401/429 with Retry-After and counts socket IP, not forwarded IP', async () => {
    const session = await anon()
    const first = await post('request', { email }, session); const code = (await first.json()).demoCode
    for (let i = 0; i < 5; i++) expect((await post('verify', { email, code: wrong(code) }, session, { 'X-Forwarded-For': `198.51.100.${i}` })).status).toBe(401)
    const blocked = await post('verify', { email, code }, session)
    expect(blocked.status).toBe(429); expect(blocked.headers.get('retry-after')).toBe('900')
    for (let i = 1; i < 5; i++) await post('request', { email }, session)
    const resend = await post('request', { email }, session)
    expect(resend.status).toBe(429); expect(resend.headers.get('retry-after')).toBe('900')
  })
  it('returns 503 without preview/challenge in production even for configured SMTP variables', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    const { createApiApp } = await import('./index.ts')
    server = createApiApp({ store, config, otp: { env: { NODE_ENV: 'production', AUTH_OTP_SMTP_HOST: 'smtp.example.com' } } }).listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
    const session = await anon()
    for (const endpoint of ['request', 'verify']) {
      const response = await post(endpoint, endpoint === 'request' ? { email } : { email, code: '123456' }, session)
      expect(response.status).toBe(503)
      expect(Object.keys(await response.json())).toEqual(['error'])
    }
    expect(store.db.prepare('SELECT * FROM auth_otp_challenges').all()).toHaveLength(0)
  })
})
