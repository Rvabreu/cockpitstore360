import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Header from './Header'

describe('Summit header', () => {
  it('identifies the conference and provides working home section links', () => {
    render(<Header />)
    expect(screen.getByAltText('PMI Summit Brasília • DF Chapter')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Simulador de PDUs' })).toHaveAttribute('href', '/#pdus')
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute('href', '#conteudo')
  })

  it('opens the mobile menu and closes it on navigation', () => {
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    const navigation = screen.getByRole('navigation', { name: 'Navegação móvel' })
    expect(navigation).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(navigation.querySelector('a')!)
    expect(screen.queryByRole('navigation', { name: 'Navegação móvel' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false')
  })
})
