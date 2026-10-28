import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LoginPage } from './login'

const mocks = vi.hoisted(() => ({ login: vi.fn(), navigate: vi.fn(), auth: { isAuthenticated: false, isLoading: false } }))
vi.mock('../context/useAuth', () => ({ useAuth: () => ({ ...mocks.auth, login: mocks.login }) }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  useNavigate: () => mocks.navigate,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}))
beforeEach(() => { mocks.auth = { isAuthenticated: false, isLoading: false }; mocks.login.mockReset(); mocks.navigate.mockReset() })
afterEach(cleanup)
function submit() { fireEvent.click(screen.getByRole('button', { name: 'Entrar na minha conta' })) }

describe('Tela de login', () => {
  it('valida e-mail e senha em pt-BR e move foco para o campo inválido', () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'inválido' } })
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido')
    expect(screen.getByLabelText('E-mail')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'teste@exemplo.com' } })
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Informe sua senha')
    expect(screen.getByLabelText('Senha')).toHaveFocus()
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('preenche Cliente Demo sem enviar, permite revelar senha e lembrar-me desmarcado', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Preencher como Cliente Demo' }))
    expect(screen.getByLabelText('E-mail')).toHaveValue('cliente@cockpitstore360.com.br')
    expect(screen.getByLabelText('Senha')).toHaveValue('demo123')
    expect(mocks.login).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lembrar-me' }))
    submit()
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('cliente@cockpitstore360.com.br', 'demo123', false))
  })

  it('mostra erro backend em alert e bloqueia duplo envio durante login', async () => {
    let reject!: (reason: Error) => void
    mocks.login.mockReturnValue(new Promise((_, fail) => { reject = fail }))
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Preencher como Cliente Demo' }))
    submit()
    expect(screen.getByRole('button', { name: 'Entrando...' })).toBeDisabled()
    expect(screen.getByLabelText('E-mail')).toBeDisabled()
    expect(mocks.login).toHaveBeenCalledTimes(1)
    reject(new Error('E-mail ou senha inválidos.'))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    expect(screen.getByRole('button', { name: 'Entrar na minha conta' })).toBeEnabled()
  })

  it('aguarda verificação e redireciona só quando autenticado', () => {
    mocks.auth = { isAuthenticated: false, isLoading: true }
    const { rerender } = render(<LoginPage />)
    expect(screen.getByRole('button', { name: 'Verificando sessão...' })).toBeDisabled()
    expect(mocks.navigate).not.toHaveBeenCalled()
    mocks.auth = { isAuthenticated: true, isLoading: false }
    rerender(<LoginPage />)
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/', replace: true })
    expect(screen.getByRole('link', { name: 'Voltar à loja' })).toHaveAttribute('href', '/')
  })
})
