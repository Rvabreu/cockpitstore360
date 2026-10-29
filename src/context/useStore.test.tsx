import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { StrictMode } from 'react'
import { useStore } from './useStore'
import { INITIAL_ORDER, INITIAL_PRODUCTS, SEED_ORDER_EVENTS, buildOrderWithEvents } from '../services/storeService'
import type { OrderWithEvents, Product } from '../types/store'

const api = vi.hoisted(() => ({ products: vi.fn(), load: vi.fn(), advance: vi.fn(), lookup: vi.fn() }))
vi.mock('../services/storeService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/storeService')>(),
  fetchProductsApi: api.products,
  loadOrderApi: api.load,
  advanceOrderApi: api.advance,
  getOrder: api.lookup,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function orderAt(currentStep: number) {
  return buildOrderWithEvents({ ...INITIAL_ORDER, currentStep, events: SEED_ORDER_EVENTS })
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  api.products.mockResolvedValue(INITIAL_PRODUCTS)
  api.load.mockResolvedValue(INITIAL_ORDER)
  api.advance.mockResolvedValue(orderAt(2))
  api.lookup.mockResolvedValue({ ok: true, message: 'Pedido encontrado' })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Seed síncrono e hidratação determinística', () => {
  it('primeiro render tem catálogo e pedido seed antes de qualquer GET concluir', async () => {
    const products = deferred<Product[]>()
    const order = deferred<OrderWithEvents>()
    api.products.mockReturnValue(products.promise)
    api.load.mockReturnValue(order.promise)
    const { result } = renderHook(() => useStore())
    expect(result.current.products).toEqual(INITIAL_PRODUCTS)
    expect(result.current.order).toEqual(INITIAL_ORDER)
    expect(result.current.isLoaded).toBe(false)
    await act(async () => {
      products.resolve(INITIAL_PRODUCTS.slice(0, 1))
      order.resolve(orderAt(3))
    })
    expect(result.current.order).toEqual(orderAt(3))
    expect(result.current.products).toEqual(INITIAL_PRODUCTS.slice(0, 1))
    expect(result.current.isLoaded).toBe(true)
  })

  it('SSR e primeira hidratação ignoram storage divergente sem mismatch; mount depois atualiza API', async () => {
    const order = deferred<OrderWithEvents>()
    api.load.mockReturnValue(order.promise)
    const snapshots: Array<{ step: number; loaded: boolean }> = []
    function Probe() {
      const store = useStore()
      snapshots.push({ step: store.order.currentStep, loaded: store.isLoaded })
      return <div>{store.products.map((p) => p.name).join(',')}|{store.order.id}|{store.order.statusLabel}</div>
    }
    const storage = vi.spyOn(window, 'localStorage', 'get')
    const html = renderToString(<Probe />)
    expect(storage).not.toHaveBeenCalled()
    expect(api.load).not.toHaveBeenCalled()
    expect(html).toContain('CS-2048')
    expect(html).toContain('Em separação')
    localStorage.setItem('cockpit_store_order_v1', JSON.stringify(orderAt(3)))
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)
    const onRecoverableError = vi.fn()
    let root!: Root
    try {
      await act(async () => { root = hydrateRoot(container, <Probe />, { onRecoverableError }) })
      expect(snapshots.slice(0, 2)).toEqual([{ step: 1, loaded: false }, { step: 1, loaded: false }])
      expect(container.innerHTML).toBe(html)
      expect(onRecoverableError).not.toHaveBeenCalled()
      await act(async () => { order.resolve(orderAt(3)) })
      expect(container.textContent).toContain('Entregue')
    } finally {
      if (root) await act(async () => root.unmount())
      container.remove()
    }
  })
})

describe('Atualização e lifecycle sem regressão de status', () => {
  it('avanço só muda estado após confirmação backend; falha preserva pedido', async () => {
    const { result } = renderHook(() => useStore())
    await act(async () => {})
    const post = deferred<OrderWithEvents>()
    api.advance.mockReturnValueOnce(post.promise)
    let pending!: Promise<OrderWithEvents>
    act(() => { pending = result.current.advanceOrder('2048') })
    expect(result.current.order).toEqual(INITIAL_ORDER)
    await act(async () => { post.resolve(orderAt(2)); await pending })
    expect(result.current.order).toEqual(orderAt(2))
    api.advance.mockRejectedValueOnce(new Error('Não foi possível atualizar o pedido. Tente novamente.'))
    await act(async () => {
      await expect(result.current.advanceOrder('2048')).rejects.toThrow('Não foi possível atualizar')
    })
    expect(result.current.order).toEqual(orderAt(2))
  })

  it('busca é validação e não substitui o pedido atual', async () => {
    const { result } = renderHook(() => useStore())
    await act(async () => {})
    await act(async () => { await result.current.getOrder('9999') })
    expect(api.lookup).toHaveBeenCalledWith('9999')
    expect(result.current.order).toEqual(INITIAL_ORDER)
  })

  it('avanços simultâneos compartilham uma única mutação pendente', async () => {
    const { result } = renderHook(() => useStore())
    await act(async () => {})
    const post = deferred<OrderWithEvents>()
    api.advance.mockReturnValue(post.promise)
    let first!: Promise<OrderWithEvents>
    let second!: Promise<OrderWithEvents>
    act(() => {
      first = result.current.advanceOrder('CS-2048')
      second = result.current.advanceOrder('CS-2048')
    })
    const calls = api.advance.mock.calls.length
    await act(async () => { post.resolve(orderAt(2)); await Promise.all([first, second]) })
    expect(calls).toBe(1)
    expect(result.current.order.currentStep).toBe(2)
  })

  it('GET do mount atrasado não regride um POST já confirmado', async () => {
    const initial = deferred<OrderWithEvents>()
    api.load.mockReturnValueOnce(initial.promise)
    const { result } = renderHook(() => useStore())
    await act(async () => { await result.current.advanceOrder('CS-2048') })
    expect(result.current.order.currentStep).toBe(2)
    await act(async () => { initial.resolve(orderAt(1)) })
    expect(result.current.order.currentStep).toBe(2)
    expect(result.current.isLoaded).toBe(true)
  })

  it('reload iniciado antes do POST não sobrescreve seu status confirmado', async () => {
    const { result } = renderHook(() => useStore())
    await act(async () => {})
    const reload = deferred<OrderWithEvents>()
    api.load.mockReturnValueOnce(reload.promise)
    let pending!: Promise<void>
    act(() => { pending = result.current.loadOrder() })
    await act(async () => { await result.current.advanceOrder('CS-2048') })
    await act(async () => { reload.resolve(orderAt(1)); await pending })
    expect(result.current.order.currentStep).toBe(2)
  })

  it('último reload prevalece mesmo se resposta antiga terminar depois', async () => {
    const { result } = renderHook(() => useStore())
    await act(async () => {})
    const old = deferred<OrderWithEvents>()
    const recent = deferred<OrderWithEvents>()
    api.load.mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise)
    let oldPending!: Promise<void>
    let recentPending!: Promise<void>
    act(() => {
      oldPending = result.current.loadOrder()
      recentPending = result.current.loadOrder()
    })
    await act(async () => { recent.resolve(orderAt(3)); await recentPending })
    await act(async () => { old.resolve(orderAt(1)); await oldPending })
    expect(result.current.order.currentStep).toBe(3)
  })

  it('resposta pendente de instância desmontada não afeta nova instância', async () => {
    const old = deferred<OrderWithEvents>()
    api.load.mockReturnValueOnce(old.promise)
    const first = renderHook(() => useStore())
    first.unmount()
    api.load.mockResolvedValueOnce(orderAt(3))
    const second = renderHook(() => useStore())
    await act(async () => {})
    expect(second.result.current.order.currentStep).toBe(3)
    await act(async () => { old.resolve(orderAt(1)) })
    expect(second.result.current.order.currentStep).toBe(3)
  })

  it('StrictMode ignora GET do primeiro efeito desmontado depois de mount e avanço confirmados', async () => {
    const discarded = deferred<OrderWithEvents>()
    api.load.mockReturnValueOnce(discarded.promise).mockResolvedValueOnce(INITIAL_ORDER)
    const { result } = renderHook(() => useStore(), {
      reactStrictMode: true,
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    })
    await act(async () => {})
    expect(result.current.isLoaded).toBe(true)
    await act(async () => { await result.current.advanceOrder('CS-2048') })
    await act(async () => { discarded.resolve(orderAt(1)) })
    expect(result.current.order.currentStep).toBe(2)
  })
})
