import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Route } from './index'
import { buildOrderWithEvents, INITIAL_ORDER, INITIAL_PRODUCTS, saveOrder, getStoredOrder } from '../services/storeService'

const fetchMock = vi.fn<typeof fetch>()
let advance: () => Promise<Response>
const Page = Route.options.component as React.ComponentType

beforeEach(() => {
  localStorage.clear()
  saveOrder(INITIAL_ORDER)
  advance = async () => new Response(JSON.stringify(buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 2 })))
  fetchMock.mockImplementation(async (url, options) => {
    if (options?.method === 'POST') return advance()
    if (url === '/api/products') return new Response(JSON.stringify(INITIAL_PRODUCTS))
    if (url === '/api/orders/CS-2048') return new Response(JSON.stringify(INITIAL_ORDER))
    return new Response('{}', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

async function renderAfter() {
  render(<Page />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/orders/CS-2048'))
  // Complete the mount refresh before exercising the mutation.
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: 'DEPOIS DA MELHORIA' }))
}

describe('order tracking UI with the real hook/service', () => {
  it('renders all four stages and advances using the backend response', async () => {
    await renderAfter()
    for (const title of ['Pedido confirmado', 'Em separação', 'Em transporte', 'Entregue']) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0)
    }
    fireEvent.click(screen.getByRole('button', { name: /Avançar status/ }))
    await waitFor(() => expect(getStoredOrder().currentStep).toBe(2))
    expect(screen.getAllByText('Em transporte')).toHaveLength(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders delivery and wraps to confirmed only after successful POST', async () => {
    await renderAfter()
    advance = async () => new Response(JSON.stringify(buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 3 })))
    fireEvent.click(screen.getByRole('button', { name: /Avançar status/ }))
    await screen.findByRole('button', { name: /Reiniciar simulação/ })
    expect(screen.getAllByText('Entregue')).toHaveLength(2)
    advance = async () => new Response(JSON.stringify(buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 0 })))
    fireEvent.click(screen.getByRole('button', { name: /Reiniciar simulação/ }))
    await waitFor(() => expect(getStoredOrder().currentStep).toBe(0))
    expect(screen.getAllByText('Pedido confirmado')).toHaveLength(2)
  })

  it.each(['http', 'network'])('shows a pt-BR error and preserves timeline/cache on %s failure', async (failure) => {
    await renderAfter()
    const cached = localStorage.getItem('cockpit_store_order_v1')
    advance = async () => {
      if (failure === 'network') throw new TypeError('Network error')
      return new Response('{}', { status: 500 })
    }
    fireEvent.click(screen.getByRole('button', { name: /Avançar status/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar o pedido. Tente novamente.')
    expect(screen.getAllByText('Em separação')).toHaveLength(2)
    expect(localStorage.getItem('cockpit_store_order_v1')).toBe(cached)
    expect(screen.getByRole('button', { name: /Avançar status/ })).toBeEnabled()
  })

  it('disables advancement in flight and re-enables it after completion', async () => {
    await renderAfter()
    let resolve!: (response: Response) => void
    advance = () => new Promise((done) => { resolve = done })
    fireEvent.click(screen.getByRole('button', { name: /Avançar status/ }))
    const button = screen.getByRole('button', { name: /Atualizando pedido/ })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
    await act(async () => resolve(new Response(JSON.stringify(INITIAL_ORDER))))
    expect(screen.getByRole('button', { name: /Avançar status/ })).toBeEnabled()
  })

  it('searches through GET and shows pt-BR found/not-found without changing the timeline', async () => {
    await renderAfter()
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do pedido' }), { target: { value: ' #cs-2048 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Pedido CS-2048 encontrado. Os dados exibidos são fictícios.')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do pedido' }), { target: { value: 'NOPE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Pedido não localizado neste ambiente de demonstração.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/NOPE')
    expect(getStoredOrder()).toEqual(INITIAL_ORDER)
  })
})
