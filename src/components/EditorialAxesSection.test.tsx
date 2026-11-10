import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EditorialAxesSection from './EditorialAxesSection'

describe('EditorialAxesSection Component', () => {
  it('renders section title and editorial classification disclaimer', () => {
    render(<EditorialAxesSection />)
    expect(screen.getByText('Eixos Editoriais de Conteúdo')).toBeInTheDocument()
    expect(
      screen.getByText(/adotados estritamente como classificação editorial de conteúdo/i)
    ).toBeInTheDocument()
  })

  it('renders all three editorial axes', () => {
    render(<EditorialAxesSection />)
    expect(screen.getByRole('heading', { level: 3, name: 'Ways of Working' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Power Skills' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Business Acumen' })).toBeInTheDocument()
  })

  it('displays subtitles and sessions count badges for each axis', () => {
    render(<EditorialAxesSection />)
    expect(screen.getByText('Formas de Trabalhar')).toBeInTheDocument()
    expect(screen.getByText('Competências Interpessoais')).toBeInTheDocument()
    expect(screen.getByText('Visão de Negócio & Estratégia')).toBeInTheDocument()

    const threePalestras = screen.getAllByText('3 palestras')
    expect(threePalestras).toHaveLength(2) // Ways of Working (3) and Business Acumen (3)
    expect(screen.getByText('1 palestra')).toBeInTheDocument() // Power Skills (1)
  })
})
