import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from './useStore'
import { buildOrderWithEvents, getStoredOrder, INITIAL_ORDER, INITIAL_PRODUCTS, saveOrder, saveProducts } from '../services/storeService'

const fetchMock = vi.fn<typeof fetch>()
const response = (data: unknown) => new Response(JSON.stringify(data))

beforeEach(() => {
  localStorage.clear()
  saveOrder(INITIAL_ORDER)
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url) => response(url === '/api/products' ? INITIAL_PRODUCTS : INITIAL_ORDER))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useStore simulator updates', () => {
  it('uses deterministic seed for the first render before restoring browser cache', () => {
    const cachedOrder = buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 3 })
    const cachedProducts = [{ ...INITIAL_PRODUCTS[0]!, name: 'Cached product' }]
    saveOrder(cachedOrder)
    saveProducts(cachedProducts)
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const renders: Array<ReturnType<typeof useStore>> = []
    const { result } = renderHook(() => {
      const store = useStore()
      renders.push(store)
      return store
    })
    expect(renders[0]?.order).toEqual(INITIAL_ORDER)
    expect(renders[0]?.products).toEqual(INITIAL_PRODUCTS)
    expect(result.current.order).toEqual(cachedOrder)
    expect(result.current.products).toEqual(cachedProducts)
  })

  it('updates state from the API and prevents simultaneous duplicate POSTs', async () => {
    const { result } = renderHook(() => useStore())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    let resolve!: (value: Response) => void
    fetchMock.mockImplementation(() => new Promise((done) => { resolve = done }))
    let pending!: ReturnType<typeof result.current.advanceOrder>
    act(() => { pending = result.current.advanceOrder('CS-2048') })
    expect(result.current.isAdvancing).toBe(true)
    await act(async () => {
      expect(await result.current.advanceOrder('CS-2048')).toBeNull()
    })
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
    const updated = buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 2 })
    await act(async () => {
      resolve(response(updated))
      expect(await pending).toEqual(updated)
    })
    expect(result.current.order).toEqual(updated)
    expect(result.current.isAdvancing).toBe(false)
  })

  it('keeps the status on failure and unlocks the next attempt', async () => {
    const { result } = renderHook(() => useStore())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await act(async () => {
      await expect(result.current.advanceOrder('CS-2048')).rejects.toThrow('Failed to fetch')
    })
    expect(result.current.order).toEqual(INITIAL_ORDER)
    expect(result.current.isAdvancing).toBe(false)
  })

  it('does not overwrite a completed advance with a delayed initial read', async () => {
    let resolveRead!: (value: Response) => void
    const updated = buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 2 })
    fetchMock.mockImplementation(async (url, options) => {
      if (url === '/api/products') return response(INITIAL_PRODUCTS)
      if (options?.method === 'POST') return response(updated)
      return new Promise((done) => { resolveRead = done })
    })
    const { result } = renderHook(() => useStore())
    await act(async () => { await result.current.advanceOrder('CS-2048') })
    await act(async () => { resolveRead(response(INITIAL_ORDER)) })
    expect(result.current.isLoaded).toBe(true)
    expect(result.current.order).toEqual(updated)
    expect(getStoredOrder()).toEqual(updated)
  })

  it('does not let a delayed manual read overwrite a successful advance or its cache', async () => {
    const { result } = renderHook(() => useStore())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    let resolveRead!: (value: Response) => void
    const updated = buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 3 })
    fetchMock.mockImplementation(async (_, options) => {
      if (options?.method === 'POST') return response(updated)
      return new Promise((done) => { resolveRead = done })
    })
    let pendingRead!: ReturnType<typeof result.current.loadOrder>
    act(() => { pendingRead = result.current.loadOrder() })
    await act(async () => { await result.current.advanceOrder('CS-2048') })
    await act(async () => {
      resolveRead(response(INITIAL_ORDER))
      await pendingRead
    })
    expect(result.current.order).toEqual(updated)
    expect(getStoredOrder()).toEqual(updated)
  })

  it('does not start a manual read during an ongoing advance', async () => {
    const { result } = renderHook(() => useStore())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    let resolveAdvance!: (value: Response) => void
    fetchMock.mockImplementation(() => new Promise((done) => { resolveAdvance = done }))
    let pendingAdvance!: ReturnType<typeof result.current.advanceOrder>
    act(() => { pendingAdvance = result.current.advanceOrder('CS-2048') })
    const callsBeforeRead = fetchMock.mock.calls.length
    await act(async () => { await result.current.loadOrder() })
    expect(fetchMock.mock.calls).toHaveLength(callsBeforeRead)
    await act(async () => {
      resolveAdvance(response(buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 2 })))
      await pendingAdvance
    })
  })
})
