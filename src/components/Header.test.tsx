import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Header from './Header'

const mocks = vi.hoisted(() => ({ logout: vi.fn(), auth: { user: null as null | { name: string }, isLoading: false, sessionError: null as string | null } }))
vi.mock('../context/useAuth', () => ({ useAuth: () => ({ ...mocks.auth, logout: mocks.logout }) }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}))
beforeEach(() => { mocks.auth = { user: null, isLoading: false, sessionError: null }; mocks.logout.mockReset() })
afterEach(cleanup)

describe('Header autenticado', () => {
  it('omite Entrar/Sair enquanto verifica a sessão', () => {
    mocks.auth.isLoading = true
    render(<Header />)
    expect(screen.getByRole('status')).toHaveAccessibleName('Verificando sessão')
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
  })

  it('mostra Entrar para /login e âncoras absolutas da loja, inclusive tracking', () => {
    render(<Header />)
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Produtos' })).toHaveAttribute('href', '/#colecao')
    expect(screen.getByRole('link', { name: 'Meus pedidos' })).toHaveAttribute('href', '/#pedidos')
    expect(screen.getByRole('link', { name: 'Como evoluímos' })).toHaveAttribute('href', '/#fluxo')
    expect(screen.getByRole('link', { name: /COCKPIT/ })).toHaveAttribute('href', '/#inicio')
  })

  it('mostra nome/avatar, chama logout e permite exibir aviso de sessão', () => {
    mocks.auth.user = { name: 'Cliente Demo' }
    const { rerender } = render(<Header />)
    expect(screen.getByText('Cliente Demo')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(mocks.logout).toHaveBeenCalledTimes(1)
    mocks.auth.sessionError = 'Não foi possível encerrar a sessão no servidor.'
    rerender(<Header />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível encerrar')
  })
})
