// @vitest-environment node
import express from 'express'
import type { Server } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createAuthStore } from './db'
import { loadAuthConfig } from './config'
import { createAuthRouter } from './router'
import type { CheckoutProduct } from '../../types/checkout'

const ORIGIN = 'http://localhost:5000'
const KEY = '11111111-1111-4111-8111-111111111111'
const REQUEST = { items: [{ productId: 'b', quantity: 2 }, { productId: 'a', quantity: 1 }], idempotencyKey: KEY }
let dir: string, path: string, store: ReturnType<typeof createAuthStore>, server: Server, base: string
let clock: number, cookie: string, token: string
let catalog: CheckoutProduct[]
const load = vi.fn<(ids: string[]) => CheckoutProduct[]>()
function jar(response: Response) { return response.headers.getSetCookie().map((v) => v.split(';')[0]).filter((v) => !v.endsWith('=')).join('; ') }
async function mount() {
  const app = express()
  app.use('/api/auth', createAuthRouter({ config: loadAuthConfig({ mode: 'development', env: { APP_ORIGIN: ORIGIN } }), store, now: () => clock, loadCheckoutProducts: load }))
  server = await new Promise<Server>((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('address')
  base = `http://127.0.0.1:${address.port}/api/auth`
}
async function signIn(email = 'qa@example.com') {
  const session = await fetch(`${base}/session`)
  const csrf = (await session.json()).csrfToken as string
  const anonymous = jar(session)
  const login = await fetch(`${base}/login`, { method: 'POST', headers: { Origin: ORIGIN, Cookie: anonymous, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'secure password-123' }) })
  expect(login.status).toBe(200)
  return { cookie: jar(login), token: (await login.json()).csrfToken as string }
}
async function post(body: unknown = REQUEST, headers: Record<string, string> = {}) {
  return fetch(`${base}/checkout`, { method: 'POST', headers: { Origin: ORIGIN, Cookie: cookie, 'X-CSRF-Token': token, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
}
function privateResponse(response: Response) {
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(response.headers.getSetCookie()).toEqual([])
}
function authRows() { return ['sessions', 'csrf_bootstraps', 'users'].map((table) => store.db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()) }
function receiptCount() { return (store.db.prepare('SELECT count(*) AS count FROM checkout_receipts').get() as { count: number }).count }
beforeEach(async () => {
  vi.restoreAllMocks(); load.mockReset()
  clock = Date.UTC(2026, 9, 29, 12)
  dir = mkdtempSync(join(tmpdir(), 'checkout-auth-')); path = join(dir, 'auth.sqlite')
  store = createAuthStore({ path, now: () => clock })
  catalog = [{ id: 'a', name: 'Produto A', price: 12.34 }, { id: 'b', name: 'Produto B', price: 0.29 }]
  load.mockImplementation((ids) => catalog.filter((p) => ids.includes(p.id)))
  await store.provisionUser({ email: 'qa@example.com', password: 'secure password-123' })
  await mount()
  ;({ cookie, token } = await signIn())
})
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  store.close(); rmSync(dir, { recursive: true, force: true }); vi.restoreAllMocks()
})

it.each<[Record<string, string>, number]>([
  [{ Cookie: '' }, 401], [{ Cookie: 'store_session=bad; store_csrf=bad' }, 401],
  [{ 'X-CSRF-Token': 'bad' }, 403], [{ Origin: 'https://evil.example' }, 403], [{ Origin: '' }, 403],
])('guard%s/%s antes catálogo não emite cookie nem escreve auth/recibo', async (headers, status) => {
  const before = authRows()
  const response = await post(REQUEST, headers)
  expect(response.status).toBe(status); privateResponse(response)
  expect(load).not.toHaveBeenCalled(); expect(authRows()).toEqual(before); expect(receiptCount()).toBe(0)
})

it('sessão expirada401 antes tracking sem mutar auth', async () => {
  clock += 9 * 60 * 60 * 1000
  const before = authRows()
  const response = await post()
  expect(response.status).toBe(401); privateResponse(response)
  expect(load).not.toHaveBeenCalled(); expect(authRows()).toEqual(before)
})

it.each([{ ...REQUEST, address: 'private' }, { ...REQUEST, items: [{ productId: 'a', quantity: 1, price: 1 }] }, { ...REQUEST, items: [{ productId: 'a', quantity: 0 }] }])('400strict%j antes loader sem recibo', async (body) => {
  const response = await post(body)
  expect(response.status).toBe(400); privateResponse(response)
  expect(await response.json()).toEqual({ error: 'Dados de checkout inválidos' })
  expect(load).not.toHaveBeenCalled(); expect(receiptCount()).toBe(0)
})

it('201recibo authoritative privado; replay200 original antes catálogo modificado/removido e conflito409', async () => {
  const before = authRows()
  const first = await post()
  expect(first.status).toBe(201); privateResponse(first)
  const receipt = (await first.json()).receipt
  expect(receipt).toMatchObject({ totalCents: 1292, paymentStatus: 'simulated', currency: 'BRL' })
  expect(receipt.items.map((item: { productId: string }) => item.productId)).toEqual(['a', 'b'])
  expect(authRows()).toEqual(before)
  catalog = []
  load.mockClear()
  const replay = await post({ ...REQUEST, items: [...REQUEST.items].reverse() })
  expect(replay.status).toBe(200); privateResponse(replay)
  expect(await replay.json()).toEqual({ receipt }); expect(load).not.toHaveBeenCalled()
  const conflict = await post({ ...REQUEST, items: [{ productId: 'a', quantity: 2 }] })
  expect(conflict.status).toBe(409); privateResponse(conflict)
  expect(receiptCount()).toBe(1); expect(load).not.toHaveBeenCalled()
})

it('dois POSTs simultâneos mesma key geram um recibo e único catálogo', async () => {
  const responses = await Promise.all([post(), post({ ...REQUEST, items: [...REQUEST.items].reverse() })])
  expect(responses.map((r) => r.status).sort()).toEqual([200, 201])
  expect(await responses[0].json()).toEqual(await responses[1].json())
  expect(receiptCount()).toBe(1); expect(load).toHaveBeenCalledTimes(1)
})

it('mesma key usuário diferente fica isolada e não vaza recibo', async () => {
  const first = (await (await post()).json()).receipt
  await store.provisionUser({ email: 'other@example.com', password: 'secure password-123' })
  ;({ cookie, token } = await signIn('other@example.com'))
  const second = await post()
  expect(second.status).toBe(201)
  expect((await second.json()).receipt.id).not.toBe(first.id)
  expect(receiptCount()).toBe(2)
})

it('reinício preserva replay mesmo catálogo removido', async () => {
  const receipt = (await (await post()).json()).receipt
  await new Promise<void>((resolve) => server.close(() => resolve()))
  store.close(); store = createAuthStore({ path, now: () => clock }); await mount()
  catalog = []; load.mockClear()
  const response = await post()
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ receipt })
  expect(load).not.toHaveBeenCalled()
})

it('produto ausente409 e preço corrupto500 revertem transação sem recibo', async () => {
  catalog = []
  const absent = await post()
  expect(absent.status).toBe(409); privateResponse(absent)
  catalog = [{ id: 'a', name: 'A', price: NaN }, { id: 'b', name: 'B', price: 1 }]
  const broken = await post()
  expect(broken.status).toBe(500); privateResponse(broken)
  expect(receiptCount()).toBe(0); expect(store.db.inTransaction).toBe(false)
})

it('capacidade10000 não impede replay e rejeita novo sem evicção/catálogo', async () => {
  const receipt = (await (await post()).json()).receipt
  const user = store.db.prepare('SELECT id FROM users WHERE email=?').get('qa@example.com') as { id: string }
  const insert = store.db.prepare('INSERT INTO checkout_receipts(id,user_id,idempotency_key,request_hash,receipt_json,created_at) VALUES(?,?,?,?,?,?)')
  store.db.transaction(() => { for (let i = 1; i < 10000; i++) insert.run(`receipt-${i}`, user.id, `key-${i}`, 'hash', JSON.stringify(receipt), clock) })()
  load.mockClear()
  const replay = await post()
  expect(replay.status).toBe(200); expect(await replay.json()).toEqual({ receipt })
  const fresh = await post({ ...REQUEST, idempotencyKey: '22222222-2222-4222-8222-222222222222' })
  expect(fresh.status).toBe(429); privateResponse(fresh)
  expect(Number(fresh.headers.get('retry-after'))).toBeGreaterThan(0)
  expect(load).not.toHaveBeenCalled(); expect(receiptCount()).toBe(10000)
})
