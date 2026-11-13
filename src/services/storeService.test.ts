import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { advanceOrderApi, buildOrderWithEvents, getOrder, getStoredOrder, INITIAL_ORDER, normalizeOrderId, saveOrder } from './storeService'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  localStorage.clear()
  saveOrder(INITIAL_ORDER)
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('advanceOrderApi', () => {
  it.each([2, 0])('mirrors only the backend response (step %s, including wrap)', async (currentStep) => {
    const updated = buildOrderWithEvents({ ...INITIAL_ORDER, currentStep })
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(updated)))
    expect(await advanceOrderApi(' #cs-2048 ')).toEqual(updated)
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/CS-2048/advance', { method: 'POST' })
    expect(getStoredOrder()).toEqual(updated)
  })

  it.each([404, 500])('does not advance or change cache on HTTP %s', async (status) => {
    const cached = localStorage.getItem('cockpit_store_order_v1')
    const event = vi.fn()
    window.addEventListener('cockpit_store_data_change', event)
    fetchMock.mockResolvedValueOnce(new Response('{"error":"Falha"}', { status }))
    await expect(advanceOrderApi('CS-2048')).rejects.toThrow(`HTTP error ${status}`)
    expect(getStoredOrder()).toEqual(INITIAL_ORDER)
    expect(localStorage.getItem('cockpit_store_order_v1')).toBe(cached)
    expect(event).not.toHaveBeenCalled()
    window.removeEventListener('cockpit_store_data_change', event)
  })

  it('does not announce a local success on network failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network error'))
    await expect(advanceOrderApi('CS-2048')).rejects.toThrow('Network error')
    expect(getStoredOrder()).toEqual(INITIAL_ORDER)
  })
})

describe('lookup', () => {
  it.each(['cs-2048', '#cs-2048', ' #cs-2048 '])('queries the API with normalized input %s', async (id) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(INITIAL_ORDER)))
    expect(await getOrder(id)).toEqual({ ok: true, message: 'Pedido CS-2048 encontrado. Os dados exibidos são fictícios.' })
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/CS-2048')
  })

  it('keeps percent sequences literal and returns pt-BR not found without swapping the displayed order', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }))
    expect(normalizeOrderId('%43S-2048')).toBe('%43S-2048')
    expect(await getOrder('%43S-2048')).toEqual({ ok: false, message: 'Pedido não localizado neste ambiente de demonstração.' })
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/%2543S-2048')
    expect(getStoredOrder()).toEqual(INITIAL_ORDER)
  })
})
