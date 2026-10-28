import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DashboardPage } from './dashboard'
import { buildOrderWithEvents } from '../services/storeService'
import type { Product } from '../types/store'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}))

const products: Product[] = [
  { id: 'a', name: 'Fone Aurora', category: 'Áudio', description: 'Fone', image: '/a.svg', price: 125.5, createdAt: '2026-10-01' },
  { id: 'b', name: 'Caixa Horizonte', category: 'Áudio', description: 'Caixa', image: '/b.svg', price: 50, createdAt: '2026-10-02' },
  { id: 'c', name: 'Relógio Sol', category: 'Wearables', description: 'Relógio', image: '/c.svg', price: 300, createdAt: '2026-10-03' },
  { id: 'd', name: 'Relógio Lua', category: 'Wearables', description: 'Relógio', image: '/d.svg', price: 400, createdAt: '2026-10-04' },
  { id: 'e', name: 'Luminária', category: 'Casa', description: 'Luz', image: '/e.svg', price: 80, createdAt: '2026-10-05' },
]
const order = buildOrderWithEvents({
  id: 'CS-2048', productId: 'a', productName: 'Fone Aurora', variant: 'Grafite', quantity: 2,
  total: 251, placedAt: '28/10/2026', currentStep: 2,
  events: [{ title: 'Confirmado', detail: '26 out' }, { title: 'Separação', detail: '27 out' }, { title: 'Em transporte', detail: '28 out' }, { title: 'Entregue', detail: 'Entrega confirmada' }],
})
const fetchMock = vi.fn()
function response(data: unknown, ok = true) { return { ok, json: async () => data } as Response }
function successfulReads(catalog: unknown = products, demoOrder: unknown = order) {
  fetchMock.mockImplementation(async (url: string) => response(url === '/api/products' ? catalog : demoOrder))
}
async function ready() { await screen.findByRole('region', { name: 'Indicadores demonstrativos' }) }
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); successfulReads() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('Dashboard público demonstrativo', () => {
  it('carrega sem métricas seed e bloqueia atualizar enquanto consulta as duas APIs somente leitura', async () => {
    let resolveProducts!: (value: Response) => void
    let resolveOrder!: (value: Response) => void
    fetchMock.mockImplementation((url: string) => new Promise<Response>((resolve) => {
      if (url === '/api/products') resolveProducts = resolve
      else resolveOrder = resolve
    }))
    render(<DashboardPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando catálogo e pedido demonstrativo')
    expect(screen.getByRole('button', { name: 'Atualizando...' })).toBeDisabled()
    expect(screen.queryByRole('article', { name: 'Produtos no catálogo' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizando...' }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await act(async () => { resolveProducts(response(products)) })
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    await act(async () => { resolveOrder(response(order)) })
    await ready()
    expect(fetchMock).toHaveBeenCalledWith('/api/products', { signal: expect.any(AbortSignal), cache: 'no-store' })
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/CS-2048', { signal: expect.any(AbortSignal), cache: 'no-store' })
    expect(screen.getByRole('button', { name: 'Atualizar dados' })).toBeEnabled()
  })

  it('deriva indicadores, percentuais e timeline dos dados recebidos com formato pt-BR', async () => {
    render(<DashboardPage />)
    await ready()
    expect(within(screen.getByRole('article', { name: 'Produtos no catálogo' })).getByText('5')).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Categorias distintas' })).getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Valor do pedido demo' })).toHaveTextContent(/R\$\s*251,00/)
    expect(screen.getByRole('article', { name: 'Status do pedido demo' })).toHaveTextContent('Em transporteEtapa 3 de 4')
    const distribution = screen.getByRole('region', { name: 'Distribuição do catálogo' })
    expect(within(distribution).getAllByText('2 produtos · 40%')).toHaveLength(2)
    expect(within(distribution).getByText('1 produto · 20%')).toBeInTheDocument()
    const timeline = screen.getByRole('list', { name: 'Etapas do pedido' })
    expect(within(timeline).getByText('Etapa atual').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(within(timeline).getByText('Aguardando atualização')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Pedido #CS-2048' })).toHaveTextContent('Quantidade: 2')
    expect(screen.getByRole('region', { name: 'Catálogo em resumo' })).toHaveTextContent(/R\$\s*125,50/)
  })

  it('permite busca por nome/categoria sem diferenciar maiúsculas, filtro combinado e vazio recuperável', async () => {
    render(<DashboardPage />)
    await ready()
    const catalog = screen.getByRole('region', { name: 'Catálogo em resumo' })
    const search = screen.getByRole('searchbox', { name: 'Buscar por nome ou categoria' })
    const category = screen.getByRole('combobox', { name: 'Categoria' })
    fireEvent.change(search, { target: { value: '  AURORA  ' } })
    expect(within(catalog).getByRole('heading', { name: 'Fone Aurora' })).toBeInTheDocument()
    expect(within(catalog).queryByRole('heading', { name: 'Relógio Sol' })).not.toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'áUDIO' } })
    expect(within(catalog).getByText('2 de 5 produtos')).toBeInTheDocument()
    fireEvent.change(category, { target: { value: 'Casa' } })
    expect(within(catalog).getByRole('status')).toHaveTextContent('Nenhum produto encontrado')
    fireEvent.change(search, { target: { value: '' } })
    expect(within(catalog).getByRole('heading', { name: 'Luminária' })).toBeInTheDocument()
    fireEvent.change(category, { target: { value: '' } })
    expect(within(catalog).getByText('5 de 5 produtos')).toBeInTheDocument()
  })

  it('mostra catálogo vazio válido com zero categorias sem divisão por zero', async () => {
    successfulReads([])
    render(<DashboardPage />)
    await ready()
    expect(within(screen.getByRole('article', { name: 'Produtos no catálogo' })).getByText('0')).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Categorias distintas' })).getByText('0')).toBeInTheDocument()
    expect(screen.getByText('O catálogo ainda não tem categorias.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Nenhum produto disponível')
  })

  it.each(['http', 'network', 'json'])('mostra erro explícito %s sem seed/fallback e permite nova leitura', async (failure) => {
    fetchMock.mockImplementation(async () => {
      if (failure === 'network') throw new TypeError('Failed to fetch')
      if (failure === 'json') return { ok: true, json: async () => { throw new SyntaxError('invalid JSON') } }
      return response({}, false)
    })
    render(<DashboardPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Dados indisponíveis')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.queryByText('Orbit Headphones Pro')).not.toBeInTheDocument()
    successfulReads()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados' }))
    await ready()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    { label: 'preço inválido', catalog: [{ ...products[0], price: -1 }], demoOrder: order },
    { label: 'produto incompleto', catalog: [{ id: 'a' }], demoOrder: order },
    { label: 'envelope errado', catalog: { products }, demoOrder: order },
    { label: 'pedido inesperado', catalog: products, demoOrder: { ...order, id: 'CS-9999' } },
    { label: 'etapa fora do intervalo', catalog: products, demoOrder: { ...order, currentStep: 99 } },
    { label: 'status incoerente', catalog: products, demoOrder: { ...order, statusLabel: 'Entregue' } },
    { label: 'timeline incoerente', catalog: products, demoOrder: { ...order, events: order.events.map((event) => ({ ...event, status: 'done' })) } },
  ])('rejeita resposta com $label sem mostrar métricas parciais', async ({ catalog, demoOrder }) => {
    successfulReads(catalog, demoOrder)
    render(<DashboardPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Os dados recebidos são inválidos')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('atualiza métricas com novas leituras e remove snapshot antigo caso refresh falhe', async () => {
    render(<DashboardPage />)
    await ready()
    successfulReads(products.slice(0, 1), { ...order, total: 125.5 })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados' }))
    await ready()
    expect(within(screen.getByRole('article', { name: 'Produtos no catálogo' })).getByText('1')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Valor do pedido demo' })).toHaveTextContent(/R\$\s*125,50/)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    fetchMock.mockRejectedValue(new TypeError('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('aborta ao desmontar e ignora respostas antigas no ciclo StrictMode', async () => {
    const resolvers: Array<(value: Response) => void> = []
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => resolvers.push(resolve)))
    const { unmount } = render(<StrictMode><DashboardPage /></StrictMode>)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => { resolvers[2](response(products)); resolvers[3](response(order)) })
    await ready()
    await act(async () => { resolvers[0](response([])); resolvers[1](response({ ...order, total: 0 })) })
    expect(within(screen.getByRole('article', { name: 'Produtos no catálogo' })).getByText('5')).toBeInTheDocument()
    unmount()
    expect(fetchMock.mock.calls[2][1].signal.aborted).toBe(true)
  })

  it('limita consulta lenta a 15s e ignora resolução após timeout', async () => {
    vi.useFakeTimers()
    const resolvers: Array<(value: Response) => void> = []
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => resolvers.push(resolve)))
    render(<DashboardPage />)
    await act(async () => { vi.advanceTimersByTime(15000) })
    expect(screen.getByRole('alert')).toHaveTextContent('A consulta demorou mais que o esperado')
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => { resolvers[0](response(products)); resolvers[1](response(order)) })
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualizar dados' })).toBeEnabled()
  })

  it('identifica o painel público demo e oferece apenas destinos reais sem gate de autenticação', async () => {
    render(<DashboardPage />)
    await ready()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Painel da loja' })).toBeInTheDocument()
    expect(screen.getByText('Dados demonstrativos')).toBeInTheDocument()
    expect(screen.getByText(/Público, fictício e sem indicadores de vendas/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Visitar loja' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'acesse sua conta' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Ver demonstração na loja' })).toHaveAttribute('href', '/#pedidos')
    expect(screen.getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '#catalogo-dashboard')
    expect(screen.getByRole('link', { name: 'Pedido demo' })).toHaveAttribute('href', '#pedido-dashboard')
  })
})
