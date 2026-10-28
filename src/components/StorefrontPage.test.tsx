import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StorefrontPage } from '../routes/index'
import { INITIAL_ORDER, INITIAL_PRODUCTS, buildOrderWithEvents, SEED_ORDER_EVENTS } from '../services/storeService'

function orderAt(currentStep: number) {
  return buildOrderWithEvents({ ...INITIAL_ORDER, currentStep, events: SEED_ORDER_EVENTS })
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    return new Response(JSON.stringify(url === '/api/products' ? INITIAL_PRODUCTS : INITIAL_ORDER))
  }))
})

describe('Acompanhamento do pedido', () => {
  it('TC-UI-02: exibe a melhoria por padrão e alterna para a experiência anterior', async () => {
    render(<StorefrontPage />)
    expect(screen.getByText('LINHA DO TEMPO DO PEDIDO')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /Avançar status/ })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'ANTES DA MELHORIA' }))
    expect(screen.getByText('Seu pedido foi recebido.')).toBeInTheDocument()
    expect(screen.queryByText('LINHA DO TEMPO DO PEDIDO')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Avançar status/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'DEPOIS DA MELHORIA' }))
    expect(screen.getByText('LINHA DO TEMPO DO PEDIDO')).toBeInTheDocument()
  })

  it('TC-UI-03: envia POST e re-renderiza o status confirmado pelo backend, incluindo wrap', async () => {
    let step = 1
    vi.mocked(fetch).mockImplementation(async (url, options) => {
      if (options?.method === 'POST') step = (step + 1) % 4
      return new Response(JSON.stringify(url === '/api/products' ? INITIAL_PRODUCTS : orderAt(step)))
    })
    render(<StorefrontPage />)
    const advance = await screen.findByRole('button', { name: /Avançar status/ })
    await waitFor(() => expect(advance).toBeEnabled())
    fireEvent.click(advance)
    await screen.findByText('Status atualizado: Em transporte.')
    expect(fetch).toHaveBeenCalledWith('/api/orders/CS-2048/advance', { method: 'POST' })
    fireEvent.click(screen.getByRole('button', { name: /Avançar status/ }))
    await screen.findByText('Status atualizado: Entregue.')
    fireEvent.click(screen.getByRole('button', { name: /Reiniciar simulação/ }))
    await screen.findByText('Status atualizado: Pedido confirmado.')
    expect(screen.getAllByText('Aguardando atualização')).toHaveLength(3)
  })

  it('TC-UI-04: busca via API aceita número curto, mostra status e mensagem pt-BR de não encontrado', async () => {
    render(<StorefrontPage />)
    const input = screen.getByRole('textbox', { name: 'Número do pedido' })
    fireEvent.change(input, { target: { value: '2048' } })
    fireEvent.submit(input.closest('form')!)
    await screen.findByText(/Pedido CS-2048 encontrado. Status: Em separação/)
    expect(fetch).toHaveBeenCalledWith('/api/orders/CS-2048')
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Pedido não encontrado' }), { status: 404 }))
    fireEvent.change(input, { target: { value: '9999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await screen.findByText('Pedido não encontrado')
    expect(fetch).toHaveBeenCalledWith('/api/orders/CS-9999')
  })

  it('não simula avanço local quando o backend falha e permite tentar novamente', async () => {
    render(<StorefrontPage />)
    const button = screen.getByRole('button', { name: /Avançar status/ })
    await waitFor(() => expect(button).toBeEnabled())
    vi.mocked(fetch).mockRejectedValue(new Error('Falha de rede'))
    fireEvent.click(button)
    await screen.findByText('Não foi possível atualizar o pedido. Tente novamente.')
    expect(button).toBeEnabled()
    expect(within(document.getElementById('pedidos')!).getAllByText('Em separação')).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem('cockpit_store_order_v1')!).currentStep).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await screen.findByText('Não foi possível consultar o pedido. Tente novamente.')
  })
})
