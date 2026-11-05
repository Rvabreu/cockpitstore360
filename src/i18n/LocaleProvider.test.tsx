import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { LocaleProvider, LOCALE_STORAGE_KEY, searchFeedback, useLocale } from './LocaleProvider'
import { ptBR } from './dictionaries'

function Probe() {
  const { locale, setLocale, t, translateData, formatCurrency } = useLocale()
  return (
    <>
      <span data-testid="locale">{locale}</span>
      <span>{t.hero.title}</span>
      <span>{translateData('Orbit Headphones Pro')}</span>
      <span>{translateData('Novo produto da API')}</span>
      <span>{formatCurrency(699)}</span>
      <button onClick={() => setLocale('es')}>ES</button>
      <button onClick={() => setLocale('pt-BR')}>PT</button>
    </>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.lang = 'pt-BR'
})

describe('LocaleProvider', () => {
  it('renders Portuguese on the server even with a stored Spanish preference', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es')
    const read = vi.spyOn(Storage.prototype, 'getItem')
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const html = renderToString(<LocaleProvider><Probe /></LocaleProvider>)
    expect(html).toContain('Conecte-se ao')
    expect(html).toContain('pt-BR')
    expect(read).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })

  it('reads the preference before persisting and updates the language and presentation', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es')
    const write = vi.spyOn(Storage.prototype, 'setItem')
    render(<LocaleProvider><Probe /></LocaleProvider>)
    expect(screen.getByTestId('locale')).toHaveTextContent('es')
    expect(screen.getByText('Orbit Auriculares Pro')).toBeInTheDocument()
    expect(screen.getByText('Novo produto da API')).toBeInTheDocument()
    const price = new Intl.NumberFormat('es', { style: 'currency', currency: 'BRL' }).format(699).replace(/\u00a0/g, ' ')
    expect(screen.getByText((content) => content.replace(/\u00a0/g, ' ') === price)).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('es')
    expect(write.mock.calls).toEqual([[LOCALE_STORAGE_KEY, 'es']])
    fireEvent.click(screen.getByText('PT'))
    expect(document.documentElement.lang).toBe('pt-BR')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('pt-BR')
  })

  it.each(['invalid', 'ES', 'es-ES', ''])('falls back to Portuguese for invalid preference %j', (saved) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, saved)
    render(<LocaleProvider><Probe /></LocaleProvider>)
    expect(screen.getByTestId('locale')).toHaveTextContent('pt-BR')
    expect(document.documentElement.lang).toBe('pt-BR')
  })

  it('keeps working when the localStorage accessor throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('Blocked') })
    render(<LocaleProvider><Probe /></LocaleProvider>)
    fireEvent.click(screen.getByText('ES'))
    expect(screen.getByTestId('locale')).toHaveTextContent('es')
    expect(document.documentElement.lang).toBe('es')
  })

  it('keeps working when reading and writing storage throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full') })
    render(<LocaleProvider><Probe /></LocaleProvider>)
    fireEvent.click(screen.getByText('ES'))
    expect(screen.getByTestId('locale')).toHaveTextContent('es')
  })

  it('defaults standalone consumers to Portuguese', () => {
    render(<Probe />)
    expect(screen.getByText('Conecte-se ao')).toBeInTheDocument()
    expect(screen.getByText('Orbit Headphones Pro')).toBeInTheDocument()
  })
})

describe('searchFeedback', () => {
  it('stores a translation key and result for each known service response', () => {
    expect(searchFeedback({ ok: true, message: ptBR.feedback.found })).toEqual({ key: 'found', ok: true })
    expect(searchFeedback({ ok: false, message: ptBR.feedback.notFound })).toEqual({ key: 'notFound', ok: false })
  })

  it('preserves unknown service messages rather than inventing a translation', () => {
    const result = { ok: false, message: 'API custom response' }
    expect(searchFeedback(result)).toEqual(result)
  })
})
