import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createAuthService, AuthError } from './authService'
import { loadCheckoutCatalog, isCheckoutReceipt } from './checkoutService'

const KEY = '11111111-1111-4111-8111-111111111111'
const REQUEST = { items: [{ productId: 'a', quantity: 2 }], idempotencyKey: KEY }
const RECEIPT = { id: '22222222-2222-4222-8222-222222222222', items: [{ productId: 'a', name: 'Produto A', quantity: 2, unitPriceCents: 1234, lineTotalCents: 2468 }], totalCents: 2468, currency: 'BRL', paymentStatus: 'simulated', createdAt: '2026-10-29T12:00:00.000Z' }
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => vi.unstubAllGlobals())

it.each([200, 201])('checkout%s JSON exato com cookie/CSRF sem reset/autologin/storage/log', async (status) => {
  const get = vi.spyOn(Storage.prototype, 'getItem'); const set = vi.spyOn(Storage.prototype, 'setItem')
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: { id: 'user', email: 'qa@example.com' }, csrfToken: 'token' }))
    .mockResolvedValueOnce(json({ receipt: RECEIPT }, status)).mockResolvedValueOnce(json({ receipt: RECEIPT }, 200))
  const auth = createAuthService(); await auth.bootstrap()
  await expect(auth.checkout(REQUEST)).resolves.toEqual({ receipt: RECEIPT })
  const [url, options] = vi.mocked(fetch).mock.calls[1]
  expect(url).toBe('/api/auth/checkout')
  expect(options).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' })
  expect(new Headers(options?.headers).get('Content-Type')).toBe('application/json')
  expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('token')
  expect(JSON.parse(options?.body as string)).toEqual(REQUEST)
  await auth.checkout(REQUEST)
  expect(new Headers(vi.mocked(fetch).mock.calls[2][1]?.headers).get('X-CSRF-Token')).toBe('token')
  expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled()
})

it.each([null, { ...RECEIPT, totalCents: 1 }, { ...RECEIPT, paymentStatus: 'paid' }, { ...RECEIPT, items: [{ ...RECEIPT.items[0], lineTotalCents: 1 }] }, { ...RECEIPT, createdAt: '2026-02-30' }])('guard rejeita recibo inválido%j inclusive200 sem fallback', async (receipt) => {
  expect(isCheckoutReceipt(receipt)).toBe(false)
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'token' })).mockResolvedValueOnce(json({ receipt }))
  const auth = createAuthService(); await auth.bootstrap()
  await expect(auth.checkout(REQUEST)).rejects.toBeInstanceOf(AuthError)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('403 reconcilia snapshot sem POST automático e próxima tentativa manual usa token novo', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: { id: 'a', email: 'a@example.com' }, csrfToken: 'old' }))
    .mockResolvedValueOnce(json({ error: 'private' }, 403)).mockResolvedValueOnce(json({ user: null, csrfToken: 'new' }))
    .mockResolvedValueOnce(json({ receipt: RECEIPT }, 201))
  const auth = createAuthService(); await auth.bootstrap()
  await expect(auth.checkout(REQUEST)).rejects.toMatchObject({ status: 403, recoveredSession: { user: null, csrfToken: 'new' } })
  expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/auth/session', '/api/auth/checkout', '/api/auth/session'])
  await auth.checkout(REQUEST)
  expect(new Headers(vi.mocked(fetch).mock.calls[3][1]?.headers).get('X-CSRF-Token')).toBe('new')
})

it('catálogo live usa no-store/signal e nunca storage ou fallback de seed', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem')
  const controller = new AbortController()
  const products = [{ id: 'a', name: 'Produto A', price: 12.34 }]
  vi.mocked(fetch).mockResolvedValueOnce(json(products))
  await expect(loadCheckoutCatalog(controller.signal)).resolves.toEqual(products)
  expect(fetch).toHaveBeenCalledWith('/api/products', expect.objectContaining({ cache: 'no-store', signal: controller.signal }))
  expect(get).not.toHaveBeenCalled()
})

it.each([{}, [null], [{ id: 'a', name: 'A', price: -1 }]])('catálogo200 inválido%j rejeita sem seed', async (payload) => {
  vi.mocked(fetch).mockResolvedValueOnce(json(payload))
  await expect(loadCheckoutCatalog()).rejects.toThrow()
})

it('falha rede/500 nunca retorna recibo nem retry automático', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'token' })).mockRejectedValueOnce(new TypeError('network'))
    .mockResolvedValueOnce(json({ error: 'SQL details' }, 500))
  const auth = createAuthService(); await auth.bootstrap()
  await expect(auth.checkout(REQUEST)).rejects.toBeInstanceOf(AuthError)
  await expect(auth.checkout(REQUEST)).rejects.toMatchObject({ status: 500 })
  expect(fetch).toHaveBeenCalledTimes(3)
})
