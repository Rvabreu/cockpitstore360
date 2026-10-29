import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { AuthProvider } from '../context/auth'
import Header from '../components/Header'
import { LoginScreen, validateLoginSearch } from './login'
import { AUTH_ERROR, LOGOUT_ERROR } from '../services/authService'
import { googleAvailable, startGoogleLogin, GOOGLE_CANCELLED, GOOGLE_ERROR, GOOGLE_UNAVAILABLE } from '../services/googleAuthService'

vi.mock('../services/googleAuthService', async (original) => ({
  ...await original<typeof import('../services/googleAuthService')>(),
  googleAvailable: vi.fn(), startGoogleLogin: vi.fn(),
}))
beforeEach(() => {
  vi.mocked(googleAvailable).mockReset().mockResolvedValue(true)
  vi.mocked(startGoogleLogin).mockReset().mockResolvedValue(undefined)
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const response = (authenticated = false) => new Response(JSON.stringify({
  user: authenticated ? { authenticated: true } : null, csrfToken: 'csrf-test',
}), { status: 200 })

function mount(returnTo = '/') {
  const onAuthenticated = vi.fn()
  render(<AuthProvider><Header /><LoginScreen returnTo={returnTo} onAuthenticated={onAuthenticated} /></AuthProvider>)
  return onAuthenticated
}
async function ready() { await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar na conta' })).toBeEnabled()) }
function fill() {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: ' person@example.com ' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'private-secret' } })
}

describe('login and authentication UI', () => {
  it('presents the new editorial, clear access hierarchy and faithful demo notice without fictitious account actions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    mount()
    await ready()
    expect(screen.getByRole('heading', { level: 2, name: 'SUA CONTA, SEU UNIVERSO.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Bem-vindo de volta.' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar com Google' })).toHaveAccessibleDescription('Continue com segurança na página do Google.'))
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('id', 'login-email')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('id', 'login-password')
    expect(screen.getByText(/Ambiente demonstrativo\. O catálogo e os pedidos/)).toHaveTextContent('Use uma conta provisionada pelo administrador ou Google, quando disponível.')
    expect(screen.getByRole('link', { name: /Explorar o catálogo sem entrar/ })).toHaveAttribute('href', '/#colecao')
    expect(screen.queryByRole('link', { name: /criar conta|cadastre|recuperar|esqueci/i })).not.toBeInTheDocument()
  })

  it('SSR renders initial loading state without any fetch', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(renderToString(<AuthProvider><LoginScreen onAuthenticated={vi.fn()} /></AuthProvider>)).toContain('Verificando sessão')
    expect(renderToString(<AuthProvider><LoginScreen onAuthenticated={vi.fn()} /></AuthProvider>)).toMatch(/<button[^>]*disabled=""[^>]*>Continuar com Google/)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(googleAvailable).not.toHaveBeenCalled()
  })

  it('validates accessible fields, focuses first invalid field, never sends invalid credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response())
    vi.stubGlobal('fetch', fetchMock)
    mount()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na conta' }))
    expect(screen.getByLabelText('E-mail')).toHaveFocus()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription('Informe um e-mail válido.')
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription('Informe sua senha.')
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'person@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na conta' }))
    expect(screen.getByLabelText('Senha')).toHaveFocus()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('toggles password accessibly without submitting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    mount()
    await ready()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
  })

  it('disables form during restore and login, sends exact payload, safely redirects and clears password', async () => {
    let resolveLogin!: (value: Response) => void
    const loginPromise = new Promise<Response>((resolve) => { resolveLogin = resolve })
    const fetchMock = vi.fn().mockResolvedValueOnce(response()).mockReturnValueOnce(loginPromise)
    vi.stubGlobal('fetch', fetchMock)
    const redirect = mount('//evil.test')
    expect(screen.getByLabelText('E-mail')).toBeDisabled()
    await ready()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na conta' }))
    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
    expect(screen.getByLabelText('Senha')).toBeDisabled()
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ email: 'person@example.com', password: 'private-secret' })
    resolveLogin(response(true))
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/'))
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
    expect(screen.getByText('Você está conectado.')).toBeInTheDocument()
  })

  it('shows generic focused server error and clears secret; allows retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response('', { status: 401 })))
    const redirect = mount()
    await ready()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na conta' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus())
    expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERROR)
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects successful login to an allowlisted store anchor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response(true)))
    const redirect = mount('/#colecao')
    await ready()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na conta' }))
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/#colecao'))
  })

  it('keeps session connected and prevents duplicate logout until the server confirms', async () => {
    let resolveLogout!: (value: Response) => void
    const logoutPromise = new Promise<Response>((resolve) => { resolveLogout = resolve })
    const fetchMock = vi.fn().mockResolvedValueOnce(response(true)).mockReturnValueOnce(logoutPromise)
    vi.stubGlobal('fetch', fetchMock)
    mount()
    await screen.findByText('Você está conectado.')
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(screen.getByRole('button', { name: 'Saindo…' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Conta conectada' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Saindo…' }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    resolveLogout(response())
    await ready()
    expect(screen.queryByRole('link', { name: 'Conta conectada' })).not.toBeInTheDocument()
  })

  it('restores an existing session without redirect, preserves user on logout failure, then logs out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(new Response('', { status: 500 })).mockResolvedValueOnce(response()))
    const redirect = mount('/#pedidos')
    await screen.findByText('Você está conectado.')
    expect(screen.getByRole('link', { name: /Continuar na loja/ })).toHaveAttribute('href', '/#pedidos')
    expect(redirect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled())
    expect(screen.getByRole('link', { name: 'Conta conectada' })).toBeInTheDocument()
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent(LOGOUT_ERROR)
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await ready()
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('keeps catalog/order/flow navigation available from login and offers restore retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(response()))
    mount()
    await screen.findByRole('alert')
    expect(screen.getByRole('link', { name: 'Produtos' })).toHaveAttribute('href', '/#colecao')
    expect(screen.getByRole('link', { name: 'Meus pedidos' })).toHaveAttribute('href', '/#pedidos')
    expect(screen.getByRole('link', { name: 'Como evoluímos' })).toHaveAttribute('href', '/#fluxo')
    fireEvent.click(screen.getByRole('button', { name: 'Verificar sessão novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    await ready()
  })
})

describe('Google login UI', () => {
  it('waits for session and status, without blocking local login while status is pending', async () => {
    let resolveStatus!: (available: boolean) => void
    vi.mocked(googleAvailable).mockReturnValue(new Promise((resolve) => { resolveStatus = resolve }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    mount('/#colecao')
    const googleButton = screen.getByRole('button', { name: 'Continuar com Google' })
    expect(googleButton).toBeDisabled()
    await ready()
    expect(googleButton).toBeDisabled()
    fireEvent.click(googleButton)
    expect(startGoogleLogin).not.toHaveBeenCalled()
    resolveStatus(true)
    await waitFor(() => expect(googleButton).toBeEnabled())
    fireEvent.click(googleButton)
    fireEvent.click(googleButton)
    expect(startGoogleLogin).toHaveBeenCalledTimes(1)
    expect(startGoogleLogin).toHaveBeenCalledWith('/#colecao')
    expect(googleButton).toBeDisabled()
    expect(screen.getByLabelText('Senha')).toBeDisabled()
    expect(screen.getByText('Redirecionando para o Google…')).toBeInTheDocument()
  })

  it.each(['missing configuration', 'network failure'])('keeps local login working with %s', async (scenario) => {
    if (scenario === 'network failure') vi.mocked(googleAvailable).mockRejectedValue(new Error('private diagnostic'))
    else vi.mocked(googleAvailable).mockResolvedValue(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response(true)))
    const redirect = mount()
    await screen.findByText(GOOGLE_UNAVAILABLE)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar com Google' }))
    expect(startGoogleLogin).not.toHaveBeenCalled()
    expect(screen.queryByText('private diagnostic')).not.toBeInTheDocument()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na conta' }))
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/'))
  })

  it('shows generic focused start error and allows retry', async () => {
    vi.mocked(startGoogleLogin).mockRejectedValueOnce(new Error('client secret diagnostic'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    mount()
    const button = screen.getByRole('button', { name: 'Continuar com Google' })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus())
    expect(screen.getByRole('alert')).toHaveTextContent(GOOGLE_ERROR)
    expect(screen.queryByText('client secret diagnostic')).not.toBeInTheDocument()
    expect(button).toBeEnabled()
    expect(screen.getByLabelText('Senha')).toBeEnabled()
    fireEvent.click(button)
    expect(startGoogleLogin).toHaveBeenCalledTimes(2)
  })

  it('does not start Google after session restore failure, and enables it after a successful retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(response()))
    mount()
    await screen.findByRole('alert')
    const button = screen.getByRole('button', { name: 'Continuar com Google' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(startGoogleLogin).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Verificar sessão novamente' }))
    await waitFor(() => expect(button).toBeEnabled())
  })

  it.each([
    ['cancelled', GOOGLE_CANCELLED], ['error', GOOGLE_ERROR], ['unavailable', GOOGLE_UNAVAILABLE],
  ] as const)('validates and presents callback result %s', async (google, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    expect(validateLoginSearch({ google, returnTo: '//evil.test' })).toEqual({ google, returnTo: '/' })
    render(<AuthProvider><LoginScreen google={google} onAuthenticated={vi.fn()} /></AuthProvider>)
    await ready()
    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })

  it.each(['<script>alert(1)</script>', ['cancelled'], 'unknown', undefined])('ignores untrusted callback result %s', (google) => {
    expect(validateLoginSearch({ google }).google).toBeUndefined()
  })

  it('does not offer Google for authenticated session or start while local login is pending', async () => {
    let resolveLogin!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response()).mockReturnValueOnce(new Promise<Response>((resolve) => { resolveLogin = resolve })))
    mount()
    const googleButton = screen.getByRole('button', { name: 'Continuar com Google' })
    await waitFor(() => expect(googleButton).toBeEnabled())
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na conta' }))
    expect(googleButton).toBeDisabled()
    fireEvent.click(googleButton)
    expect(startGoogleLogin).not.toHaveBeenCalled()
    resolveLogin(response(true))
    await screen.findByText('Você está conectado.')
    expect(screen.queryByRole('button', { name: 'Continuar com Google' })).not.toBeInTheDocument()
  })
})
