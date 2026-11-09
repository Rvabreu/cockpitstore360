import { describe, expect, it, vi } from 'vitest'
import {
  BLACK_FRIDAY_DEADLINE, BLACK_FRIDAY_OFFERS, OFFER_CATEGORIES,
  calculateSummary, filterOffers, formatBRL, getCountdown, resolveCoupon,
} from './blackFridayOffers'

describe('PMI Summit DF local campaign', () => {
  it('has four independent offers with exact calculated prices and benefits', () => {
    expect(BLACK_FRIDAY_OFFERS.map(({ id, originalCents, promotionalCents, discountPercent, savingsCents }) =>
      [id, originalCents, promotionalCents, discountPercent, savingsCents],
    )).toEqual([
      ['passaporte-vip', 120000, 84000, 30, 36000],
      ['combo-ia-agil', 180000, 108000, 40, 72000],
      ['kit-oficial', 39900, 29925, 25, 9975],
      ['mentoria-express', 65000, 42250, 35, 22750],
    ])
    expect(BLACK_FRIDAY_OFFERS.map((offer) => offer.name)).toEqual([
      'Passaporte VIP PMI Summit DF', 'Combo Credencial + Workshop IA & Métodos Ágeis',
      'Kit Oficial PMI Summit DF', 'Mentoria Express PMP / Liderança',
    ])
    expect(BLACK_FRIDAY_OFFERS.map((offer) => offer.benefits)).toEqual([
      ['2 dias de congresso', 'Palestras magnas', 'Networking VIP'],
      ['Credencial para o congresso', 'Workshop IA & Métodos Ágeis', 'Aprendizado com PDUs'],
      ['Mochila executiva tech', 'Garrafa térmica inteligente', 'Caderno smart', 'Credencial VIP'],
      ['Mentoria individual', 'Líderes certificados', 'Foco em PMP e liderança'],
    ])
    for (const offer of BLACK_FRIDAY_OFFERS) {
      expect(offer).not.toHaveProperty('products')
      expect(offer.savingsCents + offer.promotionalCents).toBe(offer.originalCents)
      expect(offer.discountPercent).toBe((offer.savingsCents / offer.originalCents) * 100)
      expect(offer.lot).toContain('ilustrativ')
    }
  })

  it('does not load the audio store or fetch from the API', async () => {
    vi.resetModules()
    vi.doMock('./storeService', () => { throw new Error('Campaign must be independent') })
    try {
      const service = await import('./blackFridayOffers')
      expect(service.BLACK_FRIDAY_OFFERS).toHaveLength(4)
    } finally {
      vi.doUnmock('./storeService')
    }
  })

  it('formats cents as Brazilian reais', () => {
    expect([0, 29925, 120000].map((cents) => formatBRL(cents).replace(/\u00a0/g, ' ')))
      .toEqual(['R$ 0,00', 'R$ 299,25', 'R$ 1.200,00'])
  })

  it('filters every category, with mentoring in Workshops & Cursos', () => {
    expect(OFFER_CATEGORIES).toEqual(['Todos', 'Ingressos/Passaportes', 'Workshops & Cursos', 'Merchandising/Kits', 'Combos'])
    expect(OFFER_CATEGORIES.map((category) => filterOffers(category, 'discount').map((offer) => offer.id)))
      .toEqual([
        ['combo-ia-agil', 'mentoria-express', 'passaporte-vip', 'kit-oficial'],
        ['passaporte-vip'], ['mentoria-express'], ['kit-oficial'], ['combo-ia-agil'],
      ])
  })

  it.each([
    ['discount', ['combo-ia-agil', 'mentoria-express', 'passaporte-vip', 'kit-oficial']],
    ['savings', ['combo-ia-agil', 'passaporte-vip', 'mentoria-express', 'kit-oficial']],
    ['price', ['kit-oficial', 'mentoria-express', 'passaporte-vip', 'combo-ia-agil']],
  ] as const)('sorts by %s without mutating the catalog', (sort, expected) => {
    const original = BLACK_FRIDAY_OFFERS.map((offer) => offer.id)
    expect(filterOffers('Todos', sort).map((offer) => offer.id)).toEqual(expected)
    expect(BLACK_FRIDAY_OFFERS.map((offer) => offer.id)).toEqual(original)
  })

  it.each([
    ['PMIDF20', { code: 'PMIDF20', percent: 20 }],
    [' \tpmidf20\n', { code: 'PMIDF20', percent: 20 }],
    ['SUMMIT360', { code: 'SUMMIT360', percent: 15 }],
    ['  sUmMiT360  ', { code: 'SUMMIT360', percent: 15 }],
    ['', null], ['   ', null], ['PMIDF20 SUMMIT360', null], ['PMIDF20X', null],
    ['PMI DF20', null], ['BF360', null], ['VIP10', null],
  ])('normalizes only allowed coupon %j', (input, expected) => {
    expect(resolveCoupon(input as string)).toEqual(expected)
  })

  it('returns zero for empty/unknown selection even with a coupon', () => {
    for (const ids of [[], ['unknown']]) {
      expect(calculateSummary(ids, resolveCoupon('PMIDF20'))).toEqual({
        offers: [], originalCents: 0, subtotalCents: 0, couponDiscountCents: 0, totalCents: 0, savingsCents: 0,
      })
    }
  })

  it('counts duplicates once and treats the combo as one independent offer', () => {
    const result = calculateSummary(['passaporte-vip', 'passaporte-vip', 'combo-ia-agil', 'unknown'], null)
    expect(result.offers.map((offer) => offer.id)).toEqual(['passaporte-vip', 'combo-ia-agil'])
    expect(result).toMatchObject({ originalCents: 300000, subtotalCents: 192000, couponDiscountCents: 0, totalCents: 192000, savingsCents: 108000 })
  })

  it('calculates each coupon exactly on promo prices, replacing rather than stacking', () => {
    expect(calculateSummary(['mentoria-express'], resolveCoupon('PMIDF20'))).toMatchObject({
      originalCents: 65000, subtotalCents: 42250, couponDiscountCents: 8450, totalCents: 33800, savingsCents: 31200,
    })
    expect(calculateSummary(['mentoria-express'], resolveCoupon('SUMMIT360'))).toMatchObject({
      subtotalCents: 42250, couponDiscountCents: 6338, totalCents: 35912, savingsCents: 29088,
    })
    expect(calculateSummary(['mentoria-express'], resolveCoupon('invalid'))).toMatchObject({ couponDiscountCents: 0, totalCents: 42250 })
  })

  it.each([
    ['PMIDF20', 52835, 211340, 193560],
    ['SUMMIT360', 39626, 224549, 180351],
  ])('rounds %s once on the combined promotional subtotal', (code, couponDiscountCents, totalCents, savingsCents) => {
    const result = calculateSummary(BLACK_FRIDAY_OFFERS.map((offer) => offer.id), resolveCoupon(code as string))
    expect(result).toMatchObject({ originalCents: 404900, subtotalCents: 264175, couponDiscountCents, totalCents, savingsCents })
    expect(Object.values(result).filter((value) => typeof value === 'number').every(Number.isInteger)).toBe(true)
  })
})

describe('Black Friday fixed countdown', () => {
  it('uses the unchanged Brasília deadline and decomposes time', () => {
    expect(BLACK_FRIDAY_DEADLINE).toBe('2026-12-01T02:59:59Z')
    expect(getCountdown(Date.parse('2026-11-29T01:57:56Z')))
      .toEqual({ days: 2, hours: 1, minutes: 2, seconds: 3, ended: false })
  })

  it('keeps the final partial second visible and clamps expiration', () => {
    const deadline = Date.parse(BLACK_FRIDAY_DEADLINE)
    expect(getCountdown(deadline - 1)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1, ended: false })
    for (const now of [deadline, deadline + 1, deadline + 86400000]) {
      expect(getCountdown(now)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true })
    }
  })
})
