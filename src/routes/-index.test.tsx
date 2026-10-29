import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_ORDER, INITIAL_PRODUCTS, buildOrderWithEvents, SEED_ORDER_EVENTS } from '../services/storeService'
import { StorefrontPage } from './index'

vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }))

const orderAt = (currentStep: number) => buildOrderWithEvents({
  ...INITIAL_ORDER, currentStep, events: SEED_ORDER_EVENTS,
})

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    return new Response(JSON.stringify(url === '/api/products' ? INITIAL_PRODUCTS : INITIAL_ORDER))
  }))
})

afterEach(() => vi.unstubAllGlobals())

describe('acompanhamento do pedido', () => {
  it('consulta um pedido existente sem trocar o card exibido', async () => {
    render(<StorefrontPage />)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Pedido CS-2048 encontrado. Os dados exibidos são fictícios.')).toBeInTheDocument()
    expect(fetch).toHaveBeenLastCalledWith('/api/orders/CS-2048')
    expect(screen.getAllByText('Em separação')).toHaveLength(2)
  })

  it('exibe as quatro etapas e habilita o simulador por padrão', async () => {
    render(<StorefrontPage />)
    expect(screen.getByText('#CS-2048')).toBeInTheDocument()
    expect(screen.getByText('LINHA DO TEMPO DO PEDIDO')).toBeInTheDocument()
    for (const event of SEED_ORDER_EVENTS) {
      expect(screen.getAllByText(event.title).length).toBeGreaterThan(0)
    }
    await waitFor(() => expect(screen.getByRole('button', { name: /Avançar status do pedido/ })).toBeEnabled())
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/orders/CS-2048'))
  })

  it('atualiza a tela com o retorno do POST e reinicia após a entrega', async () => {
    render(<StorefrontPage />)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    for (const step of [2, 3, 0]) {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(orderAt(step))))
      fireEvent.click(screen.getByRole('button', { name: /Avançar status do pedido|Reiniciar simulação/ }))
      await waitFor(() => expect(screen.getAllByText(orderAt(step).statusLabel)).toHaveLength(2))
      expect(fetch).toHaveBeenLastCalledWith('/api/orders/CS-2048/advance', { method: 'POST' })
    }
  })

  it('mantém o status e informa erro quando o backend falha', async () => {
    render(<StorefrontPage />)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }))
    fireEvent.click(screen.getByRole('button', { name: /Avançar status do pedido/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar o pedido')
    expect(screen.getAllByText('Em separação')).toHaveLength(2)
  })

  it('bloqueia avanços duplicados enquanto aguarda o backend', async () => {
    render(<StorefrontPage />)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    let resolve!: (value: Response) => void
    vi.mocked(fetch).mockReturnValueOnce(new Promise((done) => { resolve = done }))
    fireEvent.click(screen.getByRole('button', { name: /Avançar status do pedido/ }))
    expect(screen.getByRole('button', { name: 'Atualizando pedido…' })).toBeDisabled()
    await act(async () => resolve(new Response(JSON.stringify(orderAt(2)))))
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('consulta a API com ID normalizado e exibe não encontrado em pt-BR', async () => {
    render(<StorefrontPage />)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 404 }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do pedido' }), { target: { value: '  #cs-9999  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Pedido não localizado neste ambiente de demonstração.')).toBeInTheDocument()
    expect(fetch).toHaveBeenLastCalledWith('/api/orders/CS-9999')
  })

  it('não informa pedido encontrado quando a consulta está indisponível', async () => {
    render(<StorefrontPage />)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 503 }))
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Não foi possível consultar o pedido. Tente novamente.')).toBeInTheDocument()
  })
})
