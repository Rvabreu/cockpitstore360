// @vitest-environment node
import express from 'express'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Server } from 'node:http'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createAuthRouter } from './router'
import { createAuthStore } from './db'
import { loadAuthConfig } from './config'
import * as passwords from './password'

const EMAIL = 'new@example.com'
const PASSWORD = 'strong password-123'
const ORIGIN = 'http://localhost:5173'
let store: ReturnType<typeof createAuthStore>
let server: Server | undefined
let directory: string
let base: string
let now: number
let cookie: string
let token: string
function jar(response: Response) {
  return response.headers.getSetCookie()
    .filter((value) => !/;\s*Max-Age=0(?:;|$)/i.test(value))
    .map((value) => value.split(';')[0])
    .filter((pair) => !pair.endsWith('='))
    .join('; ')
}
async function register(body: unknown = { email: EMAIL, password: PASSWORD }, headers: Record<string, string> = {}) {
  return fetch(`${base}/register`, { method: 'POST', headers: { Origin: ORIGIN, Cookie: cookie, 'X-CSRF-Token': token, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
}
function count() { return (store.db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count }
function privateResponse(response: Response) {
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(response.headers.getSetCookie()).toEqual([])
}
beforeEach(async () => {
  now = Date.UTC(2026, 9, 28)
  server = undefined
  directory = await mkdtemp(join(tmpdir(), 'registration-'))
  store = createAuthStore({ path: join(directory, 'auth.db'), now: () => now })
  const app = express()
  app.use('/api/auth', createAuthRouter({ config: loadAuthConfig({ mode: 'development', env: { APP_ORIGIN: ORIGIN } }), store, now: () => now }))
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server!.once('listening', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Sem porta')
  base = `http://127.0.0.1:${address.port}/api/auth`
  const response = await fetch(`${base}/session`)
  cookie = jar(response)
  token = (await response.json()).csrfToken
})
afterEach(async () => {
  vi.restoreAllMocks()
  try { if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())) }
  finally { store?.close(); if (directory) await rm(directory, { recursive: true, force: true }) }
})

it('cadastro201 salva usuário normalizado com hash, permanece anônimo e permite login posterior', async () => {
  const response = await register({ email: ' NEW@Example.com ', password: PASSWORD })
  expect(response.status).toBe(201)
  expect(await response.json()).toEqual({ created: true })
  privateResponse(response)
  expect(count()).toBe(1)
  const row = store.db.prepare('SELECT * FROM users').get() as Record<string, unknown>
  expect(row.email).toBe(EMAIL)
  expect(JSON.stringify(row)).not.toContain(PASSWORD)
  expect(await store.verifyCredentials(EMAIL, PASSWORD)).not.toBeNull()
  expect((store.db.prepare('SELECT COUNT(*) AS count FROM sessions').get() as { count: number }).count).toBe(0)
  const session = await fetch(`${base}/session`, { headers: { Cookie: cookie } })
  expect((await session.json()).user).toBeNull()
  const login = await fetch(`${base}/login`, { method: 'POST', headers: { Origin: ORIGIN, Cookie: cookie, 'X-CSRF-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })
  expect(login.status).toBe(200)
  expect((await login.json()).user.email).toBe(EMAIL)
})

it('duplicado normalizado409 não muda senha ou dados existentes', async () => {
  await store.provisionUser({ email: EMAIL, password: PASSWORD })
  const previous = store.db.prepare('SELECT * FROM users').all()
  const response = await register({ email: ' NEW@example.COM ', password: 'another password-123' })
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ error: 'Não foi possível cadastrar com os dados informados' })
  privateResponse(response)
  expect(store.db.prepare('SELECT * FROM users').all()).toEqual(previous)
})

it.each([null, [], {}, { email: 3, password: PASSWORD }, { email: 'bad', password: PASSWORD }, { email: EMAIL, password: 1 }, { email: EMAIL, password: 'x'.repeat(11) }, { email: EMAIL, password: 'x'.repeat(129) }])('JSON/campos inválidos%j400 contextual sem criar conta', async (body) => {
  const response = await register(body)
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: 'Dados de cadastro inválidos' })
  privateResponse(response)
  expect(count()).toBe(0)
})

it.each([12, 128])('senha limite%s aceita sem impor regra extra', async (length) => {
  const response = await register({ email: EMAIL, password: 'x'.repeat(length) })
  expect(response.status).toBe(201)
  privateResponse(response)
})

it.each<Record<string, string>>([{ Origin: '' }, { Origin: 'https://evil.example' }, { 'X-CSRF-Token': '' }, { 'X-CSRF-Token': 'wrong' }, { Cookie: '' }, { Cookie: 'store_session=malformed' }])('Origin/CSRF/cookie inválidos403%j sem usuário', async (headers) => {
  const response = await register(undefined, headers)
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ error: 'Requisição não autorizada' })
  privateResponse(response)
  expect(count()).toBe(0)
})

it('duas requisições normalizadas concorrentes criam uma conta sem substituir hash', async () => {
  const responses = await Promise.all([register(), register({ email: ' NEW@EXAMPLE.COM ', password: PASSWORD })])
  expect(responses.map((response) => response.status).sort()).toEqual([201, 409])
  responses.forEach(privateResponse)
  expect(count()).toBe(1)
  expect(await store.verifyCredentials(EMAIL, PASSWORD)).not.toBeNull()
})

it.each(['expired', 'revoked'] as const)('contexto%s durante KDF impede insert atômico', async (kind) => {
  const hash = await passwords.hashPassword(PASSWORD)
  let release!: (value: typeof hash) => void
  const pending = new Promise<typeof hash>((resolve) => { release = resolve })
  const spy = vi.spyOn(passwords, 'hashPassword').mockReturnValueOnce(pending)
  const responsePromise = register()
  await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
  if (kind === 'expired') now += 60 * 60 * 1000
  else store.db.prepare('DELETE FROM csrf_bootstraps').run()
  release(hash)
  const response = await responsePromise
  expect(response.status).toBe(403)
  privateResponse(response)
  expect(count()).toBe(0)
})

it('limite de tentativas retorna429/RetryAfter sem reset pelo sucesso', async () => {
  const first = await register()
  expect(first.status).toBe(201)
  for (let index = 0; index < 4; index++) expect((await register()).status).toBe(409)
  const limited = await register()
  expect(limited.status).toBe(429)
  expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
  privateResponse(limited)
  expect(count()).toBe(1)
})

it('capacidade10000 rejeita nova conta sem remover ou sobrescrever usuários', async () => {
  const insert = store.db.prepare('INSERT INTO users(id,email,salt,hash) VALUES(?,?,?,?)')
  store.db.transaction(() => {
    for (let index = 0; index < 10000; index++) insert.run(`user-${index}`, `user${index}@example.com`, '00'.repeat(16), '00'.repeat(64))
  })()
  const first = store.db.prepare('SELECT * FROM users WHERE id=?').get('user-0')
  const response = await register()
  expect(response.status).toBe(429)
  privateResponse(response)
  expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
  expect(count()).toBe(10000)
  expect(store.db.prepare('SELECT * FROM users WHERE id=?').get('user-0')).toEqual(first)
})

it.each(['store_session=', 'store_session=bad', 'store_session=first; store_session=second'])('qualquer cookie sessão%s bloqueia antes KDF mesmo com CSRF válido', async (session) => {
  const spy = vi.spyOn(passwords, 'hashPassword')
  const response = await register(undefined, { Cookie: `${cookie}; ${session}` })
  expect(response.status).toBe(403)
  privateResponse(response)
  expect(spy).not.toHaveBeenCalled()
  expect(count()).toBe(0)
})

it('login vinculado durante KDF invalida cadastro sem inserir usuário novo', async () => {
  const user = await store.provisionUser({ email: 'existing@example.com', password: PASSWORD })
  const hash = await passwords.hashPassword(PASSWORD)
  let release!: (value: typeof hash) => void
  const spy = vi.spyOn(passwords, 'hashPassword').mockReturnValueOnce(new Promise<typeof hash>((resolve) => { release = resolve }))
  const responsePromise = register()
  await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
  const csrfCookie = cookie.split('; ').find((item) => item.startsWith('store_csrf='))!.slice('store_csrf='.length)
  expect(store.rotate(user, undefined, csrfCookie)).not.toBeNull()
  release(hash)
  const response = await responsePromise
  expect(response.status).toBe(403)
  privateResponse(response)
  expect(count()).toBe(1)
  expect(store.db.prepare('SELECT id FROM users WHERE email=?').get(EMAIL)).toBeUndefined()
})

it.each([['{', 400], [JSON.stringify({ email: EMAIL, password: 'x'.repeat(5000) }), 413]] as const)('parser JSON mantém erro%s/%s privado sem inserir', async (body, status) => {
  const response = await fetch(`${base}/register`, { method: 'POST', headers: { Origin: ORIGIN, Cookie: cookie, 'X-CSRF-Token': token, 'Content-Type': 'application/json' }, body })
  expect(response.status).toBe(status)
  privateResponse(response)
  expect((await response.json()).error).toBeTruthy()
  expect(count()).toBe(0)
})
