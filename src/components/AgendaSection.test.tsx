import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AgendaSection from './AgendaSection'

describe('AgendaSection Component', () => {
  it('renders section title and reference date notice', () => {
    render(<AgendaSection />)
    expect(screen.getByText('Programação Preliminar do Evento')).toBeInTheDocument()
    expect(
      screen.getByText(/Data de referência: 10\/11\/2026 — a confirmar/)
    ).toBeInTheDocument()
  })

  it('renders all 13 schedule items in initial view', () => {
    render(<AgendaSection />)
    expect(screen.getByText('Credenciamento, Welcome Coffee e Networking')).toBeInTheDocument()
    expect(screen.getByText('O Futuro da Gestão de Projetos: Visão Global do PMI')).toBeInTheDocument()
    expect(screen.getByText('Liderança na Era da IA: Maximizando o Sucesso de Projetos com GenAI')).toBeInTheDocument()
    expect(screen.getByText('Coffee Break da Manhã e Visitação à Expo')).toBeInTheDocument()
    expect(screen.getByText('Abordagens Híbridas em Escala: Integrando Ágil e Preditivo')).toBeInTheDocument()
    expect(screen.getByText('Power Skills Essenciais: Negociação e Resolução de Conflitos Complexos')).toBeInTheDocument()
    expect(screen.getByText('Intervalo de Almoço e Speed Mentoring')).toBeInTheDocument()
    expect(screen.getByText('PMO Orientado a Valor: Conectando Métricas de Projeto a OKRs Executivos')).toBeInTheDocument()
    expect(screen.getByText('Painel: ESG e Sustentabilidade na Gestão de Projetos de Grande Porte')).toBeInTheDocument()
    expect(screen.getByText('Coffee Break da Tarde e Troca entre Capítulos')).toBeInTheDocument()
    expect(screen.getByText('Resiliência e Inovação: Governança Eficaz sob Incertezas Globais')).toBeInTheDocument()
    expect(screen.getByText('Reconhecimento PMO do Ano, Premiação e Sorteios')).toBeInTheDocument()
    expect(screen.getByText('Happy Hour e Networking')).toBeInTheDocument()
  })

  it('filters by intervals & networking when tab is clicked', () => {
    render(<AgendaSection />)
    const filterBreaksBtn = screen.getByRole('button', { name: /Intervalos & Networking/i })
    fireEvent.click(filterBreaksBtn)

    // Should display coffee break
    expect(screen.getByText('Coffee Break da Manhã e Visitação à Expo')).toBeInTheDocument()
    // Should NOT display technical session
    expect(
      screen.queryByText('Liderança na Era da IA: Maximizando o Sucesso de Projetos com GenAI')
    ).not.toBeInTheDocument()
  })

  it('filters by sessions when tab is clicked', () => {
    render(<AgendaSection />)
    const filterSessionsBtn = screen.getByRole('button', { name: /Palestras & Sessões/i })
    fireEvent.click(filterSessionsBtn)

    // Should display technical session
    expect(
      screen.getByText('Liderança na Era da IA: Maximizando o Sucesso de Projetos com GenAI')
    ).toBeInTheDocument()
    // Should NOT display coffee break
    expect(screen.queryByText('Coffee Break da Manhã e Visitação à Expo')).not.toBeInTheDocument()
  })

  it('filters by Ways of Working editorial axis', () => {
    render(<AgendaSection />)
    const btn = screen.getByRole('button', { name: 'Ways of Working' })
    fireEvent.click(btn)

    // Expected 3 sessions
    expect(screen.getByText('Liderança na Era da IA: Maximizando o Sucesso de Projetos com GenAI')).toBeInTheDocument()
    expect(screen.getByText('Abordagens Híbridas em Escala: Integrando Ágil e Preditivo')).toBeInTheDocument()
    expect(screen.getByText('Resiliência e Inovação: Governança Eficaz sob Incertezas Globais')).toBeInTheDocument()

    // Should NOT display other axes or breaks
    expect(screen.queryByText('Power Skills Essenciais: Negociação e Resolução de Conflitos Complexos')).not.toBeInTheDocument()
    expect(screen.queryByText('Coffee Break da Manhã e Visitação à Expo')).not.toBeInTheDocument()
  })

  it('filters by Power Skills editorial axis', () => {
    render(<AgendaSection />)
    const btn = screen.getByRole('button', { name: 'Power Skills' })
    fireEvent.click(btn)

    // Expected 1 session
    expect(screen.getByText('Power Skills Essenciais: Negociação e Resolução de Conflitos Complexos')).toBeInTheDocument()
    expect(screen.queryByText('Liderança na Era da IA: Maximizando o Sucesso de Projetos com GenAI')).not.toBeInTheDocument()
  })

  it('filters by Business Acumen editorial axis', () => {
    render(<AgendaSection />)
    const btn = screen.getByRole('button', { name: 'Business Acumen' })
    fireEvent.click(btn)

    // Expected 3 sessions
    expect(screen.getByText('O Futuro da Gestão de Projetos: Visão Global do PMI')).toBeInTheDocument()
    expect(screen.getByText('PMO Orientado a Valor: Conectando Métricas de Projeto a OKRs Executivos')).toBeInTheDocument()
    expect(screen.getByText('Painel: ESG e Sustentabilidade na Gestão de Projetos de Grande Porte')).toBeInTheDocument()
    expect(screen.queryByText('Liderança na Era da IA: Maximizando o Sucesso de Projetos com GenAI')).not.toBeInTheDocument()
  })

  it('provides semantic and visual differentiation between intervals, lectures and ceremonies', () => {
    render(<AgendaSection />)
    // Check semantic article labels
    const intervalArticles = screen.getAllByLabelText(/^Intervalo:/)
    expect(intervalArticles).toHaveLength(5)

    const lectureArticles = screen.getAllByLabelText(/^Palestra:/)
    expect(lectureArticles).toHaveLength(7)

    const ceremonyArticles = screen.getAllByLabelText(/^Cerimônia:/)
    expect(ceremonyArticles).toHaveLength(1)
    expect(screen.getByText('Reconhecimento PMO do Ano, Premiação e Sorteios')).toBeInTheDocument()

    // Each lecture includes the no-PDU editorial note
    const noPduNotices = screen.getAllByText('Sem atribuição oficial de PDUs')
    expect(noPduNotices).toHaveLength(7)
  })
})
