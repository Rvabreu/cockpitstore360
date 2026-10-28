import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { OrderWithEvents } from '../types/store'

let service: typeof import('./storeService')

function orderAt(currentStep: number): OrderWithEvents {
  return service.buildOrderWithEvents({
    ...service.INITIAL_ORDER, currentStep, events: service.SEED_ORDER_EVENTS,
  })
}

function json(order: OrderWithEvents) {
  return new Response(JSON.stringify(order))
}

function deferredResponse() {
  let resolve!: (response: Response) => void
  let reject!: (error: Error) => void
  const promise = new Promise<Response>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

beforeEach(async () => {
  vi.resetModules()
  service = await import('./storeService')
  localStorage.clear()
  service.saveOrder(orderAt(1))
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('consumidores concorrentes com aliases normalizados compartilham um POST e o mesmo resultado confirmado', async () => {
  const response = deferredResponse()
  vi.mocked(fetch).mockReturnValue(response.promise)
  const pending = ['CS-2048', '2048', ' #cs-2048 ', '%23CS-2048']
    .map((id) => service.advanceOrderApi(id))
  const callsBeforeConfirmation = vi.mocked(fetch).mock.calls.length
  response.resolve(json(orderAt(2)))
  const confirmed = await Promise.all(pending)

  expect(callsBeforeConfirmation).toBe(1)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('/api/orders/CS-2048/advance', { method: 'POST' })
  for (const order of confirmed) expect(order).toEqual(orderAt(2))
  expect(service.getStoredOrder()).toEqual(orderAt(2))
  expect(JSON.parse(localStorage.getItem('cockpit_store_order_v1')!)).toEqual(orderAt(2))
})

it('falha compartilhada preserva cache e libera uma nova tentativa', async () => {
  const response = deferredResponse()
  vi.mocked(fetch).mockReturnValueOnce(response.promise).mockResolvedValueOnce(json(orderAt(2)))
  const first = service.advanceOrderApi('2048')
  const alias = service.advanceOrderApi('#cs-2048')
  // Registrar handlers antes de rejeitar evita rejeição não tratada no teste.
  const rejected = Promise.allSettled([first, alias])
  response.reject(new TypeError('Failed to fetch'))
  const results = await rejected
  for (const result of results) {
    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') {
      expect(result.reason.message).toBe('Não foi possível atualizar o pedido. Tente novamente.')
    }
  }
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(service.getStoredOrder()).toEqual(orderAt(1))

  await expect(service.advanceOrderApi('CS-2048')).resolves.toEqual(orderAt(2))
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(service.getStoredOrder()).toEqual(orderAt(2))
})

it('sucesso compartilhado libera o próximo avanço sequencial sem reutilizar resultado antigo', async () => {
  const response = deferredResponse()
  vi.mocked(fetch).mockReturnValueOnce(response.promise).mockResolvedValueOnce(json(orderAt(3)))
  const first = service.advanceOrderApi('2048')
  const alias = service.advanceOrderApi('CS-2048')
  const callsBeforeConfirmation = vi.mocked(fetch).mock.calls.length
  response.resolve(json(orderAt(2)))
  await Promise.all([first, alias])
  expect(callsBeforeConfirmation).toBe(1)

  await expect(service.advanceOrderApi('#2048')).resolves.toEqual(orderAt(3))
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(service.getStoredOrder()).toEqual(orderAt(3))
  expect(JSON.parse(localStorage.getItem('cockpit_store_order_v1')!)).toEqual(orderAt(3))
})

it('wrap compartilhado 3 para 0 mantém exatamente o pedido backend em memória e storage', async () => {
  service.saveOrder(orderAt(3))
  const response = deferredResponse()
  vi.mocked(fetch).mockReturnValue(response.promise)
  const first = service.advanceOrderApi('CS-2048')
  const alias = service.advanceOrderApi(' #2048 ')
  const callsBeforeConfirmation = vi.mocked(fetch).mock.calls.length
  response.resolve(json(orderAt(0)))
  const confirmed = await Promise.all([first, alias])

  expect(callsBeforeConfirmation).toBe(1)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(confirmed).toEqual([orderAt(0), orderAt(0)])
  expect(service.getStoredOrder()).toEqual(orderAt(0))
  expect(JSON.parse(localStorage.getItem('cockpit_store_order_v1')!)).toEqual(orderAt(0))
})
