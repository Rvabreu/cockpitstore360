import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CheckoutPage from './CheckoutPage'

const USER = { id: 'user', email: 'qa@example.com' }
const PRODUCTS = [{ id: 'a', name: 'Produto A', price: 12.34 }, { id: 'b', name: 'Produto B', price: 20 }]
const RECEIPT = { id: '22222222-2222-4222-8222-222222222222', items: [{ productId: 'a', name: 'Produto A', quantity: 1, unitPriceCents: 1500, lineTotalCents: 1500 }], totalCents: 1500, currency: 'BRL', paymentStatus: 'simulated', createdAt: '2026-10-29T12:00:00.000Z' }
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
async function ready(user: typeof USER | null = USER, props: { initialProductId?: string; invalidInitialSelection?: boolean } = { initialProductId: 'a' }) {
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (url === '/api/auth/session') return json({ user, csrfToken: 'token' })
    if (url === '/api/products') return json(PRODUCTS)
    throw new Error(`Unexpected request ${String(url)}`)
  })
  const view = render(<CheckoutPage {...props} />)
  await screen.findByRole('combobox', { name: 'Produto para adicionar' })
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Produto para adicionar' })).toBeEnabled())
  return view
}
async function conclude() {
  fireEvent.click(screen.getByRole('button', { name: 'Revisar pedido' }))
  fireEvent.click(screen.getByRole('button', { name: 'Concluir simulação' }))
  await waitFor(() => expect(posts().length).toBe(1))
}
function posts() { return vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/auth/checkout') }
beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('SSR loading determinístico sem request/random/cartfallback/PII', () => {
  const html = renderToString(<CheckoutPage initialProductId="a" />)
  expect(renderToString(<CheckoutPage initialProductId="a" />)).toBe(html)
  const container = document.createElement('div'); container.innerHTML = html
  expect(within(container).getByRole('heading', { level: 1, name: 'Finalizar compra' })).toHaveTextContent('Finalizar compra')
  expect(fetch).not.toHaveBeenCalled()
  expect(container.querySelector('input[name],input[type=password]')).toBeNull()
  expect(html).not.toMatch(/CPF|número do cartão|endereço de entrega/i)
})

it('anônimo edita catálogo real mas requer login para concluir, sem POST/PII/storage', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem'); const set = vi.spyOn(Storage.prototype, 'setItem')
  await ready(null)
  expect(screen.getByRole('spinbutton', { name: 'Quantidade de Produto A' })).toHaveValue(1)
  expect(screen.getByRole('link', { name: 'Entrar para concluir' })).toHaveAttribute('href', '/login')
  expect(screen.queryByRole('button', { name: 'Concluir simulação' })).not.toBeInTheDocument()
  expect(posts()).toHaveLength(0)
  expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled()
})

it.each([{ initialProductId: 'unknown' }, { invalidInitialSelection: true }])('query inválida%j não insere produto fallback', async (props) => {
  await ready(USER, props)
  expect(await screen.findByText('Seleção de produto inválida.')).toBeInTheDocument()
  expect(screen.getByText('Seu carrinho está vazio.')).toBeInTheDocument()
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
})

it('quantidade/add/remove mantém itens atuais e carrinho vazio não conclui', async () => {
  await ready()
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantidade de Produto A' }), { target: { value: '2' } })
  expect(screen.getByRole('spinbutton', { name: 'Quantidade de Produto A' })).toHaveValue(2)
  fireEvent.change(screen.getByRole('combobox', { name: 'Produto para adicionar' }), { target: { value: 'b' } })
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar produto' }))
  expect(screen.getByRole('spinbutton', { name: 'Quantidade de Produto B' })).toHaveValue(1)
  fireEvent.click(screen.getByRole('button', { name: 'Remover Produto A' }))
  fireEvent.click(screen.getByRole('button', { name: 'Remover Produto B' }))
  expect(screen.getByText('Seu carrinho está vazio.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Revisar pedido' })).toBeDisabled()
  expect(posts()).toHaveLength(0)
})

it('pendingdouble umPOST/sucesso sóreceipt confirmado com preço atualizado sem cobrança/storage/log', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem'); const set = vi.spyOn(Storage.prototype, 'setItem')
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  await ready()
  let resolve!: (response: Response) => void
  vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolve = done }))
  fireEvent.click(screen.getByRole('button', { name: 'Revisar pedido' }))
  const submit = screen.getByRole('button', { name: 'Concluir simulação' })
  fireEvent.click(submit); fireEvent.click(submit)
  await waitFor(() => expect(posts()).toHaveLength(1))
  expect(submit).toBeDisabled()
  expect(screen.queryByText('Simulação concluída. Nenhum pagamento foi realizado.')).not.toBeInTheDocument()
  await act(async () => { resolve(json({ receipt: RECEIPT }, 201)) })
  expect(screen.getByRole('status')).toHaveTextContent('Simulação concluída. Nenhum pagamento foi realizado.')
  expect(screen.getByText(/preço.*atualizad/i)).toBeInTheDocument()
  expect(screen.getAllByText(/15,00/).length).toBeGreaterThan(0)
  const body = JSON.parse(posts()[0][1]?.body as string)
  expect(Object.keys(body).sort()).toEqual(['idempotencyKey', 'items'])
  expect(body.items).toEqual([{ productId: 'a', quantity: 1 }])
  expect(body.idempotencyKey).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i)
  expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled()
})

it.each(['network', '500'])('falha%s não autoposta; retry manual mantém exata key/payload', async (failure) => {
  await ready()
  if (failure === 'network') vi.mocked(fetch).mockRejectedValueOnce(new TypeError('network'))
  else vi.mocked(fetch).mockResolvedValueOnce(json({ error: 'private' }, 500))
  await conclude()
  await screen.findByRole('alert')
  const first = posts()[0][1]?.body
  expect(posts()).toHaveLength(1)
  vi.mocked(fetch).mockResolvedValueOnce(json({ receipt: RECEIPT }, 200))
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await waitFor(() => expect(posts()).toHaveLength(2))
  expect(posts()[1][1]?.body).toBe(first)
  await screen.findByText('Simulação concluída. Nenhum pagamento foi realizado.')
})

it('editar tentativa incerta avisa e nova conclusão usa key nova', async () => {
  await ready()
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('network'))
  await conclude(); await screen.findByRole('alert')
  const first = JSON.parse(posts()[0][1]?.body as string)
  fireEvent.click(screen.getByRole('button', { name: 'Editar carrinho' }))
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantidade de Produto A' }), { target: { value: '2' } })
  expect(screen.getByText(/tentativa anterior.*(?:incerta|concluída|confirmad)/i)).toBeInTheDocument()
  vi.mocked(fetch).mockResolvedValueOnce(json({ receipt: { ...RECEIPT, items: [{ ...RECEIPT.items[0], quantity: 2, lineTotalCents: 3000 }], totalCents: 3000 } }, 201))
  fireEvent.click(screen.getByRole('button', { name: 'Revisar pedido' }))
  fireEvent.click(screen.getByRole('button', { name: 'Concluir simulação' }))
  await waitFor(() => expect(posts()).toHaveLength(2))
  const next = JSON.parse(posts()[1][1]?.body as string)
  expect(next.idempotencyKey).not.toBe(first.idempotencyKey)
  expect(next.items).toEqual([{ productId: 'a', quantity: 2 }])
})

it('401 limpa estado autenticado sem seedrecibo;403 snapshot anônimo não reenvia POST', async () => {
  await ready()
  vi.mocked(fetch).mockResolvedValueOnce(json({ error: 'Sessão não autenticada' }, 401))
  await conclude()
  expect(await screen.findByRole('link', { name: 'Entrar para concluir' })).toHaveAttribute('href', '/login')
  expect(screen.queryByText('Simulação concluída. Nenhum pagamento foi realizado.')).not.toBeInTheDocument()
  expect(posts()).toHaveLength(1)
  cleanup(); vi.mocked(fetch).mockClear()
  await ready()
  vi.mocked(fetch).mockResolvedValueOnce(json({ error: 'private' }, 403)).mockResolvedValueOnce(json({ user: null, csrfToken: 'new' }))
  await conclude()
  await screen.findByRole('link', { name: 'Entrar para concluir' })
  expect(posts()).toHaveLength(1)
})

it('unmount ignora receipt atrasado em nova montagem anônima', async () => {
  const view = await ready()
  let resolve!: (response: Response) => void
  vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolve = done }))
  await conclude(); view.unmount()
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (url === '/api/auth/session') return json({ user: null, csrfToken: 'new-token' })
    if (url === '/api/products') return json(PRODUCTS)
    throw new Error(`Unexpected request ${String(url)}`)
  })
  render(<CheckoutPage initialProductId="a" />)
  await act(async () => { resolve(json({ receipt: RECEIPT }, 201)) })
  await screen.findByRole('link', { name: 'Entrar para concluir' })
  expect(screen.queryByText('Simulação concluída. Nenhum pagamento foi realizado.')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Entrar para concluir' })).toBeInTheDocument()
})

it('403 recupera usuário diferente e próxima conclusão manual não reutiliza key da conta anterior', async () => {
  await ready()
  vi.mocked(fetch).mockResolvedValueOnce(json({ error: 'private' }, 403))
    .mockResolvedValueOnce(json({ user: { id: 'other-user', email: 'other@example.com' }, csrfToken: 'other-token' }))
  await conclude(); await screen.findByRole('alert')
  const first = JSON.parse(posts()[0][1]?.body as string)
  expect(screen.getByText('A sessão mudou. A tentativa anterior não será repetida nesta conta.')).toBeInTheDocument()
  expect(posts()).toHaveLength(1)
  vi.mocked(fetch).mockResolvedValueOnce(json({ receipt: RECEIPT }, 201))
  fireEvent.click(screen.getByRole('button', { name: 'Concluir simulação' }))
  await waitFor(() => expect(posts()).toHaveLength(2))
  expect(JSON.parse(posts()[1][1]?.body as string).idempotencyKey).not.toBe(first.idempotencyKey)
  expect(new Headers(posts()[1][1]?.headers).get('X-CSRF-Token')).toBe('other-token')
})
