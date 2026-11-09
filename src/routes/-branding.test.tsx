import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useStore } from '../context/useStore'
import { INITIAL_ORDER, INITIAL_PRODUCTS } from '../services/storeService'
import { Route as IndexRoute } from './index'
import { Route as RootRoute } from './__root'

vi.mock('../context/useStore', () => ({ useStore: vi.fn() }))

const advanceOrder = vi.fn()
const getOrder = vi.fn()
const Page = IndexRoute.options.component!

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useStore).mockReturnValue({
    products: INITIAL_PRODUCTS,
    order: INITIAL_ORDER,
    isLoaded: true,
    loadOrder: vi.fn(),
    advanceOrder,
    getOrder,
  })
})

afterEach(cleanup)

describe('PMI Summit DF experience', () => {
  it('publishes coherent page and Open Graph metadata', () => {
    const head = RootRoute.options.head!({} as never) as { meta: Array<Record<string, string>> }
    expect(head.meta).toEqual(expect.arrayContaining([
      { title: 'PMI SUMMIT DF 360 | Tech Experience' },
      { property: 'og:title', content: 'PMI SUMMIT DF 360 | Tech Experience' },
      { property: 'og:locale', content: 'pt_BR' },
    ]))
    for (const entry of head.meta.filter((meta) => meta.name === 'description' || meta.property === 'og:description')) {
      expect(entry.content).toMatch(/Brasília/)
      expect(entry.content).toMatch(/PMI Summit DF/)
      expect(entry.content).toMatch(/não oficial do PMI/)
    }
    expect(head.meta.filter((meta) => meta.name === 'description' || meta.property === 'og:description')).toHaveLength(2)
  })

  it('contextualizes the hero and catalog while keeping products, tools and anchor actions', () => {
    render(<Page />)
    expect(screen.getByText('PMI SUMMIT DF • TECNOLOGIA EM MOVIMENTO')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Conexões que movem o futuro.')
    expect(screen.getByText(/Projetos, pessoas e inovação se encontram em Brasília/)).toBeInTheDocument()
    expect(screen.getByText('SELEÇÃO PMI SUMMIT DF')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Acompanhar meu pedido ↗' })).toHaveAttribute('href', '#pedidos')
    expect(screen.getByRole('link', { name: 'Explorar produtos' })).toHaveAttribute('href', '#colecao')
    for (const product of INITIAL_PRODUCTS) expect(screen.getByRole('heading', { level: 3, name: product.name })).toBeInTheDocument()
    expect(screen.getAllByText('Lens')).toHaveLength(2)
    expect(screen.getByText('AI COCKPIT EM AÇÃO')).toBeInTheDocument()
    expect(screen.getByText('#CS-2048')).toBeInTheDocument()
  })

  it('keeps the simulator gated by after mode, and advances only the original CS-2048 order', () => {
    render(<Page />)
    const advance = screen.getByRole('button', { name: 'Avançar status do pedido →' })
    expect(advance).toBeDisabled()
    fireEvent.click(advance)
    expect(advanceOrder).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'DEPOIS DA MELHORIA' }))
    expect(advance).toBeEnabled()
    expect(screen.getByText('LINHA DO TEMPO DO PEDIDO')).toBeInTheDocument()
    fireEvent.click(advance)
    expect(advanceOrder).toHaveBeenCalledTimes(1)
    expect(advanceOrder).toHaveBeenCalledWith('CS-2048')
    fireEvent.click(screen.getByRole('button', { name: 'ANTES DA MELHORIA' }))
    expect(advance).toBeDisabled()
    expect(screen.getByText('Seu pedido foi recebido.')).toBeInTheDocument()
  })

  it('preserves restart at the last step and normalized order search feedback', async () => {
    const store = vi.mocked(useStore)()
    vi.mocked(useStore).mockReturnValue({ ...store, order: { ...INITIAL_ORDER, currentStep: 3, statusLabel: 'Entregue' } })
    getOrder.mockResolvedValue({ ok: true, message: 'Pedido CS-2048 encontrado. Os dados exibidos são fictícios.' })
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: 'DEPOIS DA MELHORIA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar simulação ↺' }))
    expect(advanceOrder).toHaveBeenCalledTimes(1)
    expect(advanceOrder).toHaveBeenCalledWith('CS-2048')
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do pedido' }), { target: { value: '#cs-2048 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(screen.getByText('Pedido CS-2048 encontrado. Os dados exibidos são fictícios.')).toBeInTheDocument())
    expect(getOrder).toHaveBeenCalledTimes(1)
    expect(getOrder).toHaveBeenCalledWith('CS-2048')
    getOrder.mockResolvedValue({ ok: false, message: 'Pedido não localizado neste ambiente de demonstração.' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do pedido' }), { target: { value: 'unknown' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(screen.getByText('Pedido não localizado neste ambiente de demonstração.')).toBeInTheDocument())
    expect(screen.getByText('#CS-2048')).toBeInTheDocument()
  })
})
