import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { LocaleProvider } from './LocaleProvider'

function Layout() {
  return <LocaleProvider><Header /><Footer /></LocaleProvider>
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'pt-BR'
})

afterEach(cleanup)

describe('LocaleProvider shared layout persistence', () => {
  it('defaults to Portuguese and preserves both Spanish and Portuguese selections across remounts', async () => {
    const firstMount = render(<Layout />)
    expect(screen.getByRole('button', { name: 'PT Português' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Meus pedidos' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'ES Español' }))
    expect(localStorage.getItem('store360-locale')).toBe('es')
    expect(screen.getByRole('button', { name: 'PT Português' })).toHaveAttribute('aria-pressed', 'false')
    firstMount.unmount()

    const nextMount = render(<Layout />)
    await waitFor(() => expect(screen.getByRole('link', { name: 'Mis pedidos' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'ES Español' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('AI Cockpit es la plataforma de referencia. Esta tienda no es un producto oficial.')).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'es')
    fireEvent.click(screen.getByRole('button', { name: 'PT Português' }))
    expect(localStorage.getItem('store360-locale')).toBe('pt-BR')
    nextMount.unmount()

    render(<Layout />)
    expect(screen.getByRole('link', { name: 'Meus pedidos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PT Português' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).toHaveAttribute('lang', 'pt-BR')
  })
})
