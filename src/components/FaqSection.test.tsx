import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FaqSection from './FaqSection'

describe('FaqSection Component', () => {
  it('renders all FAQ questions', () => {
    render(<FaqSection />)
    expect(screen.getByText('Perguntas Frequentes & Esclarecimentos')).toBeInTheDocument()
    expect(screen.getByText(/A data do evento e a grade de palestras já estão confirmadas\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Este evento emite PDUs para certificações do PMI\?/i)).toBeInTheDocument()
    expect(screen.getByText(/O One-Page Project Manager \(OPPM\) é obrigatório pelo PMI\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Posso imprimir ou salvar esta programação\?/i)).toBeInTheDocument()
  })

  it('first item is expanded by default and can be toggled', () => {
    render(<FaqSection />)
    const firstButton = screen.getByRole('button', {
      name: /A data do evento e a grade de palestras já estão confirmadas\?/i,
    })
    expect(firstButton).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByText(/Esta página exibe uma grade preliminar e conceitual/i)
    ).toBeInTheDocument()

    // Collapse first item
    fireEvent.click(firstButton)
    expect(firstButton).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByText(/Esta página exibe uma grade preliminar e conceitual/i)
    ).not.toBeInTheDocument()
  })

  it('can expand the OPPM question and shows non-mandatory statement', () => {
    render(<FaqSection />)
    const oppmButton = screen.getByRole('button', {
      name: /O One-Page Project Manager \(OPPM\) é obrigatório pelo PMI\?/i,
    })
    expect(oppmButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(oppmButton)
    expect(oppmButton).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByText(/não um padrão exclusivo ou compulsório do PMI/i)
    ).toBeInTheDocument()
  })
})
