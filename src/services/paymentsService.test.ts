import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { loadPaymentCatalog, loadPaymentOrder, isPaymentCheckoutResult, isPaymentOrder } from './paymentsService'
const ID = '22222222-2222-4222-8222-222222222222'
const order = { id: ID, items: [{ productId: 'a', name: 'Produto A', quantity: 2, unitPriceCents: 1234, lineTotalCents: 2468 }], totalCents: 2468, currency: 'USD', status: 'pending', createdAt: '2026-10-29T12:00:00.000Z' }
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }) }
beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => vi.unstubAllGlobals())
it('catálogo USD protegido explícito/no-store/signal não consulta storage', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem')
  const catalog = { currency: 'USD', mode: 'test', products: [{ id: 'a', name: 'Produto A', unitPriceCents: 1234 }] }
  vi.mocked(fetch).mockResolvedValueOnce(json(catalog))
  const controller = new AbortController()
  await expect(loadPaymentCatalog(controller.signal)).resolves.toEqual(catalog)
  expect(fetch).toHaveBeenCalledWith('/api/auth/payments/catalog', expect.objectContaining({ cache: 'no-store', credentials: 'same-origin', signal: controller.signal }))
  expect(get).not.toHaveBeenCalled()
})
it.each([503, 401, 500])('catálogo%s não volta seed/BRL nem simulação', async (status) => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ error: 'private' }, status))
  await expect(loadPaymentCatalog()).rejects.toMatchObject({ status })
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('ownedorder GET mantém serverstatus não promove pending por retornoURL', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ order }))
  await expect(loadPaymentOrder(ID)).resolves.toEqual(order)
  expect(fetch).toHaveBeenCalledWith(`/api/auth/payments/orders/${ID}`, expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' }))
})
it.each([null, { ...order, currency: 'BRL' }, { ...order, totalCents: 1 }, { ...order, status: 'simulated' }, { ...order, createdAt: '2026-02-30' }])('ordem inválida%j nunca autoriza UI paid', async (invalid) => {
  expect(isPaymentOrder(invalid)).toBe(false)
  vi.mocked(fetch).mockResolvedValueOnce(json({ order: invalid }))
  await expect(loadPaymentOrder(ID)).rejects.toThrow()
})
it.each(['http://checkout.stripe.com/c/pay', 'https://checkout.stripe.com.evil.example/c/pay', 'https://user:pass@checkout.stripe.com/c/pay', 'javascript:alert(1)'])('URL gateway%s inválida jamais habilita redirect', (checkoutUrl) => {
  expect(isPaymentCheckoutResult({ orderId: ID, status: 'pending', checkoutUrl })).toBe(false)
})
it('aceita só domínio HTTPS Stripe e terminal semURL', () => {
  expect(isPaymentCheckoutResult({ orderId: ID, status: 'pending', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_fixture' })).toBe(true)
  expect(isPaymentCheckoutResult({ orderId: ID, status: 'paid', checkoutUrl: null })).toBe(true)
})
it('completedasyncunpaid/replay pode estar pending semURL sem autorizar redirect', () => {
  expect(isPaymentCheckoutResult({ orderId: ID, status: 'pending', checkoutUrl: null })).toBe(true)
})
