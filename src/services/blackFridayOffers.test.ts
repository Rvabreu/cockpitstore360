import { describe, expect, it } from 'vitest'
import {
  BLACK_FRIDAY_DEADLINE, BLACK_FRIDAY_OFFERS, OFFER_CATEGORIES,
  calculateSummary, filterOffers, formatBRL, getCountdown, resolveCoupon,
} from './blackFridayOffers'

describe('Black Friday offer calculations', () => {
  it('provides three individual products and two combos with coherent cent prices', () => {
    expect(BLACK_FRIDAY_OFFERS.map(({ id, originalCents, promotionalCents, discountPercent, savingsCents }) =>
      [id, originalCents, promotionalCents, discountPercent, savingsCents],
    )).toEqual([
      ['prod-orbit', 69900, 48930, 30, 20970],
      ['prod-pulse', 89900, 67425, 25, 22475],
      ['prod-wave', 34900, 27920, 20, 6980],
      ['combo-orbit-pulse', 159800, 95880, 40, 63920],
      ['combo-orbit-wave', 104800, 68120, 35, 36680],
    ])
    expect(BLACK_FRIDAY_OFFERS.filter((offer) => offer.products.length === 1)).toHaveLength(3)
    expect(BLACK_FRIDAY_OFFERS.filter((offer) => offer.category === 'Combos').map((offer) =>
      offer.products.map((product) => product.id),
    )).toEqual([['prod-orbit', 'prod-pulse'], ['prod-orbit', 'prod-wave']])
    for (const offer of BLACK_FRIDAY_OFFERS) {
      expect(offer.originalCents).toBe(offer.products.reduce((sum, product) => sum + Math.round(product.price * 100), 0))
      expect(offer.promotionalCents).toBe(Math.round(offer.originalCents * (100 - offer.discountPercent) / 100))
      expect(offer.savingsCents + offer.promotionalCents).toBe(offer.originalCents)
    }
  })

  it('formats cents as Brazilian reais, including zero and rounded cents', () => {
    expect([0, 48930, 46483, 159800].map((cents) => formatBRL(cents).replace(/\u00a0/g, ' ')))
      .toEqual(['R$ 0,00', 'R$ 489,30', 'R$ 464,83', 'R$ 1.598,00'])
  })

  it('combines every category with the flash filter, including an empty result', () => {
    expect(OFFER_CATEGORIES).toEqual(['Todos', 'Áudio imersivo', 'Wearables', 'Áudio conectado', 'Combos'])
    expect(filterOffers('Todos', true, 'discount').map((offer) => offer.id))
      .toEqual(['combo-orbit-pulse', 'prod-orbit', 'prod-wave'])
    expect(filterOffers('Combos', false, 'discount').map((offer) => offer.id))
      .toEqual(['combo-orbit-pulse', 'combo-orbit-wave'])
    expect(filterOffers('Combos', true, 'discount').map((offer) => offer.id)).toEqual(['combo-orbit-pulse'])
    expect(filterOffers('Áudio imersivo', true, 'discount').map((offer) => offer.id)).toEqual(['prod-orbit'])
    expect(filterOffers('Áudio conectado', true, 'discount').map((offer) => offer.id)).toEqual(['prod-wave'])
    expect(filterOffers('Wearables', true, 'discount')).toEqual([])
  })

  it.each([
    ['discount', ['combo-orbit-pulse', 'combo-orbit-wave', 'prod-orbit', 'prod-pulse', 'prod-wave']],
    ['savings', ['combo-orbit-pulse', 'combo-orbit-wave', 'prod-pulse', 'prod-orbit', 'prod-wave']],
    ['price', ['prod-wave', 'prod-orbit', 'prod-pulse', 'combo-orbit-wave', 'combo-orbit-pulse']],
  ] as const)('sorts by %s without mutating the original catalog', (sort, expected) => {
    const original = BLACK_FRIDAY_OFFERS.map((offer) => offer.id)
    expect(filterOffers('Todos', false, sort).map((offer) => offer.id)).toEqual(expected)
    expect(BLACK_FRIDAY_OFFERS.map((offer) => offer.id)).toEqual(original)
  })

  it.each([
    ['BF360', { code: 'BF360', percent: 5 }],
    [' \tbf360\n', { code: 'BF360', percent: 5 }],
    ['VIP10', { code: 'VIP10', percent: 10 }],
    ['  vIp10  ', { code: 'VIP10', percent: 10 }],
    ['', null], ['   ', null], ['BF360 VIP10', null], ['BF360X', null], ['VIP 10', null],
  ])('validates the entire coupon input %j, accepting case and outer whitespace only', (input, expected) => {
    expect(resolveCoupon(input as string)).toEqual(expected)
  })

  it('returns a zero summary for an empty or unknown selection even with a coupon', () => {
    for (const ids of [[], ['unknown']]) {
      expect(calculateSummary(ids, resolveCoupon('VIP10'))).toEqual({
        offers: [], originalCents: 0, subtotalCents: 0, couponDiscountCents: 0, totalCents: 0, savingsCents: 0,
      })
    }
  })

  it('counts duplicate offers once and treats a combo as one kit, not extra individual items', () => {
    const result = calculateSummary(['prod-orbit', 'prod-orbit', 'combo-orbit-pulse', 'unknown'], null)
    expect(result.offers.map((offer) => offer.id)).toEqual(['prod-orbit', 'combo-orbit-pulse'])
    expect(result).toMatchObject({ originalCents: 229700, subtotalCents: 144810, couponDiscountCents: 0, totalCents: 144810, savingsCents: 84890 })
  })

  it('rounds a half-cent coupon discount once and replaces rather than stacks coupons', () => {
    expect(calculateSummary(['prod-orbit'], resolveCoupon('BF360'))).toMatchObject({
      originalCents: 69900, subtotalCents: 48930, couponDiscountCents: 2447, totalCents: 46483, savingsCents: 23417,
    })
    expect(calculateSummary(['prod-orbit'], resolveCoupon('VIP10'))).toMatchObject({
      subtotalCents: 48930, couponDiscountCents: 4893, totalCents: 44037, savingsCents: 25863,
    })
    expect(calculateSummary(['prod-orbit'], resolveCoupon('invalid'))).toMatchObject({ couponDiscountCents: 0, totalCents: 48930 })
  })

  it('rounds the coupon on the combined promotional subtotal, not per card', () => {
    const summary = calculateSummary(BLACK_FRIDAY_OFFERS.map((offer) => offer.id), resolveCoupon('BF360'))
    expect(summary).toMatchObject({ originalCents: 459300, subtotalCents: 308275, couponDiscountCents: 15414, totalCents: 292861, savingsCents: 166439 })
    expect(Object.values(summary).filter((value) => typeof value === 'number').every(Number.isInteger)).toBe(true)
  })
})

describe('Black Friday fixed countdown', () => {
  it('uses the fixed Brasília deadline and decomposes days/hours/minutes/seconds', () => {
    expect(BLACK_FRIDAY_DEADLINE).toBe('2026-12-01T02:59:59Z')
    expect(getCountdown(Date.parse('2026-11-29T01:57:56Z')))
      .toEqual({ days: 2, hours: 1, minutes: 2, seconds: 3, ended: false })
  })

  it('keeps the final partial second visible and clamps at and after expiration', () => {
    const deadline = Date.parse('2026-12-01T02:59:59Z')
    expect(getCountdown(deadline - 1)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1, ended: false })
    for (const now of [deadline, deadline + 1, deadline + 86400000]) {
      expect(getCountdown(now)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true })
    }
  })
})
