import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createAuthService, AuthError } from './authService'
const KEY = '11111111-1111-4111-8111-111111111111'
const request = { items: [{ productId: 'a', quantity: 2 }], idempotencyKey: KEY }
const result = { orderId: '22222222-2222-4222-8222-222222222222', status: 'pending', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_fixture' }
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }) }
beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => vi.unstubAllGlobals())
it.each([200, 201])('createPayment%s sameorigin/CSRF/exactJSON mantém token semstorage/log/PII', async (status) => {
  const get = vi.spyOn(Storage.prototype, 'getItem'); const set = vi.spyOn(Storage.prototype, 'setItem'); const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: { id: 'u', email: 'a@example.com' }, csrfToken: 'token' })).mockResolvedValueOnce(json(result, status)).mockResolvedValueOnce(json(result))
  const auth = createAuthService(); await auth.bootstrap()
  await expect(auth.createPayment(request)).resolves.toEqual(result)
  expect(fetch).toHaveBeenNthCalledWith(2, '/api/auth/payments/checkout', expect.objectContaining({ method: 'POST', credentials: 'same-origin', cache: 'no-store' }))
  expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string)).toEqual(request)
  expect(new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).get('X-CSRF-Token')).toBe('token')
  await auth.createPayment(request)
  expect(new Headers(vi.mocked(fetch).mock.calls[2][1]?.headers).get('X-CSRF-Token')).toBe('token')
  expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled()
})
it('403snapshot troca token sem reenvio automático de criação', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'old' })).mockResolvedValueOnce(json({}, 403)).mockResolvedValueOnce(json({ user: null, csrfToken: 'new' }))
  const auth = createAuthService(); await auth.bootstrap()
  await expect(auth.createPayment(request)).rejects.toMatchObject({ status: 403, recoveredSession: { user: null, csrfToken: 'new' } })
  expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/auth/session', '/api/auth/payments/checkout', '/api/auth/session'])
})
it('503/rede mantém falha sem fakepaid e sem retry autômatico', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'token' })).mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(json({}, 503))
  const auth = createAuthService(); await auth.bootstrap()
  await expect(auth.createPayment(request)).rejects.toBeInstanceOf(AuthError)
  await expect(auth.createPayment(request)).rejects.toMatchObject({ status: 503 })
  expect(fetch).toHaveBeenCalledTimes(3)
})
it('URL inválida em201 rejeita antes callerredirect', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'token' })).mockResolvedValueOnce(json({ ...result, checkoutUrl: 'https://evil.example/' }, 201))
  const auth = createAuthService(); await auth.bootstrap()
  await expect(auth.createPayment(request)).rejects.toBeInstanceOf(AuthError)
})
