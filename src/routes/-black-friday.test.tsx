import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { AuthProvider } from '../context/auth'
import Header from '../components/Header'
import { INITIAL_PRODUCTS } from '../server/seed'
import { BlackFridayPage, CAMPAIGN_END } from './black-friday'
import { OTP_ERROR } from '../services/authService'

vi.mock('../context/useStore', () => ({ useStore: () => ({ products: INITIAL_PRODUCTS }) }))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const session = (authenticated = false, csrfToken = 'csrf-initial') => json({ user: authenticated ? { authenticated: true } : null, csrfToken })
const challenge = (demo = true, expiresAt = Date.now() + 300_000) => json({ expiresAt, demo, demoCode: '123456' })
function mount() { render(<AuthProvider><Header /><BlackFridayPage /></AuthProvider>) }
async function ready() { await waitFor(() => expect(screen.getByRole('button', { name: 'Solicitar código VIP' })).toBeEnabled()) }
async function request() {
  await ready()
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: ' vip@example.com ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar código VIP' }))
  await screen.findByLabelText('Código de seis dígitos')
}

describe('Black Friday editorial and session', () => {
  it('SSR renders catalog, locked offers and stable countdown without fetch', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    const markup = renderToString(<AuthProvider><BlackFridayPage /></AuthProvider>)
    expect(markup).toContain('BLACK'); expect(markup).toContain('FRIDAY')
    expect(markup).toContain('Calculando tempo restante')
    expect(markup).toContain('Orbit Headphones Pro')
    expect(markup).toContain('Desbloquear oferta VIP')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(CAMPAIGN_END).toBe(Date.parse('2026-11-28T03:00:00Z'))
  })

  it('renders coherent fictional prices, stock and navigation with locked VIP cards', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(session())); mount(); await ready()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('BLACKFRIDAY')
    expect(screen.getByRole('link', { name: 'Black Friday' })).toHaveAttribute('href', '/black-friday')
    expect(screen.getByRole('link', { name: /Todas as promoções, filtros e benefícios/ })).toHaveAttribute('href', '/promocoes-black-friday')
    expect(screen.getByRole('link', { name: 'Use seu acesso original.' })).toHaveAttribute('href', '/login?returnTo=%2Fblack-friday')
    expect(screen.getByText('PASSE VIP BLACK FRIDAY / 01 DE 02')).toBeInTheDocument()
    expect(screen.getByText('Login instantâneo sem senha · Código único')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Desbloquear oferta VIP' })).toHaveLength(2)
    const pulse = within(screen.getByRole('article', { name: 'Pulse Watch S2' }))
    expect(pulse.getByText('−50%')).toBeInTheDocument()
    expect(pulse.getByText(/R\$\s*899,00/)).toHaveProperty('tagName', 'DEL')
    expect(pulse.getByText(/^R\$\s*449,50$/)).toHaveProperty('tagName', 'STRONG')
    expect(pulse.getByText(/Economia R\$\s*449,50/)).toBeInTheDocument()
    expect(pulse.getByRole('meter')).toHaveAttribute('value', '8')
    expect(pulse.getByRole('meter')).toHaveAttribute('max', '40')
    expect(screen.getByText(/Valores e unidades simulados/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /comprar|checkout/i })).not.toBeInTheDocument()
  })

  it('immediately unlocks all VIP cards for any existing authenticated session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(session(true)); vi.stubGlobal('fetch', fetchMock); mount()
    await screen.findByText('Você está na lista.')
    expect(screen.getAllByText('Oferta VIP liberada')).toHaveLength(2)
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Conta conectada' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    // Mock server stays authenticated: logout must not locally pretend it succeeded.
    await screen.findByRole('alert')
    expect(screen.getAllByText('Oferta VIP liberada')).toHaveLength(2)
  })

  it('locks cards again only after confirmed logout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(session(true)).mockResolvedValueOnce(session())); mount()
    await screen.findByText('Você está na lista.')
    fireEvent.click(screen.getByRole('button', { name: 'Sair' })); await ready()
    expect(screen.getAllByRole('link', { name: 'Desbloquear oferta VIP' })).toHaveLength(2)
  })

  it('clamps campaign countdown at zero after the exact end date', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(CAMPAIGN_END + 1000)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(session())); mount(); await ready()
    expect(screen.getByRole('heading', { name: 'Campanha encerrada.' })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Tempo restante da campanha')).getAllByText('00')).toHaveLength(4)
  })
  it.each([false, true])('ends all offers at exact deadline, authenticated=%s, without claiming session reactivation', async (authenticated) => {
    vi.spyOn(Date, 'now').mockReturnValue(CAMPAIGN_END)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(session(authenticated))); mount()
    if (authenticated) await screen.findByText('Você está na lista.')
    else await ready()
    expect(screen.getByRole('heading', { name: 'Campanha encerrada.' })).toBeInTheDocument()
    expect(screen.getAllByText('Oferta encerrada')).toHaveLength(3)
    expect(screen.getAllByText(/Preço histórico fictício/)).toHaveLength(3)
    expect(screen.queryByText('Oferta VIP liberada')).not.toBeInTheDocument()
    expect(screen.queryByText('Oferta aberta para você')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Desbloquear oferta VIP' })).not.toBeInTheDocument()
    expect(screen.getByText(/Login e código único continuam disponíveis/)).toBeInTheDocument()
    if (authenticated) expect(screen.getByText('Sua sessão está ativa. A campanha terminou e as ofertas permanecem encerradas.')).toBeInTheDocument()
    else expect(screen.getByRole('button', { name: 'Solicitar código VIP' })).toBeEnabled()
  })
  it('expires live while an OTP is pending and still authenticates without reopening offers', async () => {
    vi.useFakeTimers(); vi.setSystemTime(CAMPAIGN_END - 1000)
    const fetchMock = vi.fn().mockResolvedValueOnce(session()).mockResolvedValueOnce(challenge(true, CAMPAIGN_END + 300_000)).mockResolvedValueOnce(session(true))
    vi.stubGlobal('fetch', fetchMock)
    await act(async () => { mount() })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'vip@example.com' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Solicitar código VIP' })) })
    expect(screen.getByRole('button', { name: 'Validar e liberar VIP' })).toBeEnabled()
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.getAllByText('Oferta encerrada')).toHaveLength(3)
    expect(screen.getByLabelText('Código de seis dígitos')).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Código de seis dígitos'), { target: { value: '123456' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Validar e acessar conta' })) })
    expect(screen.getByText('Sua sessão está ativa. A campanha terminou e as ofertas permanecem encerradas.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Conta conectada' })).toBeInTheDocument()
    expect(screen.getAllByText('Oferta encerrada')).toHaveLength(3)
    expect(screen.queryByText('Oferta VIP liberada')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls[2][0]).toBe('/api/auth/otp/verify')
  })
})

describe('VIP one-time code flow', () => {
  it('blocks request after failed restore and offers session retry', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(session())
    vi.stubGlobal('fetch', fetchMock); mount()
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Solicitar código VIP' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Verificar sessão novamente' }))
    await ready()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('validates email and focuses invalid input without request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(session()); vi.stubGlobal('fetch', fetchMock); mount(); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar código VIP' }))
    expect(screen.getByLabelText('E-mail')).toHaveFocus()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('requests exact payload with CSRF, clearly exposes only demo code and focuses code', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(session()).mockResolvedValueOnce(challenge())
    vi.stubGlobal('fetch', fetchMock); mount(); await request()
    await waitFor(() => expect(screen.getByLabelText('Código de seis dígitos')).toHaveFocus())
    expect(screen.getByText('MODO DEMONSTRAÇÃO · SEM ENVIO DE E-MAIL')).toBeInTheDocument()
    expect(screen.getByText('123456')).toBeInTheDocument()
    expect(screen.getByLabelText('Código de seis dígitos')).toHaveValue('')
    expect(screen.getByLabelText('Código de seis dígitos')).toHaveAttribute('autocomplete', 'one-time-code')
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toBe('/api/auth/otp/request'); expect(JSON.parse(init.body)).toEqual({ email: 'vip@example.com' })
    expect(init.headers.get('X-CSRF-Token')).toBe('csrf-initial')
    expect(init.credentials).toBe('same-origin')
  })

  it('never displays demoCode on a non-demo response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(session()).mockResolvedValueOnce(challenge(false)))
    mount(); await request()
    expect(screen.queryByText('123456')).not.toBeInTheDocument()
    expect(screen.queryByText(/MODO DEMONSTRAÇÃO/)).not.toBeInTheDocument()
  })

  it('accepts six digits, verifies through provider and immediately updates Header and cards without storage', async () => {
    const storageRead = vi.spyOn(Storage.prototype, 'getItem'); const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const fetchMock = vi.fn().mockResolvedValueOnce(session()).mockResolvedValueOnce(challenge()).mockResolvedValueOnce(session(true, 'csrf-rotated'))
    vi.stubGlobal('fetch', fetchMock); mount(); await request()
    fireEvent.change(screen.getByLabelText('Código de seis dígitos'), { target: { value: '12a3456' } })
    expect(screen.getByLabelText('Código de seis dígitos')).toHaveValue('123456')
    fireEvent.click(screen.getByRole('button', { name: 'Validar e liberar VIP' }))
    await screen.findByText('Você está na lista.')
    expect(screen.getByRole('link', { name: 'Conta conectada' })).toBeInTheDocument()
    expect(screen.getAllByText('Oferta VIP liberada')).toHaveLength(2)
    expect(screen.queryByText('123456')).not.toBeInTheDocument()
    expect(screen.getByText('Você está na lista.').closest('[role="status"]')).toHaveFocus()
    expect(fetchMock.mock.calls[2][0]).toBe('/api/auth/otp/verify')
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ email: 'vip@example.com', code: '123456' })
    expect(storageRead).not.toHaveBeenCalled(); expect(storageWrite).not.toHaveBeenCalled()
  })

  it('prevents duplicate requests and verification submissions', async () => {
    let resolveRequest!: (value: Response) => void; let resolveVerify!: (value: Response) => void
    const fetchMock = vi.fn().mockResolvedValueOnce(session())
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveRequest = resolve }))
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveVerify = resolve }))
    vi.stubGlobal('fetch', fetchMock); mount(); await ready()
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'vip@example.com' } })
    const form = screen.getByLabelText('E-mail').closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Solicitando…' })).toBeDisabled()
    resolveRequest(challenge()); await screen.findByLabelText('Código de seis dígitos')
    fireEvent.change(screen.getByLabelText('Código de seis dígitos'), { target: { value: '123456' } })
    const verifyForm = screen.getByLabelText('Código de seis dígitos').closest('form')!
    fireEvent.submit(verifyForm); fireEvent.submit(verifyForm)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('button', { name: 'Validando…' })).toBeDisabled()
    resolveVerify(session(true)); await screen.findByText('Você está na lista.')
  })

  it('validates incomplete code and focuses input without verification', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(session()).mockResolvedValueOnce(challenge())
    vi.stubGlobal('fetch', fetchMock); mount(); await request()
    fireEvent.click(screen.getByRole('button', { name: 'Validar e liberar VIP' }))
    expect(screen.getByLabelText('Código de seis dígitos')).toHaveFocus()
    expect(screen.getByRole('alert')).toHaveTextContent('Informe os seis dígitos')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each(['request', 'verify'])('presents generic focused %s error, keeps offers locked and allows retry', async (step) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(session())
    if (step === 'verify') fetchMock.mockResolvedValueOnce(challenge())
    fetchMock.mockResolvedValueOnce(json({ error: 'private account collision' }, 401))
    vi.stubGlobal('fetch', fetchMock); mount(); await ready()
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'vip@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar código VIP' }))
    if (step === 'verify') {
      await screen.findByLabelText('Código de seis dígitos')
      fireEvent.change(screen.getByLabelText('Código de seis dígitos'), { target: { value: '123456' } })
      fireEvent.click(screen.getByRole('button', { name: 'Validar e liberar VIP' }))
    }
    await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus())
    expect(screen.getByRole('alert')).toHaveTextContent(OTP_ERROR)
    expect(screen.queryByText('private account collision')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Desbloquear oferta VIP' })).toHaveLength(2)
    if (step === 'verify') expect(screen.getByLabelText('Código de seis dígitos')).toHaveValue('')
  })

  it('counts server expiresAt, expires without verification and replaces challenge on resend', async () => {
    const start = Date.now(); const clock = vi.spyOn(Date, 'now').mockReturnValue(start)
    const fetchMock = vi.fn().mockResolvedValueOnce(session()).mockResolvedValueOnce(challenge(true, start + 2000))
      .mockResolvedValueOnce(json({ expiresAt: start + 62_000, demo: true, demoCode: '654321' }))
    vi.stubGlobal('fetch', fetchMock); mount(); await request()
    expect(screen.getByText('Código válido por 0:02.')).toBeInTheDocument()
    clock.mockReturnValue(start + 3000)
    await waitFor(() => expect(screen.getByText('Código expirado. Solicite um novo código.')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.submit(screen.getByLabelText('Código de seis dígitos').closest('form')!)
    expect(screen.getByRole('button', { name: 'Validar e liberar VIP' })).toBeDisabled()
    expect(screen.queryByText('123456')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar código' }))
    await screen.findByText('654321')
    expect(screen.getByText('Código válido por 0:59.')).toBeInTheDocument()
    expect(screen.getByLabelText('Código de seis dígitos')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Alterar e-mail' }))
    await waitFor(() => expect(screen.getByLabelText('E-mail')).toHaveFocus())
    expect(screen.getByLabelText('E-mail')).toHaveValue('vip@example.com')
    expect(screen.queryByText('654321')).not.toBeInTheDocument()
  })
})
