import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RegistrationPage from './RegistrationPage'

vi.mock('@tanstack/react-router', () => ({ Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a> }))
const USER = { id: 'qa-user', email: 'qa@example.com' }
const PASSWORD = 'secure password-123'
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
async function ready() {
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'csrf-memory' }))
  render(<RegistrationPage />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Criar conta' })).toBeEnabled())
}
function fields() { return { email: screen.getByLabelText('E-mail') as HTMLInputElement, password: screen.getByLabelText('Senha') as HTMLInputElement, confirm: screen.getByLabelText('Confirmar senha') as HTMLInputElement } }
function fill(password = PASSWORD, confirmation = password) {
  const inputs = fields()
  fireEvent.change(inputs.email, { target: { value: USER.email } })
  fireEvent.change(inputs.password, { target: { value: password } })
  fireEvent.change(inputs.confirm, { target: { value: confirmation } })
  return inputs
}
beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('SSR name-less impede FormData credenciais e mantém labels/autocomplete sem hidratação', () => {
  const container = document.createElement('div')
  container.innerHTML = renderToString(<RegistrationPage />)
  expect(within(container).getByRole('heading', { level: 1, name: 'Criar conta' })).toHaveTextContent('Criar conta')
  const email = within(container).getByLabelText('E-mail') as HTMLInputElement
  const password = within(container).getByLabelText('Senha') as HTMLInputElement
  const confirm = within(container).getByLabelText('Confirmar senha') as HTMLInputElement
  email.value = USER.email; password.value = PASSWORD; confirm.value = PASSWORD
  expect(email).toHaveAttribute('autocomplete', 'email')
  for (const input of [password, confirm]) expect(input).toHaveAttribute('autocomplete', 'new-password')
  for (const input of [email, password, confirm]) expect(input).not.toHaveAttribute('name')
  expect(email.form).toHaveAttribute('novalidate')
  expect(Array.from(new FormData(email.form!).entries())).toEqual([])
  expect(within(container).getByRole('button', { name: 'Criar conta' })).toBeDisabled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([['short', 'x'.repeat(11)], ['long', 'x'.repeat(129)], ['mismatch', PASSWORD]] as const)('validação%s foca primeiro inválido, ariaerro e nunca POST', async (kind, password) => {
  await ready()
  const inputs = fill(password, kind === 'mismatch' ? 'different password-123' : password)
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
  const invalid = kind === 'mismatch' ? inputs.confirm : inputs.password
  const message = kind === 'mismatch' ? 'A confirmação deve ser igual à senha.' : 'Sua senha deve ter entre 12 e 128 caracteres.'
  expect(screen.getByRole('alert')).toHaveTextContent(message)
  expect(invalid).toHaveFocus()
  expect(invalid).toHaveAttribute('aria-invalid', 'true')
  expect(invalid.getAttribute('aria-describedby')).toBeTruthy()
  expect(document.getElementById(invalid.getAttribute('aria-describedby')!)).toHaveTextContent(message)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('valida e-mail antes de senha e confirmação, preservando foco e mensagem', async () => {
  await ready()
  const inputs = fill()
  fireEvent.change(inputs.email, { target: { value: 'invalid' } })
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido.')
  expect(inputs.email).toHaveFocus()
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('toggles independentes preservam senhas e não submetem', async () => {
  await ready()
  const inputs = fill()
  const show = screen.getByRole('button', { name: 'Mostrar senha' })
  expect(show).toHaveAttribute('type', 'button')
  fireEvent.click(show)
  expect(inputs.password).toHaveAttribute('type', 'text')
  expect(inputs.confirm).toHaveAttribute('type', 'password')
  expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar confirmação' }))
  expect(inputs.confirm).toHaveAttribute('type', 'text')
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar confirmação' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
  expect(inputs.password).toHaveValue(PASSWORD); expect(inputs.confirm).toHaveValue(PASSWORD)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('201 confirmado impede doublePOST, limpa senhas DOM e oferece login sem autenticação/storage/log', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem')
  const set = vi.spyOn(Storage.prototype, 'setItem')
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  await ready()
  const inputs = fill()
  let resolve!: (response: Response) => void
  vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolve = done }))
  const submit = screen.getByRole('button', { name: 'Criar conta' })
  fireEvent.click(submit); fireEvent.submit(inputs.email.form!)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(submit).toBeDisabled()
  expect(screen.queryByText('Conta criada. Entre para acessar sua conta.')).not.toBeInTheDocument()
  await act(async () => { resolve(json({ created: true }, 201)) })
  expect(screen.getByRole('status')).toHaveTextContent(/^Conta criada\. Entre para acessar sua conta\.$/)
  expect(screen.getByRole('link', { name: 'Entrar na sua conta' })).toHaveAttribute('href', '/login')
  expect(inputs.password).toHaveValue(''); expect(inputs.confirm).toHaveValue('')
  expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/auth/session', '/api/auth/register'])
  expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string)).toEqual({ email: USER.email, password: PASSWORD })
  expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled()
})

it.each([409, 429, 500])('falha%s limpa ambas senhas e não anuncia sucesso', async (status) => {
  await ready()
  const inputs = fill()
  vi.mocked(fetch).mockResolvedValueOnce(json({ error: 'private' }, status))
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
  await screen.findByRole('alert')
  expect(inputs.password).toHaveValue(''); expect(inputs.confirm).toHaveValue('')
  expect(screen.queryByText('Conta criada. Entre para acessar sua conta.')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each([null, USER])('403 reconcilia snapshot%j sem reenviar senha e limpa valores', async (user) => {
  await ready()
  const inputs = fill()
  vi.mocked(fetch).mockResolvedValueOnce(json({ error: 'Requisição não autorizada' }, 403))
    .mockResolvedValueOnce(json({ user, csrfToken: 'renewed' }))
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
  await screen.findByRole('alert')
  expect(inputs.password).toHaveValue(''); expect(inputs.confirm).toHaveValue('')
  expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/auth/session', '/api/auth/register', '/api/auth/session'])
  if (user) {
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir painel' })).toHaveAttribute('href', '/dashboard')
  } else expect(screen.getByRole('button', { name: 'Criar conta' })).toBeEnabled()
})

it('bootstrap autenticado não oferece cadastro nem faz POST', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: USER, csrfToken: 'token' }))
  render(<RegistrationPage />)
  expect(await screen.findByText('Você já está conectado.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Abrir painel' })).toHaveAttribute('href', '/dashboard')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('unmount com cadastro pendente limpa referências e ignora sucesso atrasado na nova montagem', async () => {
  await ready()
  const inputs = fill()
  let resolve!: (response: Response) => void
  vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolve = done }))
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  cleanup()
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'new-token' }))
  render(<RegistrationPage />)
  await act(async () => { resolve(json({ created: true }, 201)) })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Criar conta' })).toBeEnabled())
  expect(inputs.password).toHaveValue(''); expect(inputs.confirm).toHaveValue('')
  expect(screen.queryByText('Conta criada. Entre para acessar sua conta.')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(3)
})
