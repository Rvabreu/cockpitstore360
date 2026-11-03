import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { Route } from './index'
import { buildOrderWithEvents, INITIAL_ORDER, INITIAL_PRODUCTS, saveOrder } from '../services/storeService'

const Page = Route.options.component!
const fetchMock = vi.fn<typeof fetch>()
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

beforeEach(() => {
  localStorage.clear()
  saveOrder(INITIAL_ORDER)
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url) => response(url === '/api/products' ? INITIAL_PRODUCTS : INITIAL_ORDER))
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function renderLoadedPage() {
  await act(async () => { render(<Page />) })
}

describe('order tracking page', () => {
  it('hydrates the seeded timeline without mismatch when browser cache is already delivered', async () => {
    saveOrder(buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 3 }))
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const html = renderToString(<Page />)
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    expect(container.textContent?.match(/Em separação/g)).toHaveLength(2)
    expect(container.textContent?.match(/Aguardando atualização/g)).toHaveLength(2)
    const onRecoverableError = vi.fn()
    let root!: ReturnType<typeof hydrateRoot>
    try {
      await act(async () => { root = hydrateRoot(container, <Page />, { onRecoverableError }) })
      expect(onRecoverableError).not.toHaveBeenCalled()
      expect(container.textContent?.match(/Entregue/g)).toHaveLength(2)
      expect(container.textContent).not.toContain('Aguardando atualização')
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  it('shows the timeline by default and preserves the before/after comparator', async () => {
    await renderLoadedPage()
    expect(screen.getByText('LINHA DO TEMPO DO PEDIDO')).toBeInTheDocument()
    expect(screen.getAllByText('Aguardando atualização')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'DEPOIS DA MELHORIA' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'ANTES DA MELHORIA' }))
    expect(screen.queryByText('LINHA DO TEMPO DO PEDIDO')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Avançar status/ })).toBeDisabled()
    expect(screen.getByText('Seu pedido foi recebido.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'DEPOIS DA MELHORIA' }))
    expect(screen.getByText('LINHA DO TEMPO DO PEDIDO')).toBeInTheDocument()
  })

  it('disables pending advances and rerenders badge and timeline only after API success', async () => {
    await renderLoadedPage()
    let resolve!: (value: Response) => void
    fetchMock.mockImplementation(() => new Promise((done) => { resolve = done }))
    fireEvent.click(screen.getByRole('button', { name: /Avançar status/ }))
    const pendingButton = screen.getByRole('button', { name: 'Atualizando pedido…' })
    expect(pendingButton).toBeDisabled()
    fireEvent.click(pendingButton)
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
    expect(screen.queryByText('21 out · 14h20')).not.toBeInTheDocument()
    await act(async () => {
      resolve(response(buildOrderWithEvents({ ...INITIAL_ORDER, currentStep: 2 })))
    })
    expect(screen.getAllByText('Em transporte')).toHaveLength(2)
    expect(screen.getAllByText('Em separação')).toHaveLength(1)
    expect(screen.getByText('21 out · 14h20')).toBeInTheDocument()
    expect(screen.getAllByText('Aguardando atualização')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Avançar status/ })).toBeEnabled()
  })

  it.each(['connection', 'http'])('shows a Portuguese error and retains the timeline after %s advance failure', async (failure) => {
    await renderLoadedPage()
    if (failure === 'connection') fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    else fetchMock.mockResolvedValue(response({}, 500))
    fireEvent.click(screen.getByRole('button', { name: /Avançar status/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível avançar o pedido.')
    expect(screen.getAllByText('Em separação')).toHaveLength(2)
    expect(screen.getAllByText('Aguardando atualização')).toHaveLength(2)
    expect(screen.queryByText('21 out · 14h20')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Avançar status/ })).toBeEnabled()
  })

  it('reports successful lookup, missing order and connection failure distinctly without swapping the card', async () => {
    await renderLoadedPage()
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Pedido CS-2048 encontrado. Os dados exibidos são fictícios.')).toBeInTheDocument()
    fetchMock.mockResolvedValue(response({}, 404))
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do pedido' }), { target: { value: 'CS-9999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Pedido não localizado neste ambiente de demonstração.')).toBeInTheDocument()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do pedido' }), { target: { value: 'CS-2048' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Não foi possível consultar o pedido. Verifique sua conexão e tente novamente.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled())
    expect(screen.queryByText('Pedido CS-2048 encontrado. Os dados exibidos são fictícios.')).not.toBeInTheDocument()
    expect(screen.getByText('#CS-2048')).toBeInTheDocument()
    expect(screen.getAllByText('Em separação')).toHaveLength(2)
  })
})
