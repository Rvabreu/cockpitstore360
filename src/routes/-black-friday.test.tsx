import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { useLayoutEffect } from 'react'
import { BlackFridayPage, CampaignCountdown } from './black-friday'

const vip = 'Passaporte VIP PMI Summit DF'
const combo = 'Combo Credencial + Workshop IA & Métodos Ágeis'
const kit = 'Kit Oficial PMI Summit DF'
const mentoring = 'Mentoria Express PMP / Liderança'
const normalize = (text: string | null) => text?.replace(/\u00a0/g, ' ')
const cardNames = () => screen.queryAllByRole('article').map((card) => within(card).getByRole('heading', { level: 3 }).textContent)
const summary = () => within(screen.getByRole('complementary', { name: 'Resumo da simulação' }))
function expectTotal(label: string, amount: string) {
  const term = summary().getByText(label, { selector: 'dt' })
  expect(normalize(term.nextElementSibling?.textContent ?? null)).toBe(amount)
}
function applyCoupon(input: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Cupom de desconto' }), { target: { value: input } })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('BlackFridayPage', () => {
  it('offers demo login navigation without removing public offers and simulation links', () => {
    render(<BlackFridayPage />)
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/black-friday/login')
    expect(screen.getByRole('link', { name: 'Explorar ofertas' })).toHaveAttribute('href', '#ofertas')
    expect(screen.getByRole('link', { name: 'Simular economia' })).toHaveAttribute('href', '#simulacao')
  })

  it('renders the event identity and four illustrative offers with exact prices and benefits', () => {
    render(<BlackFridayPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('BLACK FRIDAY PMI SUMMIT DF')
    expect(screen.getByRole('img', { name: /Ilustração original de Brasília/ })).toBeInTheDocument()
    expect(screen.getByText(/Gestão de projetos, liderança e inovação no Centro-Oeste/)).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(4)
    const prices = [
      [vip, '1.200,00', '840,00', '30', '360,00'],
      [combo, '1.800,00', '1.080,00', '40', '720,00'],
      [kit, '399,00', '299,25', '25', '99,75'],
      [mentoring, '650,00', '422,50', '35', '227,50'],
    ]
    for (const [name, original, promotional, percent, saving] of prices) {
      const card = screen.getByRole('heading', { name }).closest('article')!
      expect(normalize(card.querySelector('del')?.textContent ?? null)).toBe(`R$ ${original}`)
      expect(within(card).getByText((content) => normalize(content)?.replace(/^Por\s+/, '') === `R$ ${promotional}`)).toBeInTheDocument()
      expect(within(card).getByText(`−${percent}%`)).toBeInTheDocument()
      expect(within(card).getByText(`Economize R$ ${saving}`)).toBeInTheDocument()
    }
    for (const benefit of ['2 dias de congresso', 'Palestras magnas', 'Networking VIP', 'Workshop IA & Métodos Ágeis', 'Aprendizado com PDUs', 'Mochila executiva tech', 'Garrafa térmica inteligente', 'Caderno smart', 'Credencial VIP', 'Mentoria individual', 'Líderes certificados']) {
      expect(screen.getByText(benefit)).toBeInTheDocument()
    }
    expect(screen.getAllByText('Acumula PDUs')).toHaveLength(2)
    expect(screen.getAllByText('Vagas Limitadas DF')).toHaveLength(2)
    expect(screen.getAllByText('Exclusivo Black Friday')).toHaveLength(2)
    expect(screen.getByText(/Simulação sem validação de filiação/)).toHaveTextContent(/benefícios.*lotes e preços são ilustrativos/)
    expect(screen.queryByText(/Orbit|Pulse|Wave/)).not.toBeInTheDocument()
    expectTotal('Total simulado', 'R$ 0,00')
  })

  it('filters all categories and puts mentoring under Workshops & Cursos', () => {
    render(<BlackFridayPage />)
    for (const [category, name] of [['Combos', combo], ['Ingressos/Passaportes', vip], ['Workshops & Cursos', mentoring], ['Merchandising/Kits', kit]]) {
      fireEvent.click(screen.getByRole('button', { name: category }))
      expect(cardNames()).toEqual([name])
      expect(screen.getByText('1 oferta encontrada')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: category })).toHaveAttribute('aria-pressed', 'true')
    }
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(cardNames()).toEqual([combo, mentoring, vip, kit])
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('changes the real card order for all three sorting options', () => {
    render(<BlackFridayPage />)
    const sorting = screen.getByRole('combobox', { name: 'Ordenar por' })
    expect(cardNames()).toEqual([combo, mentoring, vip, kit])
    fireEvent.change(sorting, { target: { value: 'savings' } })
    expect(cardNames()).toEqual([combo, vip, mentoring, kit])
    fireEvent.change(sorting, { target: { value: 'price' } })
    expect(cardNames()).toEqual([kit, mentoring, vip, combo])
    fireEvent.change(sorting, { target: { value: 'discount' } })
    expect(cardNames()).toEqual([combo, mentoring, vip, kit])
  })

  it('toggles each offer once, keeps filtered selections, and removes items from the summary', () => {
    render(<BlackFridayPage />)
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${vip}` }))
    expect(screen.getByRole('button', { name: `Remover ${vip}` })).toHaveAttribute('aria-pressed', 'true')
    expect(summary().getAllByRole('listitem')).toHaveLength(1)
    expectTotal('Total simulado', 'R$ 840,00')
    fireEvent.click(screen.getByRole('button', { name: `Remover ${vip}` }))
    expect(summary().queryByRole('list')).not.toBeInTheDocument()
    expectTotal('Total simulado', 'R$ 0,00')
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${vip}` }))
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${combo}` }))
    expect(summary().getAllByRole('listitem')).toHaveLength(2)
    expect(summary().getByText('1 kit · R$ 1.080,00')).toBeInTheDocument()
    expectTotal('Preço original', 'R$ 3.000,00')
    expectTotal('Subtotal promocional', 'R$ 1.920,00')
    fireEvent.click(screen.getByRole('button', { name: 'Workshops & Cursos' }))
    expect(cardNames()).toEqual([mentoring])
    expect(summary().getAllByRole('listitem')).toHaveLength(2)
    fireEvent.click(summary().getByRole('button', { name: `Remover ${vip} do resumo` }))
    expect(summary().getAllByRole('listitem')).toHaveLength(1)
    expectTotal('Total simulado', 'R$ 1.080,00')
    fireEvent.click(summary().getByRole('button', { name: `Remover ${combo} do resumo` }))
    expectTotal('Total simulado', 'R$ 0,00')
  })

  it('validates trimmed case-insensitive coupons, rounds cents, and replaces discounts without stacking', () => {
    render(<BlackFridayPage />)
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${mentoring}` }))
    applyCoupon('  pmidf20  ')
    expect(summary().getByText('Cupom PMIDF20 simulado: 20% de desconto extra, sem validação de elegibilidade.')).toBeInTheDocument()
    expectTotal('Cupom PMIDF20 (20%)', '− R$ 84,50')
    expectTotal('Total simulado', 'R$ 338,00')
    expect(summary().getByText('R$ 312,00')).toBeInTheDocument()
    applyCoupon(' sUmMiT360 ')
    expect(summary().getByText('Cupom SUMMIT360 simulado: 15% de desconto extra, sem validação de elegibilidade.')).toBeInTheDocument()
    expectTotal('Cupom SUMMIT360 (15%)', '− R$ 63,38')
    expectTotal('Total simulado', 'R$ 359,12')
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${kit}` }))
    expectTotal('Subtotal promocional', 'R$ 721,75')
    expectTotal('Total simulado', 'R$ 613,49')
    expect(summary().getByText('R$ 435,51')).toBeInTheDocument()
  })

  it('removes an applied discount on edit and gives invalid-coupon feedback without silently discounting', () => {
    render(<BlackFridayPage />)
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${vip}` }))
    applyCoupon('SUMMIT360')
    fireEvent.change(screen.getByRole('textbox', { name: 'Cupom de desconto' }), { target: { value: 'PMIDF20' } })
    expect(summary().getByText('Cupom alterado. Aplique novamente para simular; desconto removido.')).toBeInTheDocument()
    expectTotal('Cupom', '− R$ 0,00')
    expectTotal('Total simulado', 'R$ 840,00')
    applyCoupon('PMIDF20 SUMMIT360')
    expect(summary().getByText('Cupom inválido. Use PMIDF20 ou SUMMIT360. Nenhum desconto de cupom aplicado.')).toBeInTheDocument()
    expectTotal('Cupom', '− R$ 0,00')
    expectTotal('Total simulado', 'R$ 840,00')
    applyCoupon('PMIDF20')
    fireEvent.click(summary().getByRole('button', { name: `Remover ${vip} do resumo` }))
    expectTotal('Total simulado', 'R$ 0,00')
    expectTotal('Cupom PMIDF20 (20%)', '− R$ 0,00')
  })

  it('keeps the whole page SSR stable across dates, with no clock read', () => {
    const now = vi.spyOn(Date, 'now')
    const first = renderToString(<BlackFridayPage />)
    now.mockReturnValue(Date.parse('2026-12-02T12:00:00Z'))
    expect(renderToString(<BlackFridayPage />)).toBe(first)
    expect(now).not.toHaveBeenCalled()
    expect(first.match(/<strong>--<\/strong>/g)).toHaveLength(4)
  })

  it('retains simulation and transparency after expiration, without checkout', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-02T12:00:00Z'))
    render(<BlackFridayPage />)
    expect(screen.getByRole('timer', { name: 'Campanha encerrada' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${vip}` }))
    applyCoupon('PMIDF20')
    expectTotal('Total simulado', 'R$ 672,00')
    expect(screen.getByText(/Simulação sem validação de filiação/)).toHaveTextContent(/não reserva vagas.*mesmo após o encerramento/)
    expect(screen.queryByRole('button', { name: /comprar|pagar|reservar|checkout/i })).not.toBeInTheDocument()
  })
})

describe('CampaignCountdown SSR and client lifecycle', () => {
  it('renders four SSR placeholders without reading the current time', () => {
    const now = vi.spyOn(Date, 'now')
    const html = renderToString(<CampaignCountdown />)
    expect(html.match(/<strong>--<\/strong>/g)).toHaveLength(4)
    expect(html).not.toContain('Campanha encerrada')
    expect(now).not.toHaveBeenCalled()
  })

  it('matches SSR placeholders on hydration, then updates in the effect without hydration errors', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-29T01:57:56Z'))
    const container = document.createElement('div')
    container.innerHTML = renderToString(<CampaignCountdown />)
    document.body.append(container)
    const initialMarkup = container.innerHTML
    const onRecoverableError = vi.fn()
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      await act(async () => {
        root = hydrateRoot(container, <CampaignCountdown />, { onRecoverableError })
        expect(container.innerHTML).toBe(initialMarkup)
      })
      expect([...container.querySelectorAll('strong')].map((element) => element.textContent)).toEqual(['02', '01', '02', '03'])
      expect(onRecoverableError).not.toHaveBeenCalled()
    } finally {
      act(() => root?.unmount())
      container.remove()
    }
    expect(vi.getTimerCount()).toBe(0)
  })

  it('has placeholders on first client commit, ticks to expiration, and clears the interval on unmount', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-01T02:59:57Z'))
    const setInterval = vi.spyOn(window, 'setInterval')
    let firstCommit: Array<string | null> = []
    function ObserveFirstCommit() {
      // Layout effects observe committed markup before the countdown's passive effect.
      useLayoutEffect(() => {
        firstCommit = [...screen.getByRole('timer').querySelectorAll('strong')].map((element) => element.textContent)
      }, [])
      return <CampaignCountdown />
    }
    const clearInterval = vi.spyOn(window, 'clearInterval')
    const { unmount } = render(<ObserveFirstCommit />)
    expect(firstCommit).toEqual(['--', '--', '--', '--'])
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000)
    expect([...screen.getByRole('timer').querySelectorAll('strong')].map((element) => element.textContent)).toEqual(['00', '00', '00', '02'])
    expect(vi.getTimerCount()).toBe(1)
    act(() => vi.advanceTimersByTime(1000))
    expect([...screen.getByRole('timer').querySelectorAll('strong')].map((element) => element.textContent)).toEqual(['00', '00', '00', '01'])
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByRole('timer', { name: 'Campanha encerrada' })).toBeInTheDocument()
    expect([...screen.getByRole('timer').querySelectorAll('strong')].map((element) => element.textContent)).toEqual(['00', '00', '00', '00'])
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByRole('timer', { name: 'Campanha encerrada' })).toHaveTextContent('00')
    unmount()
    expect(clearInterval).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shows the ended state immediately in the effect when opened after the deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-02T12:00:00Z'))
    render(<CampaignCountdown />)
    expect(screen.getByRole('timer', { name: 'Campanha encerrada' })).toBeInTheDocument()
    expect([...screen.getByRole('timer').querySelectorAll('strong')].map((element) => element.textContent)).toEqual(['00', '00', '00', '00'])
  })
})
