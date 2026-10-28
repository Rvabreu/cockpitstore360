import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
const demos = [
  { name: 'Preencher como Cliente Demo', email: 'cliente@cockpitstore360.com.br', password: 'demo123' },
  { name: 'Preencher como Administrador Demo', email: 'admin@cockpitstore360.com.br', password: 'admin123' },
]

describe('Tela de login', () => {
  it('apresenta portal único com branding e título acima do painel, sem marketing ou prévia antiga', () => {
    render(<LoginPage />)
    const heading = screen.getByRole('heading', { level: 1, name: 'Acesse sua conta' })
    const branding = screen.getByText(/COCKPIT/)
    const form = screen.getByLabelText('E-mail').closest('form')!
    const panel = form.closest('section')!
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(branding).toHaveTextContent(/COCKPIT STORE\s*360/)
    expect(panel).toBeInTheDocument()
    expect(panel).not.toContainElement(heading)
    expect(panel).not.toContainElement(branding)
    expect(heading.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(branding.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Experimente a loja')).toBeInTheDocument()
    expect(screen.getByText('Sua conta · Seus pedidos · Sua experiência')).toBeInTheDocument()
    expect(screen.getByText('Ambiente demonstrativo. Dados e produtos fictícios.')).toBeInTheDocument()
    for (const demo of demos) expect(screen.getByRole('button', { name: demo.name })).toHaveAttribute('type', 'button')
    expect(screen.queryByRole('heading', { name: 'Tudo que você gosta. Em um só lugar.' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Prévia demonstrativa do acompanhamento de pedido')).not.toBeInTheDocument()
    expect(screen.queryByText('Prévia ilustrativa da experiência na loja.')).not.toBeInTheDocument()
  })

  it('valida e-mail e senha em pt-BR e move foco para o campo inválido', () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'inválido' } })
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido')
    expect(screen.getByLabelText('E-mail')).toHaveFocus()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-describedby', 'login-error')
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'teste@exemplo.com' } })
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Informe sua senha')
    expect(screen.getByLabelText('Senha')).toHaveFocus()
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-describedby', 'login-error')
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('preenche Cliente Demo sem enviar, permite revelar senha e lembrar-me desmarcado', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Preencher como Cliente Demo' }))
    expect(screen.getByLabelText('E-mail')).toHaveValue('cliente@cockpitstore360.com.br')
    expect(screen.getByLabelText('Senha')).toHaveValue('demo123')
    expect(screen.getByLabelText('E-mail')).toHaveFocus()
    expect(mocks.login).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox', { name: 'Lembrar-me' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('aria-controls', 'login-password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Senha')).toHaveValue('demo123')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lembrar-me' }))
    submit()
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('cliente@cockpitstore360.com.br', 'demo123', false))
  })

  it.each(demos)('$name substitui os campos, limpa erro de validação e foca e-mail sem enviar', (demo) => {
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'inválido' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha anterior' } })
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido')
    fireEvent.click(screen.getByRole('button', { name: demo.name }))
    expect(screen.getByLabelText('E-mail')).toHaveValue(demo.email)
    expect(screen.getByLabelText('Senha')).toHaveValue(demo.password)
    expect(screen.getByLabelText('E-mail')).toHaveFocus()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).not.toHaveAttribute('aria-describedby')
    expect(screen.getByLabelText('Senha')).not.toHaveAttribute('aria-describedby')
    expect(mocks.login).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it.each(demos)('$name limpa também erro backend sem tentar novo login', async (demo) => {
    mocks.login.mockRejectedValue(new Error('E-mail ou senha inválidos.'))
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Preencher como Cliente Demo' }))
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    fireEvent.click(screen.getByRole('button', { name: demo.name }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveValue(demo.email)
    expect(screen.getByLabelText('Senha')).toHaveValue(demo.password)
    expect(screen.getByLabelText('E-mail')).toHaveFocus()
    expect(mocks.login).toHaveBeenCalledTimes(1)
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('mostra erro backend em alert e bloqueia duplo envio durante login', async () => {
    let reject!: (reason: Error) => void
    mocks.login.mockReturnValue(new Promise((_, fail) => { reject = fail }))
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Preencher como Cliente Demo' }))
    submit()
    expect(screen.getByRole('button', { name: 'Entrando...' })).toBeDisabled()
    expect(screen.getByLabelText('E-mail')).toBeDisabled()
    expect(screen.getByLabelText('Senha')).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Lembrar-me' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeDisabled()
    const form = screen.getByLabelText('E-mail').closest('form')!
    expect(form).toHaveAttribute('aria-busy', 'true')
    for (const demo of demos) {
      const button = screen.getByRole('button', { name: demo.name })
      expect(button).toBeDisabled()
      fireEvent.click(button)
    }
    expect(screen.getByLabelText('E-mail')).toHaveValue('cliente@cockpitstore360.com.br')
    expect(screen.getByLabelText('Senha')).toHaveValue('demo123')
    fireEvent.click(screen.getByRole('button', { name: 'Entrando...' }))
    fireEvent.submit(form)
    expect(mocks.login).toHaveBeenCalledTimes(1)
    await act(async () => { reject(new Error('E-mail ou senha inválidos.')) })
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    expect(screen.getByRole('button', { name: 'Entrar na minha conta' })).toBeEnabled()
    expect(form).toHaveAttribute('aria-busy', 'false')
    for (const demo of demos) expect(screen.getByRole('button', { name: demo.name })).toBeEnabled()
  })

  it.each(demos)('envia $name com lembrar-me padrão e redireciona somente quando autenticação reage ao sucesso', async (demo) => {
    let resolve!: () => void
    mocks.login.mockReturnValue(new Promise<void>((done) => { resolve = done }))
    const { rerender } = render(<LoginPage />)
    expect(screen.getByRole('checkbox', { name: 'Lembrar-me' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: demo.name }))
    expect(mocks.login).not.toHaveBeenCalled()
    submit()
    expect(mocks.login).toHaveBeenCalledTimes(1)
    expect(mocks.login).toHaveBeenCalledWith(demo.email, demo.password, true)
    expect(mocks.navigate).not.toHaveBeenCalled()
    await act(async () => { resolve() })
    expect(screen.getByRole('button', { name: 'Entrar na minha conta' })).toBeEnabled()
    expect(mocks.navigate).not.toHaveBeenCalled()
    mocks.auth = { isAuthenticated: true, isLoading: false }
    rerender(<LoginPage />)
    expect(mocks.navigate).toHaveBeenCalledTimes(1)
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/', replace: true })
    expect(screen.getByRole('button', { name: 'Entrar na minha conta' })).toBeDisabled()
  })

  it('aguarda verificação e redireciona só quando autenticado', () => {
    mocks.auth = { isAuthenticated: false, isLoading: true }
    const { rerender } = render(<LoginPage />)
    expect(screen.getByRole('button', { name: 'Verificando sessão...' })).toBeDisabled()
    expect(screen.getByLabelText('E-mail')).toBeDisabled()
    expect(screen.getByLabelText('Senha')).toBeDisabled()
    for (const demo of demos) {
      const button = screen.getByRole('button', { name: demo.name })
      expect(button).toBeDisabled()
      fireEvent.click(button)
    }
    expect(screen.getByLabelText('E-mail')).toHaveValue('')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    fireEvent.submit(screen.getByLabelText('E-mail').closest('form')!)
    expect(mocks.login).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
    mocks.auth = { isAuthenticated: true, isLoading: false }
    rerender(<LoginPage />)
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/', replace: true })
    expect(screen.getByRole('link', { name: 'Voltar à loja' })).toHaveAttribute('href', '/')
  })
})
