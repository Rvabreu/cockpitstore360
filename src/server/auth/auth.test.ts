// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import { once } from 'node:events'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadAuthConfig } from './config'
import { createAuthStore } from './db'
import { createAuthRouter } from './router'

const ORIGIN = 'https://store.example'
const EMAIL = 'cliente@example.com'
const PASSWORD = 'segredo-real-123!'
let directory: string
let dbPath: string
let clock: number
let store: ReturnType<typeof createAuthStore>
let server: Server
let url: string
let config: ReturnType<typeof loadAuthConfig>

async function listen() {
  const app = express()
  app.use('/api/auth', createAuthRouter({ config, store, now: () => clock }))
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`
}

async function stop() {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

type Session = { user: null | { id: string; email: string }; csrfToken: string }
class Browser {
  cookies = new Map<string, string>()
  token = ''
  header() { return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ') }
  async request(route: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers)
    if (!headers.has('Cookie')) headers.set('Cookie', this.header())
    const response = await fetch(url + route, { ...options, headers })
    expect(response.headers.get('cache-control')).toContain('no-store')
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';')
      const index = pair.indexOf('=')
      const name = pair.slice(0, index)
      const value = pair.slice(index + 1)
      if (value) this.cookies.set(name, value)
      else this.cookies.delete(name)
    }
    return response
  }
  async bootstrap() {
    const response = await this.request('/session')
    expect(response.status).toBe(200)
    const body = await response.json() as Session
    expect(body.csrfToken).toEqual(expect.any(String))
    expect(body.csrfToken.length).toBeGreaterThan(20)
    this.token = body.csrfToken
    return body
  }
  post(route: string, body: unknown = {}, headers: Record<string, string> = {}) {
    return this.request(route, {
      method: 'POST', body: JSON.stringify(body),
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'X-CSRF-Token': this.token, ...headers },
    })
  }
  async login() {
    const response = await this.post('/login', { email: EMAIL, password: PASSWORD })
    expect(response.status).toBe(200)
    const body = await response.json() as Session
    this.token = body.csrfToken
    expect(body.user).toEqual({ id: expect.any(String), email: EMAIL })
    return response
  }
}

beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'store-auth-'))
  dbPath = path.join(directory, 'auth.db')
  clock = Date.UTC(2026, 9, 28, 13)
  config = loadAuthConfig({ mode: 'production', env: { APP_ORIGIN: ORIGIN } })
  store = createAuthStore({ path: dbPath, now: () => clock })
  await listen()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await stop()
  store.close()
  fs.rmSync(directory, { recursive: true, force: true })
})

describe('Configuração e provisionamento seguros', () => {
  it.each([undefined, 'http://store.example', 'https://store.example/path', 'https://user:secret@store.example', 'https://store.example?x=1'])('produção rejeita origem não HTTPS/exata %s', (origin) => {
    expect(() => loadAuthConfig({ mode: 'production', env: origin === undefined ? {} : { APP_ORIGIN: origin } })).toThrow()
  })

  it('não cria conta padrão, hashes são salgados/não plaintext e duplicado não reseta senha', async () => {
    expect(store.db.prepare('SELECT count(*) AS count FROM users').get()).toEqual({ count: 0 })
    await store.provisionUser({ email: ' CLIENTE@EXAMPLE.COM ', password: PASSWORD })
    await store.provisionUser({ email: 'outro@example.com', password: PASSWORD })
    const rows = store.db.prepare('SELECT * FROM users ORDER BY email').all() as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0].email).toBe(EMAIL)
    expect(rows[0].salt).not.toEqual(rows[1].salt)
    expect(rows[0].hash).not.toEqual(rows[1].hash)
    for (const row of rows) expect(JSON.stringify(row)).not.toContain(PASSWORD)
    await expect(store.provisionUser({ email: EMAIL, password: 'outro-segredo-123' })).rejects.toThrow()
    const browser = new Browser()
    await browser.bootstrap()
    await browser.login()
    expect(fs.statSync(dbPath).mode & 0o777).toBe(0o600)
  })
})

describe('Sessões reais, cookies e revogação', () => {
  it('bootstrap/login usa cookies host-only HttpOnly Strict Secure e hashes server-side', async () => {
    await store.provisionUser({ email: EMAIL, password: PASSWORD })
    const browser = new Browser()
    expect((await browser.bootstrap()).user).toBeNull()
    const oldCookie = browser.header()
    const response = await browser.login()
    const cookies = response.headers.getSetCookie()
    expect(cookies.some((cookie) => cookie.startsWith('__Host-store_session='))).toBe(true)
    for (const cookie of cookies) {
      expect(cookie).toMatch(/; HttpOnly/i)
      expect(cookie).toMatch(/; SameSite=Strict/i)
      expect(cookie).toMatch(/; Secure/i)
      expect(cookie).toMatch(/; Path=\//i)
      expect(cookie).not.toMatch(/; Domain=/i)
    }
    expect(browser.header()).not.toBe(oldCookie)
    const row = store.db.prepare('SELECT * FROM sessions').get() as Record<string, unknown>
    expect(row.token_hash).toEqual(expect.any(String))
    expect(JSON.stringify(row)).not.toContain(browser.cookies.get(config.sessionCookieName))
    expect((await browser.bootstrap()).user?.email).toBe(EMAIL)
  })

  it('login rota e revoga cookies antigos; logout revoga replay e permite bootstrap anônimo novo', async () => {
    await store.provisionUser({ email: EMAIL, password: PASSWORD })
    const browser = new Browser()
    await browser.bootstrap()
    await browser.login()
    const stale = new Browser()
    stale.cookies = new Map(browser.cookies)
    stale.token = browser.token
    await browser.login()
    expect((await stale.bootstrap()).user).toBeNull()
    const replay = new Browser()
    replay.cookies = new Map(browser.cookies)
    replay.token = browser.token
    const logout = await browser.post('/logout')
    expect(logout.status).toBe(200)
    expect(await logout.json()).toEqual({ user: null })
    expect((await replay.bootstrap()).user).toBeNull()
    expect((await browser.bootstrap()).user).toBeNull()
    expect((await browser.post('/logout')).status).toBe(200)
  })

  it('sessão sobrevive reabrir SQLite, mas expira absolutamente após 8h com relógio injetado', async () => {
    await store.provisionUser({ email: EMAIL, password: PASSWORD })
    const browser = new Browser()
    await browser.bootstrap()
    await browser.login()
    await stop()
    store.close()
    store = createAuthStore({ path: dbPath, now: () => clock })
    await listen()
    clock += 7 * 60 * 60 * 1000
    expect((await browser.bootstrap()).user?.email).toBe(EMAIL)
    clock += 60 * 60 * 1000 + 1
    expect((await browser.bootstrap()).user).toBeNull()
  })

  it('cookie CSRF de outro browser não autentica sessão válida', async () => {
    await store.provisionUser({ email: EMAIL, password: PASSWORD })
    const browser = new Browser()
    await browser.bootstrap()
    await browser.login()
    const attacker = new Browser()
    await attacker.bootstrap()
    attacker.cookies.set(config.sessionCookieName, browser.cookies.get(config.sessionCookieName)!)
    expect((await attacker.bootstrap()).user).toBeNull()
  })
})

describe('Erros e defesas HTTP', () => {
  it('usuário inexistente e senha errada retornam o mesmo 401 genérico sem cookies de sessão', async () => {
    await store.provisionUser({ email: EMAIL, password: PASSWORD })
    const browser = new Browser()
    await browser.bootstrap()
    for (const email of ['inexistente@example.com', EMAIL]) {
      const response = await browser.post('/login', { email, password: 'errada' })
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'E-mail ou senha inválidos' })
      expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith(config.sessionCookieName + '='))).toBe(false)
    }
  })

  it.each<Record<string, string>>([
    { Origin: '' }, { Origin: 'https://evil.example' },
    { Origin: 'https://store.example.evil' }, { 'X-CSRF-Token': '' },
    { 'X-CSRF-Token': 'forged' },
    { Origin: 'https://evil.example', Host: 'store.example', 'X-Forwarded-Host': 'store.example', 'X-Forwarded-Proto': 'https' },
  ])('login e logout rejeitam origem/token ausente/inválido mesmo com host spoof %j', async (headers) => {
    const browser = new Browser()
    await browser.bootstrap()
    for (const route of ['/login', '/logout']) {
      const response = await browser.post(route, { email: EMAIL, password: PASSWORD }, headers)
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Requisição não autorizada' })
    }
  })

  it('token sem cookie ou bootstrap expirado não autoriza POST', async () => {
    const browser = new Browser()
    await browser.bootstrap()
    const noCookie = await browser.post('/login', { email: EMAIL, password: PASSWORD }, { Cookie: '' })
    expect(noCookie.status).toBe(403)
    clock += 60 * 60 * 1000 + 1
    expect((await browser.post('/logout')).status).toBe(403)
  })

  it.each<Record<string, string>>([{ 'Sec-Fetch-Site': 'cross-site' }, { Origin: 'https://evil.example' }])('bootstrap cross-site não emite cookie %j', async (headers) => {
    const response = await new Browser().request('/session', { headers })
    expect(response.status).toBe(403)
    expect(response.headers.getSetCookie()).toEqual([])
    expect(await response.json()).toEqual({ error: 'Requisição não autorizada' })
  })

  it('logout durante KDF revoga bootstrap e login atrasado não ressuscita sessão', async () => {
    const user = await store.provisionUser({ email: EMAIL, password: PASSWORD })
    const browser = new Browser()
    await browser.bootstrap()
    let finish!: (value: typeof user) => void
    let entered!: () => void
    const reachedKdf = new Promise<void>((done) => { entered = done })
    vi.spyOn(store, 'verifyCredentials').mockImplementation(() => {
      entered()
      return new Promise((done) => { finish = done })
    })
    const pending = browser.post('/login', { email: EMAIL, password: PASSWORD })
    await reachedKdf
    expect((await browser.post('/logout')).status).toBe(200)
    finish(user)
    const response = await pending
    expect(response.status).toBe(403)
    expect(response.headers.getSetCookie()).toEqual([])
    expect((await browser.bootstrap()).user).toBeNull()
    expect(store.db.prepare('SELECT count(*) AS count FROM sessions').get()).toEqual({ count: 0 })
  })

  it('limite IP30 não é burlado variando email nem X-Forwarded-For', async () => {
    vi.spyOn(store, 'verifyCredentials').mockResolvedValue(null)
    const browser = new Browser()
    await browser.bootstrap()
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await browser.post('/login', { email: `unknown${attempt}@example.com`, password: 'wrong' }, { 'X-Forwarded-For': `10.0.0.${attempt}` })
      expect(response.status).toBe(401)
    }
    const blocked = await browser.post('/login', { email: 'new@example.com', password: 'wrong' })
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBe('600')
    expect(store.verifyCredentials).toHaveBeenCalledTimes(30)
  })

  it('capacidade bootstrap10000 rejeita novos sem expulsar registros ativos', async () => {
    const insert = store.db.prepare('INSERT INTO csrf_bootstraps VALUES (?, ?)')
    store.db.transaction(() => {
      for (let index = 0; index < 10_000; index++) insert.run(`hash-${index}`, clock + 60_000)
    })()
    const response = await new Browser().request('/session')
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(response.headers.getSetCookie()).toEqual([])
    expect(store.db.prepare('SELECT count(*) AS count FROM csrf_bootstraps').get()).toEqual({ count: 10_000 })
  })

  it.each([
    { body: '{}', type: 'text/plain', status: 415, error: 'Formato da requisição não suportado' },
    { body: '{', type: 'application/json', status: 400, error: 'JSON inválido' },
    { body: JSON.stringify({ email: EMAIL, password: 'x'.repeat(5000) }), type: 'application/json', status: 413, error: 'Corpo da requisição muito grande' },
  ])('parser tem limite4KB/formato JSON e erro seguro $status', async ({ body, type, status, error }) => {
    const browser = new Browser()
    await browser.bootstrap()
    const response = await browser.request('/login', { method: 'POST', body, headers: { Origin: ORIGIN, 'X-CSRF-Token': browser.token, 'Content-Type': type } })
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error })
  })

  it.each([null, [], {}, { email: 12, password: PASSWORD }, { email: EMAIL, password: 12 }, { email: 'bad', password: PASSWORD }, { email: EMAIL, password: '' }, { email: EMAIL, password: 'x'.repeat(257) }])('campos/tipos inválidos retornam400 %j', async (body) => {
    const browser = new Browser()
    await browser.bootstrap()
    const response = await browser.post('/login', body)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Dados de acesso inválidos' })
  })

  it('limita5 tentativas por par IP/email, sucesso não limpa orçamento, janela expira e Retry-After é determinístico', async () => {
    await store.provisionUser({ email: EMAIL, password: PASSWORD })
    const browser = new Browser()
    await browser.bootstrap()
    for (let attempt = 0; attempt < 4; attempt++) {
      expect((await browser.post('/login', { email: EMAIL, password: 'errada' })).status).toBe(401)
    }
    await browser.login()
    const blocked = await browser.post('/login', { email: EMAIL, password: PASSWORD })
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toEqual({ error: 'Muitas tentativas. Tente novamente mais tarde.' })
    expect(Number(blocked.headers.get('retry-after'))).toBe(600)
    clock += 601_000
    await browser.login()
  })
})
