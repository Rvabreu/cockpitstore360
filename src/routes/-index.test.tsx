import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StorefrontPage } from './index'
import { INITIAL_ORDER, INITIAL_PRODUCTS, buildOrderWithEvents, saveOrder } from '../services/storeService'

vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }))

const fetchMock = vi.fn()
let backendOrder = INITIAL_ORDER

function response(data: unknown) {
  return { ok: true, json: async () => data }
}

beforeEach(() => {
  localStorage.clear()
  backendOrder = INITIAL_ORDER
  saveOrder(INITIAL_ORDER)
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === '/api/products') return response(INITIAL_PRODUCTS)
    if (url === '/api/orders/CS-2048/advance' && options?.method === 'POST') {
      backendOrder = buildOrderWithEvents({ ...backendOrder, currentStep: (backendOrder.currentStep + 1) % 4 })
      return response(backendOrder)
    }
    if (url === '/api/orders/CS-2048') return response(backendOrder)
    return { ok: false, status: 404 }
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

async function renderLoaded() {
  const view = render(<StorefrontPage />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled())
  return view
}

function expectCurrent(title: string) {
  const node = screen.getAllByText(title).find((element) => element.parentElement?.previousElementSibling?.textContent === '●')
  expect(node).toBeDefined()
}

describe('StorefrontPage tracking', () => {
  it('renders the default timeline in order and keeps the before/after comparison', async () => {
    const { container } = await renderLoaded()
    expect(screen.getByRole('button', { name: 'DEPOIS DA MELHORIA' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Avançar status/ })).toBeEnabled()
    expect(screen.getByText('LINHA DO TEMPO DO PEDIDO')).toBeInTheDocument()
    const rows = [...container.querySelectorAll('.min-h-\\[75px\\]')]
    expect(rows.map((row) => row.querySelector('.font-semibold')?.textContent)).toEqual([
      'Pedido confirmado', 'Em separação', 'Em transporte', 'Entregue',
    ])
    expectCurrent('Em separação')
    fireEvent.click(screen.getByRole('button', { name: 'ANTES DA MELHORIA' }))
    expect(screen.getByText('Seu pedido foi recebido.')).toBeInTheDocument()
    expect(screen.queryByText('LINHA DO TEMPO DO PEDIDO')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Avançar status/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'DEPOIS DA MELHORIA' }))
    expectCurrent('Em separação')
  })

  it('rerenders backend POST steps through delivered and wraps only after the next POST', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /Avançar status/ }))
    await waitFor(() => expectCurrent('Em transporte'))
    await waitFor(() => expect(screen.getByRole('button', { name: /Avançar status/ })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /Avançar status/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Reiniciar simulação/ })).toBeEnabled())
    expectCurrent('Entregue')
    fireEvent.click(screen.getByRole('button', { name: /Reiniciar simulação/ }))
    await waitFor(() => expectCurrent('Pedido confirmado'))
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(3)
    expect(screen.getAllByText('#CS-2048')).toHaveLength(1)
  })

  it.each(['network', 'http'])('shows a pt-BR %s POST error without changing the timeline', async (failure) => {
    await renderLoaded()
    fetchMock.mockImplementationOnce(async () => {
      if (failure === 'network') throw new TypeError('Failed to fetch')
      return { ok: false, status: 500 }
    })
    fireEvent.click(screen.getByRole('button', { name: /Avançar status/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar o pedido. Tente novamente.')
    expectCurrent('Em separação')
    expect(screen.getAllByText('Aguardando atualização')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Avançar status/ })).toBeEnabled()
  })

  it('disables operations while initial load and POST are pending', async () => {
    let resolveLoad!: (value: unknown) => void
    fetchMock.mockImplementationOnce(() => response(INITIAL_PRODUCTS))
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveLoad = resolve }))
    render(<StorefrontPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando pedido…')
    expect(screen.getByRole('button', { name: /Avançar status/ })).toBeDisabled()
    await act(async () => { resolveLoad(response(INITIAL_ORDER)) })
    let resolvePost!: (value: unknown) => void
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolvePost = resolve }))
    fireEvent.click(screen.getByRole('button', { name: /Avançar status/ }))
    expect(screen.getByRole('button', { name: 'Atualizando pedido…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled()
    expectCurrent('Em separação')
    await act(async () => { resolvePost(response(buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 2 }))) })
    expectCurrent('Em transporte')
  })

  it('shows unavailable initial load in pt-BR rather than an unhandled rejection', async () => {
    fetchMock.mockImplementationOnce(() => response(INITIAL_PRODUCTS))
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<StorefrontPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Consulta de pedido indisponível no momento.')
    expectCurrent('Em separação')
  })

  it('normalizes a successful GET search and refreshes the single CS-2048 card', async () => {
    await renderLoaded()
    backendOrder = buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 3 })
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do pedido' }), { target: { value: ' %23cs-2048 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Pedido CS-2048 encontrado. Os dados exibidos são fictícios.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/orders/CS-2048')
    expectCurrent('Entregue')
    expect(screen.getAllByText('#CS-2048')).toHaveLength(1)
  })

  it('keeps the demo card for other successful orders', async () => {
    await renderLoaded()
    fetchMock.mockResolvedValueOnce(response({ ...INITIAL_ORDER, id: 'CS-9999', currentStep: 3 }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'CS-9999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Pedido CS-9999 encontrado. Os dados exibidos são fictícios.')).toBeInTheDocument()
    expectCurrent('Em separação')
    expect(screen.getAllByText('#CS-2048')).toHaveLength(1)
    expect(screen.queryByText('#CS-9999')).not.toBeInTheDocument()
  })

  it('shows the 404 message in pt-BR without changing the demo order', async () => {
    await renderLoaded()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'unknown' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Pedido não localizado neste ambiente de demonstração.')).toBeInTheDocument()
    expectCurrent('Em separação')
  })

  it('shows pending search, then network unavailability without a fictitious lookup result', async () => {
    await renderLoaded()
    let rejectSearch!: (reason: unknown) => void
    fetchMock.mockImplementationOnce(() => new Promise((_, reject) => { rejectSearch = reject }))
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(screen.getByText('Buscando pedido…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscando…' })).toBeDisabled()
    await act(async () => { rejectSearch(new TypeError('Failed to fetch')) })
    expect(screen.getByText('Consulta de pedido indisponível no momento. Tente novamente.')).toBeInTheDocument()
    expect(screen.queryByText(/Pedido .*encontrado|Pedido não localizado/)).not.toBeInTheDocument()
    expectCurrent('Em separação')
  })
})
