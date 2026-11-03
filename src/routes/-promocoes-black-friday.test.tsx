import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { AuthProvider, useAuth } from '../context/auth'
import Header from '../components/Header'
import { INITIAL_PRODUCTS } from '../server/seed'
import { useStore } from '../context/useStore'
import { CAMPAIGN_END } from '../services/blackFridayPromotions'
import { BlackFridayPromotionsPage } from './promocoes-black-friday'

vi.mock('../context/useStore', () => ({ useStore: vi.fn() }))
const session = (authenticated = false) => new Response(JSON.stringify({ user: authenticated ? { authenticated: true } : null, csrfToken: 'test-csrf' }))
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-03T20:00:00Z'))
  vi.mocked(useStore).mockReturnValue({ products: INITIAL_PRODUCTS } as ReturnType<typeof useStore>)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
function SessionControls() {
  const { login, refresh } = useAuth()
  return <><button onClick={() => void login('existing@example.com', 'existing-password')}>Login original de teste</button><button onClick={() => void refresh()}>Restaurar Google de teste</button></>
}
function mount() { render(<AuthProvider><Header /><BlackFridayPromotionsPage /><SessionControls /></AuthProvider>) }
async function ready() { await screen.findByRole('link', { name: 'Entrar com senha ou Google' }) }
function cards() { return within(screen.getByLabelText('Produtos filtrados')).getAllByRole('article') }

describe('promotion catalog page', () => {
  it('SSR has stable deadline, full catalog and disabled simulation without network', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    const html = renderToString(<AuthProvider><BlackFridayPromotionsPage /></AuthProvider>)
    expect(html).toContain('Calculando prazo'); expect(html).toContain('— dias')
    for (const product of INITIAL_PRODUCTS) expect(html).toContain(product.name)
    expect(html).toContain('Verificando sessão VIP'); expect(fetchMock).not.toHaveBeenCalled()
  })
  it('shows coherent prices/savings, campaign navigation and truthful fake metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(session())); mount(); await ready()
    expect(screen.getByRole('link', { name: 'Promoções BF' })).toHaveAttribute('href', '/promocoes-black-friday')
    expect(screen.getByRole('link', { name: /campanha e passe VIP/ })).toHaveAttribute('href', '/black-friday')
    expect(screen.getByRole('link', { name: 'Entrar com senha ou Google' })).toHaveAttribute('href', '/login?returnTo=%2Fpromocoes-black-friday')
    const wave = within(cards()[0]); expect(wave.getByRole('heading')).toHaveTextContent('Wave Mini Speaker')
    expect(wave.getByText(/R\$\s*349,00/)).toHaveProperty('tagName', 'DEL')
    expect(wave.getByText(/R\$\s*139,60/)).toBeInTheDocument()
    expect(wave.getByText(/Economia R\$\s*209,40 · 60% OFF/)).toBeInTheDocument()
    expect(wave.getByText(/Popularidade fictícia: 1050 pontos \(não são vendas\)/)).toBeInTheDocument()
    expect(wave.getByRole('meter')).toHaveAttribute('value', '12')
  })
  it('combines category/discount/flash/VIP, shows count and empty state then resets all controls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(session())); mount(); await ready()
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Áudio conectado' } })
    fireEvent.change(screen.getByLabelText('Faixa de desconto'), { target: { value: '50plus' } })
    fireEvent.click(screen.getByLabelText('Ofertas relâmpago')); fireEvent.click(screen.getByLabelText('Exclusivas VIP'))
    expect(screen.getByText('1 de 3 produtos exibidos')).toBeInTheDocument(); expect(cards()).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Wearables' } })
    expect(screen.getByText('0 de 3 produtos exibidos')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nenhuma oferta nesta combinação.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver todo o catálogo' }))
    expect(cards()).toHaveLength(3); expect(screen.getByLabelText('Categoria')).toHaveValue('')
    expect(screen.getByLabelText('Ofertas relâmpago')).not.toBeChecked(); expect(screen.getByLabelText('Exclusivas VIP')).not.toBeChecked()
  })
  it('orders by discount, price and simulated popularity and resets sorting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(session())); mount(); await ready()
    expect(cards().map((card) => card.getAttribute('aria-label'))).toEqual(['Wave Mini Speaker', 'Pulse Watch S2', 'Orbit Headphones Pro'])
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'price' } })
    expect(cards().map((card) => card.getAttribute('aria-label'))).toEqual(['Wave Mini Speaker', 'Orbit Headphones Pro', 'Pulse Watch S2'])
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'popular' } })
    expect(cards()[1]).toHaveAttribute('aria-label', 'Orbit Headphones Pro')
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros e ordenação' }))
    expect(screen.getByLabelText('Ordenar por')).toHaveValue('discount')
  })
  it('does not omit future catalog products or invent promotional metadata', async () => {
    vi.mocked(useStore).mockReturnValue({ products: [...INITIAL_PRODUCTS, { ...INITIAL_PRODUCTS[0], id: 'future-product', name: 'Novo essencial', category: 'Nova categoria', price: 123.45 }] } as ReturnType<typeof useStore>)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(session())); mount(); await ready()
    expect(cards()).toHaveLength(4); expect(screen.getByRole('option', { name: 'Nova categoria' })).toBeInTheDocument()
    const future = within(screen.getByRole('article', { name: 'Novo essencial' }))
    expect(future.getByText('0% · CATÁLOGO')).toBeInTheDocument(); expect(future.getByText('Popularidade não simulada.')).toBeInTheDocument()
    expect(future.getByText('Sem estoque promocional simulado.')).toBeInTheDocument()
  })
  it('shows flash end state and disables all benefits at exact campaign deadline', async () => {
    vi.mocked(Date.now).mockReturnValue(CAMPAIGN_END)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(session(true))); mount()
    await screen.findByText(/Passe VIP ativo/)
    expect(screen.getByRole('heading', { name: 'Ofertas relâmpago encerradas.' })).toBeInTheDocument()
    expect(screen.getByLabelText('Tempo restante das ofertas relâmpago')).toHaveTextContent('0 dias · 00:00:00')
    expect(screen.getAllByText('Oferta encerrada')).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Produto para simular'), { target: { value: 'prod-orbit' } })
    expect(screen.getByRole('button', { name: 'Simular cupom BLACK10' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Simular combo VIP' })).toBeDisabled()
  })
  it('updates the deadline live and hides a previous simulation when campaign expires', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(CAMPAIGN_END - 1000)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(session(true)))
    await act(async () => { mount() })
    fireEvent.change(screen.getByLabelText('Produto para simular'), { target: { value: 'prod-orbit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simular cupom BLACK10' }))
    expect(screen.getByText(/Simulação: subtotal Black/)).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByText(/Simulação: subtotal Black/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular cupom BLACK10' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Ofertas relâmpago encerradas.' })).toBeInTheDocument()
  })
  it('does not synthesize a combo when a component is missing from the live catalog', async () => {
    vi.mocked(useStore).mockReturnValue({ products: INITIAL_PRODUCTS.slice(0, 2) } as ReturnType<typeof useStore>)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(session(true))); mount(); await screen.findByText(/Passe VIP ativo/)
    expect(screen.getByText(/Combo indisponível: os dois produtos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular combo VIP' })).toBeDisabled()
  })
})

describe('VIP session and simulations', () => {
  it.each(['Login original de teste', 'Restaurar Google de teste'])('unlocks VIP immediately via %s and relocks after logout', async (action) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(session()).mockResolvedValueOnce(session(true)).mockResolvedValueOnce(session()))
    mount(); await ready(); expect(screen.getAllByRole('link', { name: 'Desbloquear oferta VIP' })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: action }))
    await screen.findByText(/Passe VIP ativo/)
    expect(screen.getAllByText('Oferta VIP liberada')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Simular combo VIP' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Simular combo VIP' }))
    expect(screen.getByText(/Simulação VIP/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sair' })); await ready()
    expect(screen.getByRole('button', { name: 'Simular combo VIP' })).toBeDisabled()
    expect(screen.queryByText(/Simulação VIP/)).not.toBeInTheDocument()
  })
  it('restores any existing user and keeps filters available during loading', async () => {
    let resolve!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(new Promise<Response>((r) => { resolve = r })))
    mount(); expect(screen.getByText('Verificando sessão VIP…')).toBeInTheDocument()
    expect(screen.getByLabelText('Categoria')).toBeEnabled(); expect(screen.getByRole('button', { name: 'Simular combo VIP' })).toBeDisabled()
    await act(async () => { resolve(session(true)) })
    expect(screen.getAllByText('Oferta VIP liberada')).toHaveLength(2)
  })
  it('handles restore failure without false VIP access, supports retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(session(true)))
    mount(); await screen.findByRole('alert')
    expect(screen.queryByText('Oferta VIP liberada')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Verificar sessão novamente' }))
    await screen.findByText(/Passe VIP ativo/)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('simulates coupon cents and eligibility and combo without POST/storage/checkout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(session(true)); vi.stubGlobal('fetch', fetchMock)
    const storage = vi.spyOn(Storage.prototype, 'setItem'); mount(); await screen.findByText(/Passe VIP ativo/)
    fireEvent.change(screen.getByLabelText('Produto para simular'), { target: { value: 'prod-orbit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simular cupom BLACK10' }))
    expect(screen.getByText(/Simulação: subtotal Black R\$\s*419,40 − cupom R\$\s*41,94 = R\$\s*377,46/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Produto para simular'), { target: { value: 'prod-pulse' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simular cupom BLACK10' }))
    expect(screen.getByText(/Cupom não aplicável/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Simular combo VIP' }))
    expect(screen.getByText(/Simulação VIP: R\$\s*531,05 pela dupla/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(storage).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /comprar|checkout|reservar/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    // Logout response deliberately authenticated: no local fake logout.
    await screen.findByRole('alert'); expect(screen.getByText(/Simulação VIP/)).toBeInTheDocument()
  })
})
