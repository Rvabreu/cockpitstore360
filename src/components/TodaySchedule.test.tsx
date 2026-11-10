import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TodaySchedule from './TodaySchedule'
import { AGENDA_KEY, brasiliaClock, ricardoBio, sessions, sessionStatus, validateAgenda } from './todaySchedule'

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
const magna = sessions.find((session) => session.id === 'magna')!
const saveName = (title: string) => `Salvar na Minha Agenda: ${title}`
const detailName = (title: string) => `Ver detalhes: ${title}`

describe('programação de hoje', () => {
  it('renders all eleven complete cards and the exact supplied timeline', () => {
    const { container } = render(<TodaySchedule />)
    const cards = container.querySelectorAll('.today-card')
    expect(cards).toHaveLength(11)
    expect(Array.from(cards).map((card) => Array.from(card.querySelectorAll('time')).map((time) => time.textContent))).toEqual([
      ['10:00', '11:30'], ['08:30', '09:15'], ['09:15', '09:45'], ['11:35', '12:30'], ['12:30', '14:00'], ['14:00', '15:15'], ['14:00', '15:15'], ['15:15', '16:00'], ['16:00', '17:00'], ['17:00', '18:00'], ['18:00', '19:30'],
    ])
    sessions.forEach((session) => {
      const card = screen.getByRole('heading', { name: session.title }).closest('article')!
      expect(within(card).getByText(session.stage)).toBeInTheDocument()
      expect(within(card).getByText(session.summary)).toBeInTheDocument()
      expect(within(card).getByText(`WW ${session.pdus[0]} · PS ${session.pdus[1]} · BA ${session.pdus[2]}`)).toBeInTheDocument()
      expect(within(card).getByRole('button', { name: saveName(session.title) })).toBeEnabled()
      if (session.id !== 'magna') expect(within(card).getByText(session.participants)).toBeInTheDocument()
    })
    expect(screen.getByText(/não oficialmente validada/)).toBeInTheDocument()
    expect(screen.getByText(/Agenda local neste navegador, não reserva vaga/)).toBeInTheDocument()
  })

  it('keeps the star magna, representative avatar and briefing credentials visible', () => {
    render(<TodaySchedule />)
    const card = screen.getByRole('heading', { name: magna.title }).closest('article')!
    expect(within(card).getByText('Keynote Internacional / Palestra Magna')).toBeInTheDocument()
    expect(within(card).getByText(/Mais Aguardada do Dia/)).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: /Avatar representativo de Ricardo Vargas/ })).toBeInTheDocument()
    expect(within(card).getByText('1.5 PDUs estimados')).toBeInTheDocument()
    expect(within(card).getByText('WW 0.75 · PS 0 · BA 0.75')).toBeInTheDocument()
    expect(within(card).getByText(/Credenciais segundo o briefing/)).toBeInTheDocument()
  })

  it.each([
    ['Todas as Palestras', 10, ['credenciamento', 'abertura', 'painel-publico', 'almoco', 'lideranca', 'agilidade', 'coffee', 'esg', 'encerramento', 'happy-hour']],
    ['Palco Principal Alvorada', 5, ['abertura', 'painel-publico', 'lideranca', 'esg', 'encerramento']],
    ['Trilha Inovação & IA', 1, ['agilidade']],
    ['Trilha Liderança & ESG', 2, ['lideranca', 'esg']],
  ] as const)('filters %s without hiding the magna', (label, count, ids) => {
    const { container } = render(<TodaySchedule />)
    const button = screen.getByRole('button', { name: label })
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelectorAll('.today-list article')).toHaveLength(count)
    expect(screen.getByText(new RegExp(`^${count} sess`))).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: magna.title })).toBeInTheDocument()
    expect(Array.from(container.querySelectorAll('.today-list article')).map((card) => card.getAttribute('aria-labelledby'))).toEqual(ids.map((id) => `title-${id}`))
  })

  it('saves and removes only IDs, announces feedback and restores on remount', () => {
    const view = render(<TodaySchedule />)
    fireEvent.click(screen.getByRole('button', { name: saveName(magna.title) }))
    expect(screen.getByText('Adicionado à sua agenda')).toBeInTheDocument()
    expect(localStorage.getItem(AGENDA_KEY)).toBe('["magna"]')
    expect(screen.getByText('Minha Agenda · 1 sessão salva')).toBeInTheDocument()
    view.unmount()
    render(<TodaySchedule />)
    const remove = screen.getByRole('button', { name: `Salvo · Remover da Minha Agenda: ${magna.title}` })
    expect(remove).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(remove)
    expect(screen.getByText('Removido da sua agenda')).toBeInTheDocument()
    expect(localStorage.getItem(AGENDA_KEY)).toBe('[]')
  })

  it.each(['{broken', '{"magna":true}', '["magna","unknown",99,"magna",null]'])('recovers invalid stored agenda %s', (raw) => {
    localStorage.setItem(AGENDA_KEY, raw)
    render(<TodaySchedule />)
    expect(localStorage.getItem(AGENDA_KEY)).toBe(raw.startsWith('[') ? '["magna"]' : '[]')
    expect(screen.getByRole('button', { name: raw.startsWith('[') ? `Salvo · Remover da Minha Agenda: ${magna.title}` : saveName(magna.title) })).toBeEnabled()
  })

  it('allows agenda changes when localStorage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(<TodaySchedule />)
    fireEvent.click(screen.getByRole('button', { name: saveName(magna.title) }))
    expect(screen.getByText(/Sua agenda funciona apenas nesta visita/)).toBeInTheDocument()
    expect(screen.getByText('Minha Agenda · 1 sessão salva')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `Salvo · Remover da Minha Agenda: ${magna.title}` }))
    expect(screen.getByText('Minha Agenda · 0 sessões salvas')).toBeInTheDocument()
  })

  it('opens details for every session with specific topics and available biographies', () => {
    render(<TodaySchedule />)
    sessions.forEach((session) => {
      fireEvent.click(screen.getByRole('button', { name: detailName(session.title) }))
      const dialog = screen.getByRole('dialog', { name: session.title })
      expect(within(dialog).getByText(session.participants)).toBeInTheDocument()
      session.topics.forEach((topic) => expect(within(dialog).getByText(topic)).toBeInTheDocument())
      expect(within(dialog).getByText(session.id === 'magna' ? ricardoBio : /Biografias completas.*a confirmar/)).toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar detalhes' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('traps focus, locks scrolling, handles Escape and returns focus after modal actions', () => {
    render(<TodaySchedule />)
    const trigger = screen.getByRole('button', { name: detailName(magna.title) })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    const close = within(dialog).getByRole('button', { name: 'Fechar detalhes' })
    const save = within(dialog).getByRole('button', { name: 'Salvar na Minha Agenda' })
    expect(close).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(save).toHaveFocus()
    fireEvent.keyDown(save, { key: 'Tab' })
    expect(close).toHaveFocus()
    trigger.focus()
    expect(close).toHaveFocus()
    fireEvent.click(save)
    expect(within(dialog).getByRole('button', { name: 'Salvo · Remover da Minha Agenda' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
    expect(trigger).toHaveFocus()
  })

  it('has deterministic SSR without clock/storage access and hydrates without mismatches', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T13:00:00Z'))
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const error = vi.spyOn(console, 'error')
    const html = renderToString(<TodaySchedule />)
    expect(getItem).not.toHaveBeenCalled()
    expect(html).toContain('Data de hoje ao carregar')
    expect(html).not.toContain('Em andamento')
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    expect(container.querySelector('.today-actions button')).toBeDisabled()
    render(<TodaySchedule />, { container, hydrate: true })
    expect(error).not.toHaveBeenCalled()
    expect(screen.getByText('10/11/2026')).toHaveAttribute('dateTime', '2026-11-10')
    const card = screen.getByRole('heading', { name: magna.title }).closest('article')!
    expect(within(card).getByText('Agora / Em andamento')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: saveName(magna.title) })).toBeEnabled()
    act(() => { vi.advanceTimersByTime(90 * 60_000) })
    expect(within(card).getByText('Concluída')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(13 * 60 * 60_000) })
    expect(screen.getByText('11/11/2026')).toBeInTheDocument()
    expect(within(card).getByText('Programada')).toBeInTheDocument()
  })

  it('expires toast feedback after four seconds', () => {
    vi.useFakeTimers()
    render(<TodaySchedule />)
    fireEvent.click(screen.getByRole('button', { name: saveName(magna.title) }))
    expect(screen.getByText('Adicionado à sua agenda')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(4000) })
    expect(screen.queryByText('Adicionado à sua agenda')).not.toBeInTheDocument()
  })
})

describe('Brasília clock and status boundaries', () => {
  it('uses Brasília date and minutes independent of UTC date, including midnight', () => {
    expect(brasiliaClock(new Date('2026-11-11T01:30:00Z'))).toEqual({ date: '2026-11-10', label: '10/11/2026', minutes: 22 * 60 + 30 })
    expect(brasiliaClock(new Date('2026-11-11T03:00:00Z'))).toEqual({ date: '2026-11-11', label: '11/11/2026', minutes: 0 })
  })
  it.each([
    ['credenciamento', 8 * 60 + 29, 'A seguir'], ['credenciamento', 8 * 60 + 30, 'Agora / Em andamento'],
    ['credenciamento', 9 * 60 + 15, 'Concluída'], ['abertura', 9 * 60 + 15, 'Agora / Em andamento'],
    ['magna', 9 * 60 + 45, 'A seguir'], ['magna', 10 * 60, 'Agora / Em andamento'],
    ['magna', 11 * 60 + 30, 'Concluída'], ['painel-publico', 11 * 60 + 30, 'A seguir'],
    ['lideranca', 13 * 60, 'A seguir'], ['agilidade', 13 * 60, 'A seguir'],
    ['lideranca', 14 * 60, 'Agora / Em andamento'], ['agilidade', 14 * 60, 'Agora / Em andamento'],
    ['coffee', 14 * 60, 'A seguir'], ['esg', 14 * 60, 'Programada'],
    ['happy-hour', 19 * 60 + 30, 'Concluída'], ['magna', null, 'Programada'],
  ])('%s at %s minutes is %s', (id, now, expected) => {
    expect(sessionStatus(sessions.find((session) => session.id === id)!, now as number | null)).toBe(expected)
  })
  it('validates local IDs without accepting session objects or duplicates', () => {
    expect(validateAgenda(['magna', 'magna', 'unknown', { id: 'agilidade' }, 'esg'])).toEqual(['magna', 'esg'])
    expect(validateAgenda(null)).toEqual([])
  })
})
