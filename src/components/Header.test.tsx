import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Header from './Header'

describe('Summit header', () => {
  it('identifies the conference and provides working home section links', () => {
    render(<Header />)
    expect(screen.getByAltText('PMI Summit Brasília • DF Chapter')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Simulador de PDUs' })).toHaveAttribute('href', '/#pdus')
    expect(screen.getByRole('link', { name: 'Palestras de hoje' })).toHaveAttribute('href', '/#programacao-hoje')
    expect(screen.getByRole('link', { name: 'Palestrantes' })).toHaveAttribute('href', '/palestrantes')
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getAllByRole('link')).toHaveLength(7)
    expect(screen.queryByRole('link', { name: 'Página de hoje' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute('href', '#conteudo')
  })

  it('opens the mobile menu and closes it on navigation', () => {
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    const navigation = screen.getByRole('navigation', { name: 'Navegação móvel' })
    expect(navigation).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true')
    const speakersLink = within(navigation).getByRole('link', { name: 'Palestrantes' })
    expect(speakersLink).toHaveAttribute('href', '/palestrantes')
    speakersLink.addEventListener('click', (event) => event.preventDefault())
    fireEvent.click(speakersLink)
    expect(screen.queryByRole('navigation', { name: 'Navegação móvel' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false')
  })
})
