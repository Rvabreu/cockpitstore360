import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { LocaleProvider } from '../i18n/LocaleProvider'
import { INITIAL_ORDER, INITIAL_PRODUCTS } from '../services/storeService'
import { StorefrontPage } from './index'
import { NotFound } from './__root'

function Storefront() {
  return <LocaleProvider><Header /><StorefrontPage /><Footer /></LocaleProvider>
}

function changeLanguage(language: 'PT Português' | 'ES Español') {
  fireEvent.click(screen.getByRole('button', { name: language }))
}

function expectPortuguesePage() {
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Conecte-se aoque vem depois.')
  expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toHaveTextContent('ProdutosMeus pedidosComo evoluímos')
  expect(screen.getByRole('heading', { name: 'O futuro no seu setup.' })).toBeInTheDocument()
  expect(screen.getByText('Som premium para qualquer jornada.')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Pulse Watch S2' })).toBeInTheDocument()
  expect(screen.getByText('Áudio imersivo')).toBeInTheDocument()
  expect(screen.getByText('Implementação e testes')).toBeInTheDocument()
  expect(screen.getByText('AI Cockpit é a plataforma de referência. Esta loja não é um produto oficial.')).toBeInTheDocument()
}

function expectSpanishPage() {
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Conéctate conlo que viene después.')
  expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toHaveTextContent('ProductosMis pedidosCómo evolucionamos')
  expect(screen.getByRole('heading', { name: 'El futuro en tu setup.' })).toBeInTheDocument()
  expect(screen.getByText('Sonido prémium para cualquier viaje.')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Pulse Reloj S2' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Orbit Auriculares Pro' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Wave Mini Altavoz' })).toBeInTheDocument()
  expect(screen.getByText('Audio inmersivo')).toBeInTheDocument()
  expect(screen.getByText('Implementación y pruebas')).toBeInTheDocument()
  expect(screen.getByText('COCKPIT STORE 360 • Proyecto ficticio para preventa y formación')).toBeInTheDocument()
  expect(screen.getByText('AI Cockpit es la plataforma de referencia. Esta tienda no es un producto oficial.')).toBeInTheDocument()
  expect(screen.queryByText('Som premium para qualquer jornada.')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Meus pedidos' })).not.toBeInTheDocument()
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'pt-BR'
  // Only the HTTP boundary is replaced: the store hook, API response handling,
  // shared provider, dictionaries and every rendered component stay real.
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path === '/api/products') return { ok: true, status: 200, json: async () => INITIAL_PRODUCTS }
    if (path === '/api/orders/CS-2048') return { ok: true, status: 200, json: async () => INITIAL_ORDER }
    if (path.startsWith('/api/orders/')) return { ok: false, status: 404, json: async () => ({}) }
    throw new Error(`Unexpected API request: ${path}`)
  }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Storefront language integration', () => {
  it('switches hero, navigation, all cards, timeline, flow and footer immediately, preserving after mode when returning to Portuguese', async () => {
    const { container } = render(<Storefront />)
    expectPortuguesePage()
    expect(screen.getByText('Ambiente demonstrativo com dados fictícios.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'DEPOIS DA MELHORIA' }))
    expect(screen.getByText('LINHA DO TEMPO DO PEDIDO')).toBeInTheDocument()
    expect(screen.getAllByText('Aguardando atualização')).toHaveLength(2)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const requestsBeforeSwitch = vi.mocked(fetch).mock.calls.length

    changeLanguage('ES Español')

    expectSpanishPage()
    expect(screen.getByText('CRONOLOGÍA DEL PEDIDO')).toBeInTheDocument()
    expect(screen.getAllByText('En preparación')).toHaveLength(2)
    expect(screen.getByText('En transporte')).toBeInTheDocument()
    expect(screen.getByText('Entregado')).toBeInTheDocument()
    expect(screen.getByText('19 oct · 10:12')).toBeInTheDocument()
    expect(screen.getByText('20 oct · 08:35')).toBeInTheDocument()
    expect(screen.getAllByText('Esperando actualización')).toHaveLength(2)
    expect(screen.queryByText('21 oct · 14:20')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avanzar estado del pedido →' })).toBeEnabled()
    expect(screen.getByText('Entorno de demostración con datos ficticios.')).toBeInTheDocument()
    const orbitCard = container.querySelector('article')!
    const spanishPrice = new Intl.NumberFormat('es', { style: 'currency', currency: 'BRL' }).format(699).replace(/\u00a0/g, ' ')
    expect(within(orbitCard).getByText((content) => content.replace(/\u00a0/g, ' ') === spanishPrice)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(requestsBeforeSwitch)

    changeLanguage('PT Português')

    expectPortuguesePage()
    expect(screen.getByText('LINHA DO TEMPO DO PEDIDO')).toBeInTheDocument()
    expect(screen.getAllByText('Em separação')).toHaveLength(2)
    expect(screen.getByText('20 out · 08h35')).toBeInTheDocument()
    expect(screen.getAllByText('Aguardando atualização')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Avançar status do pedido →' })).toBeEnabled()
    expect(localStorage.getItem('store360-locale')).toBe('pt-BR')
    expect(fetch).toHaveBeenCalledTimes(requestsBeforeSwitch)
  })

  it.each([
    ['CS-2048', 'Pedido CS-2048 encontrado. Os dados exibidos são fictícios.', 'Pedido CS-2048 encontrado. Los datos mostrados son ficticios.'],
    ['CS-9999', 'Pedido não localizado neste ambiente de demonstração.', 'Pedido no encontrado en este entorno de demostración.'],
  ])('retranslates completed search feedback for %s without another request or changing the displayed order', async (id, portuguese, spanish) => {
    const { container } = render(<Storefront />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do pedido' }), { target: { value: id } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(portuguese))
    const requestsAfterSearch = vi.mocked(fetch).mock.calls.length

    changeLanguage('ES Español')

    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(spanish)
    expect(screen.queryByText(portuguese)).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Número del pedido' })).toHaveValue(id)
    expect(screen.getByText('#CS-2048')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(requestsAfterSearch)

    changeLanguage('PT Português')
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(portuguese)
    expect(fetch).toHaveBeenCalledTimes(requestsAfterSearch)
  })

  it('keeps the complete server storefront Portuguese despite stored Spanish and restores Spanish after mismatch-free hydration', async () => {
    localStorage.setItem('store360-locale', 'es')
    const html = renderToString(<Storefront />)
    expect(html).toContain('Conecte-se ao')
    expect(html).toContain('Som premium para qualquer jornada.')
    expect(html).not.toContain('Conéctate con')
    expect(fetch).not.toHaveBeenCalled()
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const recoverableError = vi.fn()
    const consoleError = vi.spyOn(console, 'error')
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      await act(async () => {
        root = hydrateRoot(container, <Storefront />, { onRecoverableError: recoverableError })
      })
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Conéctate con'))
      expectSpanishPage()
      expect(recoverableError).not.toHaveBeenCalled()
      expect(consoleError).not.toHaveBeenCalled()
      expect(localStorage.getItem('store360-locale')).toBe('es')
    } finally {
      await act(async () => root?.unmount())
      container.remove()
    }
  })
})

describe('NotFound language integration', () => {
  it('renders the real missing-route page and translates its heading, description and return link in the shared provider', async () => {
    const rootRoute = createRootRoute({
      component: () => <LocaleProvider><Header /><Outlet /><Footer /></LocaleProvider>,
      notFoundComponent: NotFound,
    })
    const home = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <div>Home</div> })
    const router = createRouter({ routeTree: rootRoute.addChildren([home]), history: createMemoryHistory({ initialEntries: ['/does-not-exist'] }), scrollRestoration: () => false })
    await router.load()
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar à loja' })).toHaveAttribute('href', '/')

    changeLanguage('ES Español')

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
    expect(screen.getByText('La ruta a la que intentaste acceder no existe o se ha movido.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a la tienda' })).toHaveAttribute('href', '/')
    changeLanguage('PT Português')
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByText('A rota que você tentou acessar não existe ou foi movida.')).toBeInTheDocument()
  })
})
