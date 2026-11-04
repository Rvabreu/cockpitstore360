import { afterEach, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { useStore } from './useStore'
import { INITIAL_ORDER, INITIAL_PRODUCTS, buildOrderWithEvents } from '../services/storeService'

function StoreSnapshot() {
  const { order, products, isLoaded } = useStore()
  return (
    <div>
      <span>{order.statusLabel}</span>
      <span>{products[0].name}</span>
      <span>{isLoaded ? 'Carregado' : 'Carregando'}</span>
      {order.events.map((event) => <span key={event.stepIndex}>{event.status}: {event.displayDetail}</span>)}
    </div>
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('hydrates the deterministic seed despite stale browser cache, then refreshes from the API after mount', async () => {
  const cachedOrder = buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 2 })
  localStorage.setItem('cockpit_store_order_v1', JSON.stringify(cachedOrder))
  localStorage.setItem('cockpit_store_products_v1', JSON.stringify([{ ...INITIAL_PRODUCTS[0], name: 'Produto em cache' }]))

  let serverHTML: string
  vi.stubGlobal('window', undefined)
  try {
    serverHTML = renderToString(<StoreSnapshot />)
  } finally {
    vi.unstubAllGlobals()
  }
  expect(serverHTML).toContain('Em separação')
  expect(serverHTML).toContain('Orbit Headphones Pro')

  const apiOrder = buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 3 })
  const apiProducts = [{ ...INITIAL_PRODUCTS[0], name: 'Produto retornado pela API' }]
  let resolveOrder!: (response: unknown) => void
  let resolveProducts!: (response: unknown) => void
  const fetchMock = vi.fn((url: string) => new Promise((resolve) => {
    if (url === '/api/products') resolveProducts = resolve
    else resolveOrder = resolve
  }))
  vi.stubGlobal('fetch', fetchMock)
  const onRecoverableError = vi.fn()
  const container = document.createElement('div')
  container.innerHTML = serverHTML
  document.body.appendChild(container)
  let root: Root | undefined
  try {
    await act(async () => {
      root = hydrateRoot(container, <StoreSnapshot />, { onRecoverableError })
    })
    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe(serverHTML)
    expect(container).not.toHaveTextContent('Produto em cache')
    expect(fetchMock).toHaveBeenCalledWith('/api/products')
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/CS-2048')

    await act(async () => {
      resolveProducts({ ok: true, json: async () => apiProducts })
      resolveOrder({ ok: true, json: async () => apiOrder })
    })
    expect(container).toHaveTextContent('Entregue')
    expect(container).toHaveTextContent('Produto retornado pela API')
    expect(container).toHaveTextContent('Carregado')
    expect(onRecoverableError).not.toHaveBeenCalled()
  } finally {
    await act(async () => { root?.unmount() })
    container.remove()
  }
})
