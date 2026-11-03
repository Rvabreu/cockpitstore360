import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { advanceOrderApi, buildOrderWithEvents, getOrder, getStoredOrder, INITIAL_ORDER, saveOrder } from './storeService'

const fetchMock = vi.fn<typeof fetch>()
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

beforeEach(() => {
  localStorage.clear()
  saveOrder(INITIAL_ORDER)
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('advanceOrderApi', () => {
  it('persists exactly the successful API response, including simulator reset', async () => {
    const updated = buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 0 })
    fetchMock.mockResolvedValue(response(updated))
    expect(await advanceOrderApi('CS-2048')).toEqual(updated)
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/CS-2048/advance', { method: 'POST' })
    expect(getStoredOrder()).toEqual(updated)
  })

  it.each([404, 500])('rejects HTTP %s without advancing the cached order', async (status) => {
    fetchMock.mockResolvedValue(response({}, status))
    await expect(advanceOrderApi('CS-2048')).rejects.toThrow(`HTTP error ${status}`)
    expect(getStoredOrder()).toEqual(INITIAL_ORDER)
  })

  it('rejects connection failure without offline success', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(advanceOrderApi('CS-2048')).rejects.toThrow('Failed to fetch')
    expect(getStoredOrder()).toEqual(INITIAL_ORDER)
  })
})

describe('getOrder', () => {
  it('normalizes the id and reports success only from the API without changing the displayed cache', async () => {
    fetchMock.mockResolvedValue(response(INITIAL_ORDER))
    expect(await getOrder('#cs-2048')).toEqual({
      ok: true,
      message: 'Pedido CS-2048 encontrado. Os dados exibidos são fictícios.',
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/CS-2048')
    expect(getStoredOrder()).toEqual(INITIAL_ORDER)
  })

  it('reports an API 404 as not found', async () => {
    fetchMock.mockResolvedValue(response({}, 404))
    expect(await getOrder('CS-9999')).toEqual({
      ok: false,
      message: 'Pedido não localizado neste ambiente de demonstração.',
    })
  })

  it.each(['CS-2048', 'CS-9999'])('reports connection failure, never offline success for %s', async (id) => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await getOrder(id)).toEqual({
      ok: false,
      message: 'Não foi possível consultar o pedido. Verifique sua conexão e tente novamente.',
    })
  })

  it('distinguishes server failure from a missing order', async () => {
    fetchMock.mockResolvedValue(response({}, 500))
    expect(await getOrder('CS-2048')).toEqual({
      ok: false,
      message: 'Não foi possível consultar o pedido. Verifique sua conexão e tente novamente.',
    })
  })
})
