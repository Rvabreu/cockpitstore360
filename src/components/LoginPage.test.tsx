import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import LoginPage from './LoginPage'

const DEMO_MESSAGE = 'Esta é uma demonstração. Nenhuma autenticação foi realizada.'

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

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Login demonstrativo sem autenticação', () => {
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

  it('submit vazio anuncia ambos os erros associados e foca primeiro campo inválido', () => {
    render(<LoginPage />)
    const { email, password } = fields()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    assertAccessibleError(email, 'Informe seu e-mail.')
    assertAccessibleError(password, 'Informe sua senha.')
    expect(email).toHaveFocus()
    expect(screen.queryByText(DEMO_MESSAGE)).not.toBeInTheDocument()
  })

  it('e-mail inválido recebe mensagem específica e foco mesmo com senha preenchida', () => {
    render(<LoginPage />)
    const { email, password } = fields()
    fireEvent.change(email, { target: { value: 'email-sem-arroba' } })
    fireEvent.change(password, { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    assertAccessibleError(email, 'Informe um e-mail válido.')
    expect(email).toHaveFocus()
    expect(password).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText(DEMO_MESSAGE)).not.toBeInTheDocument()
  })

  it('senha vazia com e-mail válido recebe erro associado e foco', () => {
    render(<LoginPage />)
    const { email, password } = fields()
    fireEvent.change(email, { target: { value: 'cliente@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    assertAccessibleError(password, 'Informe sua senha.')
    expect(password).toHaveFocus()
    expect(email).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText(DEMO_MESSAGE)).not.toBeInTheDocument()
  })

  it('mostrar e ocultar senha preserva valor e não submete o formulário', () => {
    render(<LoginPage />)
    const { password } = fields()
    fireEvent.change(password, { target: { value: 'segredo-demo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('segredo-demo')
    const hide = screen.getByRole('button', { name: 'Ocultar senha' })
    expect(hide).toHaveAttribute('type', 'button')
    expect(hide).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(DEMO_MESSAGE)).not.toBeInTheDocument()
    fireEvent.click(hide)
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveValue('segredo-demo')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(DEMO_MESSAGE)).not.toBeInTheDocument()
  })

  it('submit válido aceita senha curta e anuncia somente demo, sem rede/storage/log de credenciais', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const localAccess = vi.spyOn(window, 'localStorage', 'get')
    const sessionAccess = vi.spyOn(window, 'sessionStorage', 'get')
    const storageRead = vi.spyOn(Storage.prototype, 'getItem')
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const logSpies = ['log', 'info', 'debug', 'warn', 'error'].map((method) =>
      vi.spyOn(console, method as 'log').mockImplementation(() => {}),
    )
    render(<LoginPage />)
    const { email, password } = fields()
    fireEvent.change(email, { target: { value: 'cliente@example.com' } })
    fireEvent.change(password, { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByRole('status')).toHaveTextContent(DEMO_MESSAGE)
    expect(screen.getByText(DEMO_MESSAGE, { exact: true })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(email).not.toHaveAttribute('aria-invalid', 'true')
    expect(password).not.toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(localAccess).not.toHaveBeenCalled()
    expect(sessionAccess).not.toHaveBeenCalled()
    expect(storageRead).not.toHaveBeenCalled()
    expect(storageWrite).not.toHaveBeenCalled()
    for (const log of logSpies) expect(log).not.toHaveBeenCalled()
  })

  it('corrigir os campos limpa erros ao submeter novamente e permite demonstração', () => {
    render(<LoginPage />)
    const { email, password } = fields()
    const submit = screen.getByRole('button', { name: 'Entrar' })
    fireEvent.click(submit)
    fireEvent.change(email, { target: { value: 'cliente@example.com' } })
    fireEvent.change(password, { target: { value: 'x' } })
    fireEvent.click(submit)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(email).not.toHaveAttribute('aria-invalid', 'true')
    expect(password).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(DEMO_MESSAGE)
  })

  it('oferece link de retorno à loja apontando para raiz', () => {
    render(<LoginPage />)
    expect(screen.getByRole('link', { name: /(?:voltar|retornar).*loja/i })).toHaveAttribute('href', '/')
  })
})
