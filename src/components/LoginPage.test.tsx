import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import LoginPage from './LoginPage'

const USER = { id: 'user-1', email: 'cliente@example.com' }
const TOKEN = 'csrf-bootstrap-token'
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
function deferredResponse() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>((done) => { resolve = done })
  return { promise, resolve }
}
async function ready() {
  render(<LoginPage />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled())
}
function fill() {
  const { email, password } = fields()
  fireEvent.change(email, { target: { value: USER.email } })
  fireEvent.change(password, { target: { value: 'x' } })
  return { email, password }
}

function fields() {
  return {
    email: screen.getByLabelText('E-mail') as HTMLInputElement,
    password: screen.getByLabelText('Senha') as HTMLInputElement,
  }
}

function assertAccessibleError(input: HTMLInputElement, message: string) {
  const error = screen.getByText(message)
  expect(error).toHaveAttribute('role', 'alert')
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(error.id).not.toBe('')
  expect(input.getAttribute('aria-describedby')?.split(/\s+/)).toContain(error.id)
  expect(input).toHaveAccessibleDescription(new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json({ user: null, csrfToken: TOKEN }))))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Login real confirmado pelo backend', () => {
  it('HTML SSR sem hidratação não serializa credenciais em submissão nativa', () => {
    const container = document.createElement('div')
    container.innerHTML = renderToString(<LoginPage />)
    const html = within(container)
    const email = html.getByLabelText('E-mail') as HTMLInputElement
    const password = html.getByLabelText('Senha') as HTMLInputElement
    email.value = 'cliente@example.com'
    password.value = 'segredo-sem-hidratacao'

    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('autocomplete', 'username')
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(email).not.toHaveAttribute('name')
    expect(password).not.toHaveAttribute('name')
    expect(email.form).not.toBeNull()
    expect(email.form).toBe(password.form)
    // FormData opera no HTML standalone, sem handlers React que possam impedir
    // GET nativo antes da hidratação ou quando JavaScript está indisponível.
    expect(Array.from(new FormData(email.form!).entries())).toEqual([])
  })

  it('expõe campos rotulados, autocomplete correto, submit e validação customizada', () => {
    render(<LoginPage />)
    const { email, password } = fields()
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('autocomplete', 'username')
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveAttribute('type', 'submit')
    expect(email.form).not.toBeNull()
    expect(email.form).toBe(password.form)
    expect(email.form).toHaveAttribute('novalidate')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('submit vazio anuncia ambos os erros associados e foca primeiro campo inválido', async () => {
    await ready()
    const { email, password } = fields()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    assertAccessibleError(email, 'Informe seu e-mail.')
    assertAccessibleError(password, 'Informe sua senha.')
    expect(email).toHaveFocus()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('e-mail inválido recebe mensagem específica e foco mesmo com senha preenchida', async () => {
    await ready()
    const { email, password } = fields()
    fireEvent.change(email, { target: { value: 'email-sem-arroba' } })
    fireEvent.change(password, { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    assertAccessibleError(email, 'Informe um e-mail válido.')
    expect(email).toHaveFocus()
    expect(password).not.toHaveAttribute('aria-invalid', 'true')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('senha vazia com e-mail válido recebe erro associado e foco', async () => {
    await ready()
    const { email, password } = fields()
    fireEvent.change(email, { target: { value: 'cliente@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    assertAccessibleError(password, 'Informe sua senha.')
    expect(password).toHaveFocus()
    expect(email).not.toHaveAttribute('aria-invalid', 'true')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('mostrar e ocultar senha preserva valor e não submete o formulário', async () => {
    await ready()
    const { password } = fields()
    fireEvent.change(password, { target: { value: 'segredo-demo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('segredo-demo')
    const hide = screen.getByRole('button', { name: 'Ocultar senha' })
    expect(hide).toHaveAttribute('type', 'button')
    expect(hide).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
    fireEvent.click(hide)
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveValue('segredo-demo')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('submit válido só autentica após HTTP confirmado, sem storage/log e aceita senha não vazia curta', async () => {
    const localAccess = vi.spyOn(window, 'localStorage', 'get')
    const sessionAccess = vi.spyOn(window, 'sessionStorage', 'get')
    const storageRead = vi.spyOn(Storage.prototype, 'getItem')
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const logSpies = ['log', 'info', 'debug', 'warn', 'error'].map((method) =>
      vi.spyOn(console, method as 'log').mockImplementation(() => {}),
    )
    await ready()
    const response = deferredResponse()
    vi.mocked(fetch).mockReturnValueOnce(response.promise)
    const { email, password } = fill()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.queryByRole('button', { name: /sair/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entr/i })).toBeDisabled()
    fireEvent.submit(email.form!)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const [endpoint, options] = vi.mocked(fetch).mock.calls[1]
    expect(endpoint).toBe('/api/auth/login')
    expect(options?.credentials).toBe('same-origin')
    expect(options?.method).toBe('POST')
    expect(JSON.parse(options?.body as string)).toEqual({ email: USER.email, password: 'x' })
    expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe(TOKEN)
    await act(async () => { response.resolve(json({ user: USER, csrfToken: 'rotated-token' })) })
    expect(screen.getByText(USER.email)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument()
    expect(password.value).toBe('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(localAccess).not.toHaveBeenCalled()
    expect(sessionAccess).not.toHaveBeenCalled()
    expect(storageRead).not.toHaveBeenCalled()
    expect(storageWrite).not.toHaveBeenCalled()
    for (const log of logSpies) expect(log).not.toHaveBeenCalled()
  })

  it('corrigir os campos limpa erros e permite login real', async () => {
    await ready()
    const { email, password } = fields()
    const submit = screen.getByRole('button', { name: 'Entrar' })
    fireEvent.click(submit)
    fireEvent.change(email, { target: { value: 'cliente@example.com' } })
    fireEvent.change(password, { target: { value: 'x' } })
    vi.mocked(fetch).mockResolvedValueOnce(json({ user: USER, csrfToken: 'rotated' }))
    fireEvent.click(submit)
    await screen.findByRole('button', { name: /sair/i })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(email).not.toHaveAttribute('aria-invalid', 'true')
    expect(password).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(USER.email)).toBeInTheDocument()
  })

  it('oferece link de retorno à loja apontando para raiz', () => {
    render(<LoginPage />)
    expect(screen.getByRole('link', { name: /(?:voltar|retornar).*loja/i })).toHaveAttribute('href', '/')
  })

  it('bloqueia submit até bootstrap e não lê credenciais durante SSR', async () => {
    const response = deferredResponse()
    vi.mocked(fetch).mockReturnValueOnce(response.promise)
    render(<LoginPage />)
    const { email } = fill()
    expect(screen.getByRole('button', { name: /entr/i })).toBeDisabled()
    fireEvent.submit(email.form!)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await act(async () => { response.resolve(json({ user: null, csrfToken: TOKEN })) })
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it.each([401, 429])('erro HTTP%s mantém formulário anônimo e limpa senha sem falso sucesso', async (status) => {
    await ready()
    const { password } = fill()
    const error = status === 401 ? 'E-mail ou senha inválidos' : 'Muitas tentativas. Tente novamente mais tarde.'
    vi.mocked(fetch).mockResolvedValueOnce(json({ error }, status))
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(error)
    expect(password).toHaveValue('')
    expect(screen.queryByRole('button', { name: /sair/i })).not.toBeInTheDocument()
  })

  it('403 renova bootstrap mas nunca reenvia senha automaticamente', async () => {
    await ready()
    const { password } = fill()
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ error: 'Requisição não autorizada' }, 403))
      .mockResolvedValueOnce(json({ user: null, csrfToken: 'renewed' }))
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByRole('alert')
    expect(password).toHaveValue('')
    expect(vi.mocked(fetch).mock.calls.map(([endpoint]) => endpoint)).toEqual(['/api/auth/session', '/api/auth/login', '/api/auth/session'])
    expect(screen.queryByRole('button', { name: /sair/i })).not.toBeInTheDocument()
  })

  it('falha logout mantém conta confirmada; sucesso faz novo bootstrap anônimo', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ user: USER, csrfToken: TOKEN }))
    render(<LoginPage />)
    const logout = await screen.findByRole('button', { name: /sair/i })
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'))
    fireEvent.click(logout)
    await screen.findByRole('alert')
    expect(screen.getByText(USER.email)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sair/i })).toBeEnabled()
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ user: null }))
      .mockResolvedValueOnce(json({ user: null, csrfToken: 'after-logout' }))
    fireEvent.click(await screen.findByRole('button', { name: /sair/i }))
    await screen.findByRole('button', { name: 'Entrar' })
    expect(screen.queryByText(USER.email)).not.toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.map(([endpoint]) => endpoint)).toEqual(['/api/auth/session', '/api/auth/logout', '/api/auth/logout', '/api/auth/session'])
  })

  it('logout200 com refresh indisponível permanece encerrado e retry só refaz bootstrap', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ user: USER, csrfToken: TOKEN }))
    render(<LoginPage />)
    const logout = await screen.findByRole('button', { name: /sair/i })
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ user: null }))
      .mockRejectedValueOnce(new TypeError('offline'))
    fireEvent.click(logout)
    await screen.findByRole('alert')
    expect(screen.getByRole('status')).toHaveTextContent(/^Sessão encerrada\.$/)
    expect(screen.queryByText(USER.email)).not.toBeInTheDocument()
    expect(screen.queryByText('Sessão autenticada.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sair/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()

    vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'retry-bootstrap' }))
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled())
    expect(vi.mocked(fetch).mock.calls.map(([endpoint]) => endpoint)).toEqual([
      '/api/auth/session', '/api/auth/logout', '/api/auth/session', '/api/auth/session',
    ])
    expect(screen.queryByRole('button', { name: /sair/i })).not.toBeInTheDocument()
  })

  it('logout403 de sessão expirada reconcilia bootstrap anônimo sem manter conta antiga', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ user: USER, csrfToken: TOKEN }))
    render(<LoginPage />)
    const logout = await screen.findByRole('button', { name: /sair/i })
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ error: 'Requisição não autorizada' }, 403))
      .mockResolvedValueOnce(json({ user: null, csrfToken: 'recovered-anonymous' }))
    fireEvent.click(logout)
    expect(await screen.findByRole('alert')).toHaveTextContent('Requisição não autorizada')
    expect(screen.queryByText(USER.email)).not.toBeInTheDocument()
    expect(screen.queryByText('Sessão autenticada.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sair/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    expect(vi.mocked(fetch).mock.calls.map(([endpoint]) => endpoint)).toEqual([
      '/api/auth/session', '/api/auth/logout', '/api/auth/session',
    ])
  })
})
