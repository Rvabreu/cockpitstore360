import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

function openDetails() {
  fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes do pedido demonstrativo' }))
  return screen.getByRole('region', { name: 'Detalhes do pedido demonstrativo' })
}

describe('demonstrative order details from a fresh GET', () => {
  it('renders response fields and BRL totals without deriving a historical unit price or writing cache', async () => {
    await renderAfter()
    const cached = localStorage.getItem('cockpit_store_order_v1')
    fetchMock.mockClear()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ...INITIAL_ORDER, productName: 'Produto histórico', variant: 'Azul', quantity: 3,
      total: 1234.56, placedAt: '03/11/2026', statusLabel: 'Em transporte',
    })))
    const panel = within(openDetails())
    expect(await panel.findByRole('heading', { name: 'Pedido #CS-2048' })).toBeInTheDocument()
    expect(panel.getByText('Data da compra: 03/11/2026')).toBeInTheDocument()
    expect(panel.getByText('Status atual: Em transporte')).toBeInTheDocument()
    expect(panel.getByRole('listitem')).toHaveTextContent('Produto histórico')
    expect(panel.getByRole('listitem')).toHaveTextContent('Quantidade3')
    expect(panel.getByText('Azul')).toBeInTheDocument()
    expect(panel.getByText('Não informado pelo pedido')).toBeInTheDocument()
    expect(panel.getAllByText(/R\$\s*1\.234,56/)).toHaveLength(2)
    expect(panel.getByText(/sem autenticação real ou validação de titularidade/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/CS-2048', { cache: 'no-store', signal: expect.any(AbortSignal) })
    expect(localStorage.getItem('cockpit_store_order_v1')).toBe(cached)
  })

  it('shows loading and leaves previous simulation intact when returning, restoring focus', async () => {
    await renderAfter()
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const panel = within(openDetails())
    expect(panel.getByRole('status')).toHaveTextContent('Carregando detalhes do pedido…')
    expect(panel.queryByText('Orbit Headphones Pro')).not.toBeInTheDocument()
    expect(panel.getByRole('heading', { name: 'Detalhes do pedido demonstrativo' })).toHaveFocus()
    const signal = fetchMock.mock.calls.at(-1)?.[1]?.signal
    fireEvent.click(panel.getByRole('button', { name: /Voltar para Meus pedidos/ }))
    expect(signal?.aborted).toBe(true)
    expect(screen.getByRole('button', { name: 'Ver detalhes do pedido demonstrativo' })).toHaveFocus()
    expect(screen.getByRole('button', { name: /Avançar status/ })).toBeInTheDocument()
    expect(screen.getAllByText('Em separação')).toHaveLength(2)
  })

  it.each([401, 403, 404, 500, 'network', 'invalid-json', 'invalid-order', 'wrong-id'])(
    'handles %s without backend details or cached order, and retries via GET', async (failure) => {
      await renderAfter()
      fetchMock.mockImplementation(async () => {
        if (failure === 'network') throw new TypeError('secret backend information')
        if (failure === 'invalid-json') return new Response('secret backend information')
        if (failure === 'invalid-order') return new Response(JSON.stringify({ id: 'CS-2048' }))
        if (failure === 'wrong-id') return new Response(JSON.stringify({ ...INITIAL_ORDER, id: 'OTHER' }))
        return new Response(JSON.stringify({ error: 'secret backend information' }), { status: failure as number })
      })
      const panel = within(openDetails())
      expect(await panel.findByRole('alert')).toHaveTextContent(
        [401, 403, 404].includes(failure as number)
          ? 'O pedido demonstrativo não foi encontrado ou não está disponível.'
          : 'Não foi possível carregar os detalhes agora. Tente novamente em instantes.',
      )
      expect(panel.queryByText(/secret backend/)).not.toBeInTheDocument()
      expect(panel.queryByRole('listitem')).not.toBeInTheDocument()
      fetchMock.mockResolvedValue(new Response(JSON.stringify(INITIAL_ORDER)))
      fireEvent.click(panel.getByRole('button', { name: 'Tentar novamente' }))
      expect(await panel.findByRole('heading', { name: 'Pedido #CS-2048' })).toBeInTheDocument()
    },
  )

  it('treats null as empty with retry and displays normal fields for an order without events', async () => {
    await renderAfter()
    fetchMock.mockResolvedValue(new Response('null'))
    const panel = within(openDetails())
    expect(await panel.findByText('Nenhum detalhe disponível para o pedido demonstrativo.')).toHaveAttribute('role', 'status')
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...INITIAL_ORDER, events: [], statusLabel: '' })))
    fireEvent.click(panel.getByRole('button', { name: 'Tentar novamente' }))
    expect(await panel.findByText(/As etapas de processamento estão sendo preparadas/)).toBeInTheDocument()
    expect(panel.getByText('Status atual: Não informado pelo pedido')).toBeInTheDocument()
    expect(panel.getByRole('heading', { name: 'Pedido #CS-2048' })).toBeInTheDocument()
  })

  it.each(['resolve', 'reject'])('ignores a late %s after close/reopen and fetches again instead of reusing previous state', async (completion) => {
    await renderAfter()
    let resolve!: (response: Response) => void
    let reject!: (error: Error) => void
    fetchMock.mockImplementationOnce(() => new Promise((done, fail) => { resolve = done; reject = fail }))
    const firstPanel = within(openDetails())
    fireEvent.click(firstPanel.getByRole('button', { name: /Voltar para Meus pedidos/ }))
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...INITIAL_ORDER, productName: 'Resposta atual' })))
    const panel = within(openDetails())
    expect(await panel.findByText('Resposta atual')).toBeInTheDocument()
    await act(async () => {
      if (completion === 'reject') reject(new Error('late failure'))
      else resolve(new Response(JSON.stringify({ ...INITIAL_ORDER, productName: 'Resposta antiga' })))
    })
    expect(panel.getByText('Resposta atual')).toBeInTheDocument()
    expect(panel.queryByText('Resposta antiga')).not.toBeInTheDocument()
    expect(panel.queryByRole('alert')).not.toBeInTheDocument()
  })
})
