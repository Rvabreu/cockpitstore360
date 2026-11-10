import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AboutSection from './AboutSection'

describe('AboutSection Component', () => {
  it('renders section title and contextual cards', () => {
    render(<AboutSection />)
    expect(screen.getByText('Sobre esta proposta preliminar')).toBeInTheDocument()
    expect(screen.getByText('Estrutura Preliminar de Evento')).toBeInTheDocument()
    expect(screen.getByText('Independência & Isenção de Vínculos')).toBeInTheDocument()
    expect(screen.getByText('Pluralidade Metodológica')).toBeInTheDocument()
  })

  it('renders disclaimer about no PMI affiliation and no PDUs', () => {
    render(<AboutSection />)
    expect(
      screen.getByText(/Não há afiliação formal, licenciamento, homologação ou patrocínio oficial do PMI/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Sem concessão de PDUs ou chancela institucional/i)
    ).toBeInTheDocument()
  })

  it('renders methodology disclaimer confirming OPPM and other methods are not mandatory standards', () => {
    render(<AboutSection />)
    expect(
      screen.getByText(/sem caráter de padrão obrigatório/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Liberdade metodológica sem padrões obrigatórios/i)
    ).toBeInTheDocument()
  })
})
