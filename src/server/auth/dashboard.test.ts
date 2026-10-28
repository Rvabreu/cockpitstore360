// @vitest-environment node
import express from 'express'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Server } from 'node:http'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createAuthRouter } from './router'
import { loadAuthConfig } from './config'
import { createAuthStore } from './db'
import { buildDashboard } from '../dashboard'

let store: ReturnType<typeof createAuthStore>
let server: Server
let directory: string
let base: string
let now: number
let cookies: string
let loader: ReturnType<typeof vi.fn>
const origin = 'http://localhost:5173'

async function request(cookie = cookies, extra: Record<string, string> = {}) {
  return fetch(`${base}/dashboard`, { headers: { ...(cookie ? { Cookie: cookie } : {}), ...extra } })
}
function cookieHeader(response: Response) {
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
}
function changes() { return store.db.prepare('SELECT total_changes() AS count').get() }
function privateResponse(response: Response) {
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(response.headers.getSetCookie()).toEqual([])
}

beforeEach(async () => {
  now = Date.UTC(2026, 9, 28)
  directory = await mkdtemp(join(tmpdir(), 'dashboard-auth-'))
  store = createAuthStore({ path: join(directory, 'auth.db'), now: () => now })
  await store.provisionUser({ email: 'qa@example.com', password: 'correct-secure-password' })
  loader = vi.fn(() => buildDashboard({ orders: [], products: [] }))
  const app = express()
  app.use('/api/auth', createAuthRouter({ config: loadAuthConfig({ mode: 'development', env: { APP_ORIGIN: origin } }), store, now: () => now, loadDashboard: loader }))
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Porta indisponível')
  base = `http://127.0.0.1:${address.port}/api/auth`
  const bootstrap = await fetch(`${base}/session`)
  const token = (await bootstrap.json()).csrfToken
  const login = await fetch(`${base}/login`, { method: 'POST', headers: { Origin: origin, Cookie: cookieHeader(bootstrap), 'X-CSRF-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qa@example.com', password: 'correct-secure-password' }) })
  expect(login.status).toBe(200)
  cookies = cookieHeader(login)
})

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  store.close()
  await rm(directory, { recursive: true, force: true })
})

it('sessão vinculada retorna snapshot confirmado200 sem cookie ou escrita auth', async () => {
  const previous = changes()
  const response = await request()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(buildDashboard({ orders: [], products: [] }))
  privateResponse(response)
  expect(changes()).toEqual(previous)
  expect(loader).toHaveBeenCalledTimes(1)
})

it.each(['missing', 'session-only', 'csrf-only', 'mismatch', 'duplicate', 'expired'] as const)('cookies%s retornam401 antes consultar tracking sem writes/cleanup', async (kind) => {
  const pairs = cookies.split('; ')
  let cookie = cookies
  if (kind === 'missing') cookie = ''
  if (kind === 'session-only') cookie = pairs[0]
  if (kind === 'csrf-only') cookie = pairs[1]
  if (kind === 'mismatch') cookie = `${pairs[0]}; ${pairs[1].split('=')[0]}=other-token`
  if (kind === 'duplicate') cookie = `${cookies}; ${pairs[0]}`
  if (kind === 'expired') now += 8 * 60 * 60 * 1000
  const previous = changes()
  const response = await request(cookie)
  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({ error: 'Sessão não autenticada' })
  privateResponse(response)
  expect(changes()).toEqual(previous)
  expect(loader).not.toHaveBeenCalled()
})

it.each<Record<string, string>>([{ 'Sec-Fetch-Site': 'cross-site' }, { Origin: 'https://evil.example' }])('cross-site/origin incorreto403 antes tracking e sem auth writes', async (headers) => {
  const previous = changes()
  const response = await request(cookies, headers)
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ error: 'Requisição não autorizada' })
  privateResponse(response)
  expect(changes()).toEqual(previous)
  expect(loader).not.toHaveBeenCalled()
})

it('falha tracking devolve500 genérico privado sem tocar sessão', async () => {
  loader.mockImplementationOnce(() => { throw new Error('SQL private failure') })
  const previous = changes()
  const response = await request()
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: 'Erro interno no servidor' })
  privateResponse(response)
  expect(changes()).toEqual(previous)
})
