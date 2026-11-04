import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import Header from './Header'

describe('Header Black Friday navigation', () => {
  it('links to the Black Friday route and returns to the storefront through the brand', () => {
    render(<Header />)

    expect(screen.getByRole('link', { name: 'Black Friday' })).toHaveAttribute('href', '/black-friday')
    expect(screen.getByRole('link', { name: /Cockpit Store 360.*voltar à vitrine/i })).toHaveAttribute('href', '/')
  })

  it('uses storefront anchors that also work from the Black Friday route', () => {
    render(<Header />)
    const navigation = within(screen.getByRole('navigation', { name: 'Navegação principal' }))

    expect(navigation.getByRole('link', { name: 'Produtos' })).toHaveAttribute('href', '/#colecao')
    expect(navigation.getByRole('link', { name: 'Meus pedidos' })).toHaveAttribute('href', '/#pedidos')
    expect(navigation.getByRole('link', { name: 'Como evoluímos' })).toHaveAttribute('href', '/#fluxo')
  })

  it('keeps the campaign link outside hidden mobile markup', () => {
    render(<Header />)
    const link = screen.getByRole('link', { name: 'Black Friday' })

    // jsdom does not evaluate Tailwind breakpoints: check markup, not viewport CSS.
    for (let element: HTMLElement | null = link; element; element = element.parentElement) {
      expect(element).not.toHaveAttribute('hidden')
      expect(element).not.toHaveAttribute('aria-hidden', 'true')
      expect(element.classList.contains('hidden')).toBe(false)
    }
  })
})
