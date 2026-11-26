import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import type { ComponentType, ReactNode } from 'react'
import { routeTree } from '../routeTree.gen'
import { INITIAL_ORDER, INITIAL_PRODUCTS, buildOrderWithEvents } from '../services/storeService'
import Header from './Header'

// Keep the generated route tree and page components; only replace the document
// shell, which belongs outside the DOM container used by Testing Library.
const rootOptions = routeTree.options as typeof routeTree.options & {
  shellComponent?: ComponentType<{ children: ReactNode }>
}
const originalShell = rootOptions.shellComponent
rootOptions.shellComponent = ({ children }) => <><Header />{children}</>
afterAll(() => { rootOptions.shellComponent = originalShell })

async function renderRoute(path = '/black-friday') {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) })
  await act(async () => {
    await router.load()
    render(<RouterProvider router={router} />)
  })
  return router
}

describe('Black Friday route and shared navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/products') return new Response(JSON.stringify(INITIAL_PRODUCTS))
      if (url.endsWith('/advance') && options?.method === 'POST') {
        return new Response(JSON.stringify(buildOrderWithEvents({
          ...INITIAL_ORDER,
          currentStep: 2,
          events: INITIAL_ORDER.events,
        })))
      }
      if (url === '/api/orders/CS-2048') return new Response(JSON.stringify(INITIAL_ORDER))
      return new Response('{}', { status: 404 })
    }))
  })

  afterEach(() => {
    cleanup()
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    vi.unstubAllGlobals()
  })

  it('renders the generated real route, campaign metadata and current illustrative prices', async () => {
    const originalProducts = structuredClone(INITIAL_PRODUCTS)
    const originalOrder = structuredClone(INITIAL_ORDER)
    const router = await renderRoute()
    expect(screen.getByRole('heading', { level: 1, name: /Black Friday/i })).toBeInTheDocument()
    const campaignMatch = router.state.matches.find((match) => match.routeId === '/black-friday')
    expect(campaignMatch?.meta).toEqual(expect.arrayContaining([
      { title: 'Black Friday | COCKPIT STORE 360' },
      expect.objectContaining({ name: 'description', content: expect.stringContaining('valores demonstrativos') }),
    ]))
    const catalog = screen.getByRole('region', { name: 'Tecnologia em boa companhia.' })
    for (const product of INITIAL_PRODUCTS) {
      expect(within(catalog).getByRole('heading', { name: product.name })).toBeInTheDocument()
      const expectedPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price).replace(/\u00a0/g, ' ')
      expect(within(catalog).getByText((content) => content.replace(/\u00a0/g, ' ') === expectedPrice)).toBeInTheDocument()
      const image = within(catalog).getByRole('img', { name: `Ilustração de ${product.name}` })
      expect(image.querySelector('image')).toHaveAttribute('href', '/assets/hero_produtos.svg')
    }
    expect(within(catalog).getAllByText('Valor demonstrativo')).toHaveLength(3)
    expect(within(screen.getByRole('complementary', { name: 'Destaque da campanha' })).getByText('Valor demonstrativo')).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s*699,00/)).toHaveLength(2)
    expect(screen.getByText(/Campanha ilustrativa\. Produtos fictícios e valores demonstrativos/)).toBeInTheDocument()
    expect(document.querySelector('del, s')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /comprar/i })).not.toBeInTheDocument()
    expect(INITIAL_PRODUCTS).toEqual(originalProducts)
    expect(INITIAL_ORDER).toEqual(originalOrder)
    expect(INITIAL_PRODUCTS.map(({ id, price, image }) => ({ id, price, image }))).toEqual([
      { id: 'prod-orbit', price: 699, image: '/assets/hero_produtos.svg#orbit' },
      { id: 'prod-pulse', price: 899, image: '/assets/hero_produtos.svg#pulse' },
      { id: 'prod-wave', price: 349, image: '/assets/hero_produtos.svg#wave' },
    ])
    expect(vi.mocked(fetch).mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true)
  })

  it('refreshes the catalog and featured price from useStore rather than hardcoded campaign values', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => new Response(JSON.stringify(
      url === '/api/products' ? [{ ...INITIAL_PRODUCTS[0], price: 749, description: 'Descrição atualizada pela loja.' }] : INITIAL_ORDER,
    )))
    await renderRoute()
    await waitFor(() => expect(screen.getAllByText(/R\$\s*749,00/)).toHaveLength(2))
    expect(screen.getAllByText('Descrição atualizada pela loja.')).toHaveLength(2)
    expect(screen.queryByRole('heading', { name: 'Pulse Watch S2' })).not.toBeInTheDocument()
    expect(INITIAL_PRODUCTS[0].price).toBe(699)
  })

  it('uses its own catalog anchor and exposes all cross-route Header links and active campaign', async () => {
    await renderRoute()
    for (const name of ['Explorar seleção', 'Ver no catálogo']) {
      const cta = screen.getByRole('link', { name })
      expect(cta).toHaveAttribute('href', '#catalogo-black-friday')
      expect(document.getElementById(cta.getAttribute('href')!.slice(1))).toBeInTheDocument()
    }
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(nav).not.toHaveClass('hidden')
    expect(nav).toHaveClass('flex-wrap')
    for (const [name, href] of [['Produtos', '/#colecao'], ['Meus pedidos', '/#pedidos'], ['Como evoluímos', '/#fluxo']]) {
      const link = within(nav).getByRole('link', { name })
      expect(link).toHaveAttribute('href', href)
      expect(link.className).toContain('focus-visible:outline-2')
    }
    expect(within(nav).getByRole('link', { name: 'Black Friday' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'COCKPIT STORE 360 — início' })).toHaveAttribute('href', '/#inicio')
    expect(screen.getByRole('link', { name: 'Voltar à loja' })).toHaveAttribute('href', '/#inicio')
  })

  it('announces only the selected home section, with no false current links on home without a hash', async () => {
    const router = await renderRoute('/#pedidos')
    const currentSection = screen.getByRole('link', { name: 'Meus pedidos' })
    expect(currentSection).toHaveAttribute('aria-current', 'location')
    expect(document.querySelectorAll('header a[aria-current]')).toHaveLength(1)
    for (const name of ['COCKPIT STORE 360 — início', 'Produtos', 'Como evoluímos', 'Black Friday']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
    await act(async () => { await router.navigate({ to: '/', hash: '' }) })
    expect(router.state.location.hash).toBe('')
    expect(document.querySelectorAll('header a[aria-current]')).toHaveLength(0)
  })

  it('returns to the unchanged home and preserves order lookup and advancement', async () => {
    const router = await renderRoute()
    fireEvent.click(screen.getByRole('link', { name: 'Conhecer acompanhamento' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(router.state.location.hash).toBe('pedidos')
    expect(await screen.findByRole('heading', { name: /Conecte-se ao que vem depois/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Avançar status do pedido/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'DEPOIS DA MELHORIA' }))
    fireEvent.click(screen.getByRole('button', { name: /Avançar status do pedido/ }))
    await waitFor(() => expect(screen.getAllByText('Em transporte')).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Pedido CS-2048 encontrado. Os dados exibidos são fictícios.')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do pedido' }), { target: { value: 'CS-0000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Pedido não localizado neste ambiente de demonstração.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Black Friday' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Black Friday/i })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/black-friday')
  })
})
