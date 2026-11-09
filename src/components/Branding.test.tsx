import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import Header from './Header'
import Footer from './Footer'

afterEach(cleanup)

describe('PMI Summit DF identity', () => {
  it('renders one complete logo with the home link, demo badge and existing navigation', () => {
    render(<Header />)
    const logo = screen.getByRole('img', { name: 'PMI SUMMIT DF' })
    expect(logo).toHaveAttribute('src', '/assets/logo_pmi_summit_df.svg')
    expect(logo.className).not.toContain('hidden')
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'PMI Summit DF — início' })).toHaveAttribute('href', '#inicio')
    expect(screen.getByText('DEMO FICTÍCIA')).toBeInTheDocument()
    expect(screen.getByText('Brasília / DF')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Produtos' })).toHaveAttribute('href', '#colecao')
    expect(screen.getByRole('link', { name: 'Meus pedidos' })).toHaveAttribute('href', '#pedidos')
    expect(screen.getByRole('link', { name: 'Como evoluímos' })).toHaveAttribute('href', '#fluxo')
  })

  it('makes the demonstration and non-official PMI identity explicit in the footer', () => {
    render(<Footer />)
    expect(screen.getByText('PMI SUMMIT DF 360 • Projeto demonstrativo para pré-vendas e capacitação')).toBeInTheDocument()
    expect(screen.getByText(/Experiência e identidade visual conceituais, não oficiais do PMI/)).toBeInTheDocument()
    expect(screen.getByText(/AI Cockpit é a plataforma de referência/)).toBeInTheDocument()
  })

  it('ships accessible original vector lettering with no font or external image dependency', () => {
    const svg = readFileSync('public/assets/logo_pmi_summit_df.svg', 'utf8')
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
    expect(document.querySelector('parsererror')).toBeNull()
    expect(document.querySelector('title')?.textContent).toBe('PMI SUMMIT DF')
    expect(document.querySelectorAll('path').length).toBeGreaterThan(10)
    expect(document.querySelector('text, image, foreignObject')).toBeNull()
    expect(svg).not.toMatch(/font-family|OPMI/)
  })
})
