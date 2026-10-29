import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import DashboardPage from './DashboardPage'
import type { DashboardData } from '../types/dashboard'

vi.mock('@tanstack/react-router', () => ({ Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a> }))
const USER = { id: 'qa-user', email: 'qa@example.com' }
const DATA: DashboardData = {
  demo: true, currency: 'BRL', summary: { totalOrders: 2, registeredValueCents: 30000, averageOrderValueCents: 15000, totalProducts: 1 },
  statusDistribution: ['Pedido confirmado', 'Em separação', 'Em transporte', 'Entregue'].map((label, step) => ({ step, label, count: step === 1 || step === 3 ? 1 : 0 })),
  ordersByDate: [{ date: '2026-10-19', count: 1 }, { date: '2026-10-20', count: 1 }],
  orders: [
    { id: 'CS-2002', productId: 'p', productName: 'Produto segundo', variant: 'Azul', quantity: 2, totalCents: 20000, placedDate: '2026-10-20', currentStep: 3, statusLabel: 'Entregue' },
    { id: 'CS-2001', productId: 'p', productName: 'Produto primeiro', variant: 'Preto', quantity: 1, totalCents: 10000, placedDate: '2026-10-19', currentStep: 1, statusLabel: 'Em separação' },
  ],
  products: [{ id: 'p', name: 'Produto catálogo', category: 'Áudio', priceCents: 10000 }],
}
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
async function ready() {
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: USER, csrfToken: 'csrf-memory' })).mockResolvedValueOnce(json(DATA))
  render(<DashboardPage />)
  await screen.findByText('CS-2002')
}
function table() { return screen.getByRole('table') }
function change(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }) }
beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('SSR e primeiro client sem dados ou seed enquanto bootstrap pendente', async () => {
  const markup = renderToString(<DashboardPage />)
  expect(markup).not.toContain('CS-2048')
  expect(markup).not.toContain('CS-2002')
  expect(fetch).not.toHaveBeenCalled()
  let resolve!: (response: Response) => void
  vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolve = done }))
  render(<DashboardPage />)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await act(async () => { resolve(json({ user: null, csrfToken: 'anonymous' })) })
  expect(await screen.findByRole('link', { name: 'Entrar na sua conta' })).toHaveAttribute('href', '/login')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('sessão confirmada renderiza KPIs reais em BRL, série, distribuição e catálogo sem storage', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem')
  const set = vi.spyOn(Storage.prototype, 'setItem')
  await ready()
  expect(screen.getByText('Dados demonstrativos compartilhados')).toBeInTheDocument()
  expect(screen.getByText(/300,00/)).toBeInTheDocument()
  expect(screen.getByText(/150,00/)).toBeInTheDocument()
  expect(screen.getByText('Produto catálogo')).toBeInTheDocument()
  expect(screen.getAllByText('Entregue').length).toBeGreaterThan(0)
  expect(screen.getByRole('img', { name: 'Entregue: 1 de 2 pedidos' })).toBeInTheDocument()
  expect(screen.getAllByText(/19\/10\/2026|2026-10-19/).length).toBeGreaterThan(0)
  expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/auth/session', '/api/auth/dashboard'])
  expect(get).not.toHaveBeenCalled()
  expect(set).not.toHaveBeenCalled()
})

it('status e busca filtram apenas tabela, preservam KPIs e limpar restaura base', async () => {
  await ready()
  change('Status do pedido', '3')
  expect(within(table()).getByText('CS-2002')).toBeInTheDocument()
  expect(within(table()).queryByText('CS-2001')).not.toBeInTheDocument()
  expect(screen.getByText(/300,00/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
  change('Buscar pedido ou produto', 'PRIMEIRO')
  expect(within(table()).getByText('CS-2001')).toBeInTheDocument()
  expect(within(table()).queryByText('CS-2002')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
  expect(within(table()).getByText('CS-2002')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('intervalo inclusivo filtra tabela, intervalo invertido alerta e limpar remove erro', async () => {
  await ready()
  change('Data inicial', '2026-10-20')
  change('Data final', '2026-10-20')
  expect(within(table()).getByText('CS-2002')).toBeInTheDocument()
  expect(within(table()).queryByText('CS-2001')).not.toBeInTheDocument()
  expect(screen.getByText(/300,00/)).toBeInTheDocument()
  change('Data inicial', '2026-10-21')
  expect(screen.getByRole('alert')).toHaveTextContent(/data|período|intervalo/i)
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(within(table()).getByText('CS-2001')).toBeInTheDocument()
})

it('refresh renderiza etapa somente quando backend confirma, sem mutação POST', async () => {
  await ready()
  let resolve!: (response: Response) => void
  vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolve = done }))
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  const changed = structuredClone(DATA)
  changed.orders[0].currentStep = 0
  changed.orders[0].statusLabel = 'Pedido confirmado'
  changed.statusDistribution[3].count = 0
  changed.statusDistribution[0].count = 1
  await act(async () => { resolve(json(changed)) })
  const row = (await screen.findByText('CS-2002')).closest('tr')!
  expect(within(row).getByText('Pedido confirmado')).toBeInTheDocument()
  expect(vi.mocked(fetch).mock.calls[2][0]).toBe('/api/auth/dashboard')
  expect(vi.mocked(fetch).mock.calls[2][1]?.method ?? 'GET').toBe('GET')
})

it('data indisponível permanece nos KPIs mas não aparece com filtro de data ativo', async () => {
  const unavailable = structuredClone(DATA)
  unavailable.orders[1].placedDate = null
  unavailable.ordersByDate = [{ date: '2026-10-20', count: 1 }]
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: USER, csrfToken: 'csrf-memory' })).mockResolvedValueOnce(json(unavailable))
  render(<DashboardPage />)
  await screen.findByText('CS-2001')
  expect(within(table()).getByText('Data indisponível')).toBeInTheDocument()
  change('Data inicial', '2026-10-19')
  expect(within(table()).queryByText('CS-2001')).not.toBeInTheDocument()
  expect(screen.getByText(/300,00/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
  expect(within(table()).getByText('CS-2001')).toBeInTheDocument()
})

it('refresh401 apaga dados e usuário, mostra login sem bootstrap/seed fallback', async () => {
  await ready()
  vi.mocked(fetch).mockResolvedValueOnce(json({ error: 'Sessão não autenticada' }, 401))
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados' }))
  expect(await screen.findByRole('link', { name: 'Entrar na sua conta' })).toHaveAttribute('href', '/login')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByText('CS-2002')).not.toBeInTheDocument()
  expect(screen.queryByText('CS-2048')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('rede indisponível não mostra dados falsos; retry consulta apenas dashboard confirmado', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: USER, csrfToken: 'csrf-memory' })).mockRejectedValueOnce(new TypeError('offline'))
  render(<DashboardPage />)
  await screen.findByRole('alert')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByText('CS-2048')).not.toBeInTheDocument()
  vi.mocked(fetch).mockResolvedValueOnce(json(DATA))
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByText('CS-2002')
  expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/auth/session', '/api/auth/dashboard', '/api/auth/dashboard'])
})

it('Centro operacional oferece três âncoras com destinos únicos reais', async () => {
  await ready()
  expect(screen.getByRole('heading', { level: 1, name: 'Centro operacional' })).toBeInTheDocument()
  for (const id of ['painel-visao-geral', 'painel-pedidos', 'painel-catalogo']) {
    const links = screen.getAllByRole('link').filter((link) => link.getAttribute('href') === `#${id}`)
    expect(links.length).toBeGreaterThan(0)
    expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1)
    for (const link of links) {
      expect(link).toHaveAccessibleName()
      expect(link.closest('nav')).not.toBeNull()
      expect(link).not.toHaveAttribute('role', 'tab')
    }
  }
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('refresh duplo compartilha uma leitura e não confirma etapa antes de resposta', async () => {
  await ready()
  let resolve!: (response: Response) => void
  vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolve = done }))
  const refresh = screen.getByRole('button', { name: 'Atualizar dados' })
  fireEvent.click(refresh)
  fireEvent.click(refresh)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  expect(refresh).toBeDisabled()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  await act(async () => { resolve(json(DATA)) })
  await screen.findByText('CS-2002')
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('resposta200 após unmount não repovoa nova montagem anônima', async () => {
  let resolve!: (response: Response) => void
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: USER, csrfToken: 'csrf-memory' }))
    .mockReturnValueOnce(new Promise<Response>((done) => { resolve = done }))
  const first = render(<DashboardPage />)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  const signal = vi.mocked(fetch).mock.calls[1][1]?.signal
  first.unmount()
  expect(signal?.aborted).toBe(true)
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'anonymous-new' }))
  render(<DashboardPage />)
  await screen.findByRole('link', { name: 'Entrar na sua conta' })
  await act(async () => { resolve(json(DATA)) })
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByText('CS-2002')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Entrar na sua conta' })).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(3)
})

it.each(['single', 'multi-null'] as const)('gráfico%s e resumo refletem base completa, nunca tabela filtrada', async (kind) => {
  const data = structuredClone(DATA)
  if (kind === 'single') {
    data.orders = [{ ...data.orders[1] }]
    data.summary = { totalOrders: 1, registeredValueCents: 10000, averageOrderValueCents: 10000, totalProducts: 1 }
    data.ordersByDate = [{ date: '2026-10-19', count: 1 }]
    data.statusDistribution.forEach((item) => { item.count = item.step === 1 ? 1 : 0 })
  } else {
    data.orders.push({ ...data.orders[1], id: 'CS-2003', placedDate: '2026-10-19', currentStep: 0, statusLabel: 'Pedido confirmado' })
    data.orders.push({ ...data.orders[1], id: 'CS-2004', placedDate: null, currentStep: 2, statusLabel: 'Em transporte' })
    data.summary = { totalOrders: 4, registeredValueCents: 50000, averageOrderValueCents: 12500, totalProducts: 1 }
    data.ordersByDate[0].count = 2
    data.statusDistribution.forEach((item) => { item.count = 1 })
  }
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: USER, csrfToken: 'csrf-memory' })).mockResolvedValueOnce(json(data))
  render(<DashboardPage />)
  await screen.findByText(kind === 'single' ? 'CS-2001' : 'CS-2004')
  const assertDerived = () => {
    for (const { date, count } of data.ordersByDate) {
      expect(screen.getByRole('img', { name: `${date.split('-').reverse().join('/')}: ${count} pedidos` })).toBeInTheDocument()
    }
    expect(screen.getByRole('img', { name: `Distribuição dos pedidos: ${data.summary.totalOrders} pedidos` })).toBeInTheDocument()
    for (const [label, count] of [
      ['Pedidos em andamento', data.statusDistribution.slice(0, 3).reduce((sum, item) => sum + item.count, 0)],
      ['Pedidos entregues', data.statusDistribution[3].count],
    ] as const) {
      const definition = screen.getByText(label, { selector: 'dt' })
      expect(definition.parentElement?.querySelector('dd')).toHaveTextContent(new RegExp(`^${count}$`))
    }
  }
  assertDerived()
  if (kind === 'multi-null') expect(within(table()).getByText('Data indisponível')).toBeInTheDocument()
  change('Buscar pedido ou produto', 'sem correspondência')
  expect(within(table()).queryByText('CS-2001')).not.toBeInTheDocument()
  assertDerived()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('base vazia exibe quatro KPIs zero, gráfico vazio e catálogo vazio sem divisão inválida', async () => {
  const data = structuredClone(DATA)
  data.summary = { totalOrders: 0, registeredValueCents: 0, averageOrderValueCents: 0, totalProducts: 0 }
  data.orders = []
  data.products = []
  data.ordersByDate = []
  data.statusDistribution.forEach((item) => { item.count = 0 })
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: USER, csrfToken: 'csrf-memory' })).mockResolvedValueOnce(json(data))
  const { container } = render(<DashboardPage />)
  await screen.findByText('Nenhum pedido registrado.')
  const indicators = screen.getByRole('region', { name: 'Indicadores da base completa' })
  for (const [label, value] of [['Pedidos', '0'], ['Valor registrado', 'R$ 0,00'], ['Ticket médio', 'R$ 0,00'], ['Produtos', '0']]) {
    const definition = within(indicators).getByText(label, { selector: 'dt' })
    expect(definition.parentElement?.querySelector('dd')).toHaveTextContent(value)
  }
  expect(screen.getByText('Nenhum pedido com data disponível.')).toBeInTheDocument()
  expect(screen.getByText('Nenhum produto no catálogo.')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Distribuição dos pedidos: 0 pedidos' })).toBeInTheDocument()
  for (const { label } of data.statusDistribution) {
    expect(screen.getByRole('img', { name: `${label}: 0 de 0 pedidos` })).toBeInTheDocument()
  }
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
})
