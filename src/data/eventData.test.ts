import { describe, expect, it } from 'vitest'
import { EDITORIAL_AXES, EVENT_METADATA, SCHEDULE_ITEMS } from './eventData'

describe('eventData configuration', () => {
  it('contains exactly 13 schedule blocks in chronological sequence', () => {
    expect(SCHEDULE_ITEMS).toHaveLength(13)

    const expectedSequence = [
      { time: '08:00–08:45', title: 'Credenciamento, Welcome Coffee e Networking', isBreak: true },
      { time: '08:45–09:15', title: 'O Futuro da Gestão de Projetos: Visão Global do PMI', isBreak: false },
      { time: '09:15–10:15', title: 'Liderança na Era da IA: Maximizando o Sucesso de Projetos com GenAI', isBreak: false },
      { time: '10:15–10:45', title: 'Coffee Break da Manhã e Visitação à Expo', isBreak: true },
      { time: '10:45–11:45', title: 'Abordagens Híbridas em Escala: Integrando Ágil e Preditivo', isBreak: false },
      { time: '11:45–12:45', title: 'Power Skills Essenciais: Negociação e Resolução de Conflitos Complexos', isBreak: false },
      { time: '12:45–14:00', title: 'Intervalo de Almoço e Speed Mentoring', isBreak: true },
      { time: '14:00–15:00', title: 'PMO Orientado a Valor: Conectando Métricas de Projeto a OKRs Executivos', isBreak: false },
      { time: '15:00–16:00', title: 'Painel: ESG e Sustentabilidade na Gestão de Projetos de Grande Porte', isBreak: false },
      { time: '16:00–16:30', title: 'Coffee Break da Tarde e Troca entre Capítulos', isBreak: true },
      { time: '16:30–17:30', title: 'Resiliência e Inovação: Governança Eficaz sob Incertezas Globais', isBreak: false },
      { time: '17:30–18:00', title: 'Reconhecimento PMO do Ano, Premiação e Sorteios', isBreak: false },
      { time: '18:00–19:30', title: 'Happy Hour e Networking', isBreak: true },
    ]

    expectedSequence.forEach((expected, idx) => {
      const actual = SCHEDULE_ITEMS[idx]
      expect(actual.timeRange).toBe(expected.time)
      expect(actual.title).toBe(expected.title)
      expect(actual.isBreak).toBe(expected.isBreak)
      expect(actual.description).toBeTruthy()
      expect(actual.index).toBe(idx + 1)
    })
  })

  it('differentiates 5 intervals/breaks from lectures and ceremonies', () => {
    const breaks = SCHEDULE_ITEMS.filter((item) => item.isBreak)
    expect(breaks).toHaveLength(5)
    expect(breaks.map((b) => b.title)).toEqual([
      'Credenciamento, Welcome Coffee e Networking',
      'Coffee Break da Manhã e Visitação à Expo',
      'Intervalo de Almoço e Speed Mentoring',
      'Coffee Break da Tarde e Troca entre Capítulos',
      'Happy Hour e Networking',
    ])
  })

  it('contains the reference date with "a confirmar"', () => {
    expect(EVENT_METADATA.referenceDate).toContain('10/11/2026 — a confirmar')
    expect(EVENT_METADATA.referenceDate).not.toBe('Hoje')
  })

  it('includes explicit non-affiliation and no-PDU disclaimers', () => {
    expect(EVENT_METADATA.officialDisclaimerText).toContain('não possui vínculo, homologação ou patrocínio oficial do PMI')
    expect(EVENT_METADATA.officialDisclaimerText).toContain('PDUs')
    expect(EVENT_METADATA.axesEditorialNotice).toContain('classificação editorial')
    expect(EVENT_METADATA.methodologyNotice).toContain('sem caráter de padrão obrigatório')
  })

  it('defines the 3 editorial axes as editorial classification', () => {
    expect(Object.keys(EDITORIAL_AXES)).toEqual([
      'ways-of-working',
      'power-skills',
      'business-acumen',
    ])
  })
})
