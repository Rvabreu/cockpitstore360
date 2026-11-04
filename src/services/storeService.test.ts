import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  INITIAL_ORDER,
  advanceOrderApi,
  buildOrderWithEvents,
  getOrder,
  getStoredOrder,
  loadOrderApi,
  normalizeOrderId,
  saveOrder,
} from './storeService'

const fetchMock = vi.fn()

beforeEach(() => {
  localStorage.clear()
  saveOrder(INITIAL_ORDER)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('order API', () => {
  it.each(['cs-2048', ' #cs-2048 ', '%23cs-2048'])('normalizes lookup %s and reads the returned data', async (id) => {
    const updated = buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 2 })
    const json = vi.fn().mockResolvedValue(updated)
    fetchMock.mockResolvedValue({ ok: true, json })

    expect(normalizeOrderId(id)).toBe('CS-2048')
    expect(await getOrder(id)).toEqual({
      ok: true,
      message: 'Pedido CS-2048 encontrado. Os dados exibidos são fictícios.',
      order: updated,
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/CS-2048')
    expect(json).toHaveBeenCalledOnce()
    expect(getStoredOrder()).toEqual(updated)
  })

  it('returns the pt-BR not-found message only for HTTP 404', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 })
    expect(await getOrder('missing')).toEqual({
      ok: false,
      message: 'Pedido não localizado neste ambiente de demonstração.',
    })
    expect(getStoredOrder()).toEqual(INITIAL_ORDER)
  })

  it.each(['CS-2048', 'MISSING'])('reports network unavailability without offline lookup for %s', async (id) => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await getOrder(id)
    expect(result).toEqual({ ok: false, message: 'Consulta de pedido indisponível no momento. Tente novamente.' })
    expect(result.message).not.toMatch(/encontrado|localizado|fictícios/)
  })

  it('reports HTTP 500 as unavailability, not as a missing order', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    expect((await getOrder('CS-2048')).message).toBe('Consulta de pedido indisponível no momento. Tente novamente.')
  })

  it('does not replace the demo cache with another successful order', async () => {
    const other = { ...INITIAL_ORDER, id: 'CS-9999' }
    fetchMock.mockResolvedValue({ ok: true, json: async () => other })
    expect((await getOrder('CS-9999')).order).toEqual(other)
    expect(getStoredOrder()).toEqual(INITIAL_ORDER)
  })

  it('rejects failed initial loads instead of returning a cached success', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(loadOrderApi('CS-2048')).rejects.toThrow('Consulta de pedido indisponível')
  })

  it('advances only with the POST response, including a backend wrap to step zero', async () => {
    const wrapped = buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 0 })
    fetchMock.mockResolvedValue({ ok: true, json: async () => wrapped })
    expect(await advanceOrderApi('CS-2048')).toEqual(wrapped)
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/CS-2048/advance', { method: 'POST' })
    expect(getStoredOrder()).toEqual(wrapped)
  })

  it.each(['network', 'http'])('does not mutate the cache after a %s POST failure', async (failure) => {
    if (failure === 'network') fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    else fetchMock.mockResolvedValue({ ok: false, status: 500 })
    const cached = localStorage.getItem('cockpit_store_order_v1')
    await expect(advanceOrderApi('CS-2048')).rejects.toThrow('Não foi possível atualizar o pedido. Tente novamente.')
    expect(getStoredOrder()).toEqual(INITIAL_ORDER)
    expect(localStorage.getItem('cockpit_store_order_v1')).toBe(cached)
  })
})
