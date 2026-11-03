import { describe, expect, it } from 'vitest'
import { INITIAL_PRODUCTS } from '../server/seed'
import { INITIAL_FILTERS, comboFor, couponSaving, promotionFor, selectPromotions } from './blackFridayPromotions'

describe('Black Friday promotional arithmetic and catalog', () => {
  it.each([[0, 69900, 41940, 27960], [1, 89900, 44950, 44950], [2, 34900, 13960, 20940]])('calculates product %i entirely in cents', (index, originalCents, priceCents, savingCents) => {
    expect(promotionFor(INITIAL_PRODUCTS[index])).toMatchObject({ originalCents, priceCents, savingCents })
  })
  it('rounds fractional cent discounts once and balances the saving', () => {
    const offer = promotionFor({ ...INITIAL_PRODUCTS[0], price: 1.01 })
    expect(offer.originalCents).toBe(101); expect(offer.priceCents).toBe(61); expect(offer.savingCents).toBe(40)
  })
  it('retains future entries without fabricated discount, stock or popularity', () => {
    const future = { ...INITIAL_PRODUCTS[0], id: 'future', price: 123.45 }
    expect(promotionFor(future)).toMatchObject({ discount: 0, originalCents: 12345, priceCents: 12345, stock: null, popularity: null })
    expect(selectPromotions([...INITIAL_PRODUCTS, future], INITIAL_FILTERS, 'discount')).toHaveLength(4)
  })
  it('combines all four filters', () => {
    expect(selectPromotions(INITIAL_PRODUCTS, { category: 'Áudio conectado', discount: '50plus', flash: true, vip: true }, 'discount').map((p) => p.id)).toEqual(['prod-wave'])
    expect(selectPromotions(INITIAL_PRODUCTS, { category: 'Wearables', discount: '50plus', flash: true, vip: true }, 'discount')).toEqual([])
  })
  it.each([['discount', ['prod-wave', 'prod-pulse', 'prod-orbit']], ['price', ['prod-wave', 'prod-orbit', 'prod-pulse']], ['popular', ['prod-wave', 'prod-orbit', 'prod-pulse']]] as const)('sorts by %s without mutating input', (sort, ids) => {
    expect(selectPromotions(INITIAL_PRODUCTS, INITIAL_FILTERS, sort).map((p) => p.id)).toEqual(ids)
    expect(INITIAL_PRODUCTS[0].id).toBe('prod-orbit')
  })
  it('applies BLACK10 public product minimum and cap, refuses VIP', () => {
    expect(couponSaving(INITIAL_PRODUCTS[0])).toBe(4194)
    expect(couponSaving(INITIAL_PRODUCTS[1])).toBe(0)
    expect(couponSaving({ ...INITIAL_PRODUCTS[0], price: 499.99 })).toBe(0)
    expect(couponSaving({ ...INITIAL_PRODUCTS[0], price: 500 })).toBe(3000)
    expect(couponSaving({ ...INITIAL_PRODUCTS[0], price: 2000 })).toBe(5000)
  })
  it('computes separate VIP combo and refuses missing items', () => {
    expect(comboFor(INITIAL_PRODUCTS)).toEqual({ originalCents: 104800, subtotalCents: 55900, extraSavingCents: 2795, priceCents: 53105, savingCents: 51695, vip: true })
    expect(comboFor(INITIAL_PRODUCTS.slice(0, 2))).toBeNull()
  })
})
