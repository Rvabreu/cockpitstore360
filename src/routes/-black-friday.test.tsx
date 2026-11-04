import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { useLayoutEffect } from 'react'
import { BlackFridayPage, CampaignCountdown } from './black-friday'

const orbit = 'Orbit Headphones Pro'
const pulse = 'Pulse Watch S2'
const wave = 'Wave Mini Speaker'
const rhythm = 'Combo Ritmo & Imersão'
const sound = 'Combo Som em Todo Lugar'
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
  it('renders three products and two combos with original/promo prices, percentage and savings', () => {
    render(<BlackFridayPage />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(5)
    const prices = [
      [orbit, '699,00', '489,30', '30', '209,70'],
      [pulse, '899,00', '674,25', '25', '224,75'],
      [wave, '349,00', '279,20', '20', '69,80'],
      [rhythm, '1.598,00', '958,80', '40', '639,20'],
      [sound, '1.048,00', '681,20', '35', '366,80'],
    ]
    for (const [name, original, promotional, percent, saving] of prices) {
      const card = screen.getByRole('heading', { name }).closest('article')!
      expect(normalize(card.querySelector('del')?.textContent ?? null)).toBe(`R$ ${original}`)
      expect(within(card).getByText((content) => normalize(content)?.replace(/^Por\s+/, '') === `R$ ${promotional}`)).toBeInTheDocument()
      expect(within(card).getByText(`−${percent}%`)).toBeInTheDocument()
      expect(within(card).getByText(`Economize R$ ${saving}`)).toBeInTheDocument()
    }
    expect(screen.getByText(`Inclui: ${orbit} + ${pulse}`)).toBeInTheDocument()
    expect(screen.getByText(`Inclui: ${orbit} + ${wave}`)).toBeInTheDocument()
    expectTotal('Total simulado', 'R$ 0,00')
  })

  it('combines category and flash filters and clears an empty combination', () => {
    render(<BlackFridayPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Combos' }))
    expect(cardNames()).toEqual([rhythm, sound])
    fireEvent.click(screen.getByRole('checkbox', { name: /Somente/i }))
    expect(cardNames()).toEqual([rhythm])
    expect(screen.getByText('1 oferta encontrada')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Wearables' }))
    expect(cardNames()).toEqual([])
    expect(screen.getByText('0 ofertas encontradas')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nenhuma oferta nesta combinação.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByRole('checkbox', { name: /Somente/i })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(cardNames()).toEqual([rhythm, sound, orbit, pulse, wave])
  })

  it('changes the real card order for all three sorting options', () => {
    render(<BlackFridayPage />)
    const sorting = screen.getByRole('combobox', { name: 'Ordenar por' })
    expect(cardNames()).toEqual([rhythm, sound, orbit, pulse, wave])
    fireEvent.change(sorting, { target: { value: 'savings' } })
    expect(cardNames()).toEqual([rhythm, sound, pulse, orbit, wave])
    fireEvent.change(sorting, { target: { value: 'price' } })
    expect(cardNames()).toEqual([wave, orbit, pulse, sound, rhythm])
    fireEvent.change(sorting, { target: { value: 'discount' } })
    expect(cardNames()).toEqual([rhythm, sound, orbit, pulse, wave])
  })

  it('toggles each offer once, keeps filtered selections, and removes items from the summary', () => {
    render(<BlackFridayPage />)
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${orbit}` }))
    expect(screen.getByRole('button', { name: `Remover ${orbit}` })).toHaveAttribute('aria-pressed', 'true')
    expect(summary().getAllByRole('listitem')).toHaveLength(1)
    expectTotal('Total simulado', 'R$ 489,30')
    fireEvent.click(screen.getByRole('button', { name: `Remover ${orbit}` }))
    expect(summary().queryByRole('list')).not.toBeInTheDocument()
    expectTotal('Total simulado', 'R$ 0,00')
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${orbit}` }))
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${rhythm}` }))
    expect(summary().getAllByRole('listitem')).toHaveLength(2)
    expect(summary().getByText('1 kit · R$ 958,80')).toBeInTheDocument()
    expectTotal('Preço original', 'R$ 2.297,00')
    expectTotal('Subtotal promocional', 'R$ 1.448,10')
    fireEvent.click(screen.getByRole('button', { name: 'Wearables' }))
    expect(cardNames()).toEqual([pulse])
    expect(summary().getAllByRole('listitem')).toHaveLength(2)
    fireEvent.click(summary().getByRole('button', { name: `Remover ${orbit} do resumo` }))
    expect(summary().getAllByRole('listitem')).toHaveLength(1)
    expectTotal('Total simulado', 'R$ 958,80')
    fireEvent.click(summary().getByRole('button', { name: `Remover ${rhythm} do resumo` }))
    expectTotal('Total simulado', 'R$ 0,00')
  })

  it('validates trimmed case-insensitive coupons, rounds cents, and replaces discounts without stacking', () => {
    render(<BlackFridayPage />)
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${orbit}` }))
    applyCoupon('  bf360  ')
    expect(summary().getByText('Cupom BF360 aplicado: 5% de desconto extra.')).toBeInTheDocument()
    expectTotal('Cupom BF360 (5%)', '− R$ 24,47')
    expectTotal('Total simulado', 'R$ 464,83')
    expect(summary().getByText('R$ 234,17')).toBeInTheDocument()
    applyCoupon(' vIp10 ')
    expect(summary().getByText('Cupom VIP10 aplicado: 10% de desconto extra.')).toBeInTheDocument()
    expectTotal('Cupom VIP10 (10%)', '− R$ 48,93')
    expectTotal('Total simulado', 'R$ 440,37')
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${wave}` }))
    expectTotal('Subtotal promocional', 'R$ 768,50')
    expectTotal('Total simulado', 'R$ 691,65')
  })

  it('removes an applied discount on edit and gives invalid-coupon feedback without silently discounting', () => {
    render(<BlackFridayPage />)
    fireEvent.click(screen.getByRole('button', { name: `Selecionar ${orbit}` }))
    applyCoupon('VIP10')
    fireEvent.change(screen.getByRole('textbox', { name: 'Cupom de desconto' }), { target: { value: 'BF360' } })
    expect(summary().getByText('Cupom alterado. Aplique novamente para validar; desconto removido.')).toBeInTheDocument()
    expectTotal('Cupom', '− R$ 0,00')
    expectTotal('Total simulado', 'R$ 489,30')
    applyCoupon('BF360 VIP10')
    expect(summary().getByText('Cupom inválido. Use BF360 ou VIP10. Nenhum desconto de cupom aplicado.')).toBeInTheDocument()
    expectTotal('Cupom', '− R$ 0,00')
    expectTotal('Total simulado', 'R$ 489,30')
    applyCoupon('BF360')
    fireEvent.click(summary().getByRole('button', { name: `Remover ${orbit} do resumo` }))
    expectTotal('Total simulado', 'R$ 0,00')
    expectTotal('Cupom BF360 (5%)', '− R$ 0,00')
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
