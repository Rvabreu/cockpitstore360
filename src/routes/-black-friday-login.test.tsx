import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { BlackFridayLoginPage } from './black-friday_.login'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const emailInput = () => screen.getByLabelText('E-mail') as HTMLInputElement
const passwordInput = () => screen.getByLabelText('Senha') as HTMLInputElement
const submit = () => fireEvent.submit(screen.getByRole('form', { name: 'Login demonstrativo' }))

describe('BlackFridayLoginPage', () => {
  it('renders accessible fields, public navigation and an honest demo notice before submission', () => {
    render(<BlackFridayLoginPage />)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('PMI SUMMIT DF')
    expect(screen.getByRole('link', { name: 'Voltar às ofertas' })).toHaveAttribute('href', '/black-friday#ofertas')
    expect(emailInput()).toBeRequired()
    expect(emailInput()).toHaveAttribute('type', 'email')
    expect(emailInput()).toHaveAttribute('autocomplete', 'username')
    expect(passwordInput()).toBeRequired()
    expect(passwordInput()).toHaveAttribute('type', 'password')
    expect(passwordInput()).toHaveAttribute('autocomplete', 'current-password')
    expect(passwordInput()).not.toHaveAttribute('minlength')
    expect(screen.getByText('Login demonstrativo, sem autenticação.')).toBeInTheDocument()
    expect(screen.getByText(/Use dados fictícios, não sua senha real/)).toHaveTextContent('Nenhuma credencial é enviada ou salva.')
    expect(screen.getByText(/As ofertas são públicas/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('shows and hides the password with an accessible non-submit toggle', () => {
    render(<BlackFridayLoginPage />)
    fireEvent.change(passwordInput(), { target: { value: 'ficticia' } })
    const show = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(show).toHaveAttribute('type', 'button')
    expect(show).toHaveAttribute('aria-controls', 'bf-login-password')
    fireEvent.click(show)
    expect(passwordInput()).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(passwordInput()).toHaveAttribute('type', 'password')
    expect(passwordInput()).toHaveValue('ficticia')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('rejects empty fields locally and focuses the first invalid field', () => {
    render(<BlackFridayLoginPage />)
    submit()
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true')
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true')
    expect(emailInput()).toHaveFocus()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    fireEvent.change(emailInput(), { target: { value: 'demo@example.com' } })
    submit()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(passwordInput()).toHaveFocus()
  })

  it('rejects an invalid e-mail without claiming authentication', () => {
    render(<BlackFridayLoginPage />)
    fireEvent.change(emailInput(), { target: { value: 'invalido' } })
    fireEvent.change(passwordInput(), { target: { value: 'x' } })
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido.')
    expect(emailInput()).toHaveFocus()
    expect(passwordInput()).toHaveValue('x')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('accepts a nonempty demo password, clears it and shows honest feedback without requests or storage', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    render(<BlackFridayLoginPage />)
    fireEvent.change(emailInput(), { target: { value: 'demo@example.com' } })
    fireEvent.change(passwordInput(), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    submit()
    expect(passwordInput()).toHaveValue('')
    expect(passwordInput()).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma autenticação foi realizada, nenhuma sessão foi criada e a senha foi limpa.')
    expect(screen.getByRole('link', { name: 'Explorar ofertas públicas' })).toHaveAttribute('href', '/black-friday#ofertas')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(storageSpy).not.toHaveBeenCalled()
    fireEvent.change(passwordInput(), { target: { value: 'outra ficticia' } })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('renders stable SSR markup with empty credentials and no authentication state', () => {
    const first = renderToString(<BlackFridayLoginPage />)
    expect(renderToString(<BlackFridayLoginPage />)).toBe(first)
    expect(first).toContain('Login demonstrativo, sem autenticação.')
    expect(first).toContain('type="password"')
    expect(first).not.toContain('Demonstração concluída')
    const container = document.createElement('div')
    container.innerHTML = first
    expect([...container.querySelectorAll('input')].every((input) => input.value === '' && !input.name)).toBe(true)
  })
})
