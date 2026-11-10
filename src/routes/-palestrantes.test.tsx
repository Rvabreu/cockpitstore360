import { render, screen, within } from '@testing-library/react'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Footer from '../components/Footer'
import { ricardoBio, sessions } from '../components/todaySchedule'
import { routeTree } from '../routeTree.gen'
import { Route, SpeakersPage } from './palestrantes'

describe('palestrantes route', () => {
  it('registers /palestrantes with specific metadata', () => {
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/palestrantes'] }) })
    expect(router.matchRoutes('/palestrantes').at(-1)?.routeId).toBe('/palestrantes')
    const head = Route.options.head!({} as never)
    expect(head).toMatchObject({ meta: expect.arrayContaining([
      { title: 'Palestrantes | PMI Summit Brasília' },
      { name: 'description', content: expect.stringMatching(/perfis ilustrativos.*sujeitas à confirmação/) },
      { property: 'og:title', content: 'Palestrantes | PMI Summit Brasília' },
      { property: 'og:description', content: expect.stringContaining('a confirmar') },
    ]) })
  })

  it('renders an accessible main, one h1 and navigation to existing program and Home anchors', () => {
    render(<SpeakersPage />)
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo')
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Palestrantes.')
    expect(screen.getByRole('link', { name: /Voltar aos convidados na Home/ })).toHaveAttribute('href', '/#convidados')
    expect(screen.getByRole('link', { name: /Explore a programação de hoje/ })).toHaveAttribute('href', '/hoje#programacao-hoje')
    expect(screen.getByRole('link', { name: /Ver palestra na programação/ })).toHaveAttribute('href', '/hoje#title-magna')
    const profilesLink = screen.getByRole('link', { name: 'Ver perfis ilustrativos' })
    expect(profilesLink).toHaveAttribute('href', '#perfis-ilustrativos')
    expect(document.getElementById('perfis-ilustrativos')).toBeInTheDocument()
  })

  it('highlights only the supplied Ricardo biography and proposed magna, with a representative avatar', () => {
    const { container } = render(<SpeakersPage />)
    const ricardo = screen.getByRole('article', { name: 'Ricardo Vargas' })
    expect(within(ricardo).getByText(ricardoBio)).toBeInTheDocument()
    const magna = sessions.find((session) => session.id === 'magna')!
    expect(within(ricardo).getByRole('heading', { name: magna.title })).toBeInTheDocument()
    expect(within(ricardo).getByText(magna.summary)).toBeInTheDocument()
    expect(within(ricardo).getByText(magna.stage)).toBeInTheDocument()
    expect(within(ricardo).getByText(magna.start)).toBeInTheDocument()
    expect(within(ricardo).getByText(magna.end)).toBeInTheDocument()
    expect(within(ricardo).getByRole('img', { name: 'Avatar representativo de Ricardo Vargas, iniciais RV' })).toHaveTextContent('RV')
    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(within(ricardo).getByText('AVATAR REPRESENTATIVO · SEM FOTO')).toBeInTheDocument()
    expect(within(ricardo).getByText(/Horários, local e participação sujeitos à confirmação/)).toBeInTheDocument()
    expect(screen.getByText(/Esta página não anuncia presenças ou afiliações oficiais/)).toBeInTheDocument()
  })

  it('keeps four illustrative profiles distinct from announced people and affiliations', () => {
    render(<SpeakersPage />)
    const profiles = within(document.getElementById('perfis-ilustrativos')!)
    expect(profiles.getAllByRole('article')).toHaveLength(4)
    expect(profiles.getAllByText('Convidado a confirmar')).toHaveLength(4)
    expect(profiles.getAllByText('PERFIL ILUSTRATIVO')).toHaveLength(4)
    expect(profiles.getByText(/não representam pessoas ou afiliações anunciadas/)).toBeInTheDocument()
    for (const title of ['Quem transforma planos em impacto', 'Quem inspira novas lideranças', 'Quem conecta tecnologia e propósito', 'Quem enxerga o próximo horizonte']) {
      expect(profiles.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('includes biography and warnings in SSR without requiring JavaScript', () => {
    const html = renderToString(<SpeakersPage />)
    expect(html).toContain('Ricardo Vargas')
    expect(html).toContain('id="conteudo"')
    expect(html).toContain('Participações propostas, não confirmadas.')
    expect(html).toContain('Convidado a confirmar')
  })

  it('adds Footer speakers access without losing /hoje', () => {
    render(<Footer />)
    expect(screen.getByRole('link', { name: 'Palestrantes' })).toHaveAttribute('href', '/palestrantes')
    expect(screen.getByRole('link', { name: 'Programação de hoje' })).toHaveAttribute('href', '/hoje')
  })
})
