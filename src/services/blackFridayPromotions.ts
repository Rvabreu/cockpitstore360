import type { Product } from '../types/store'

export const CAMPAIGN_END = Date.parse('2026-11-28T03:00:00Z')
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const formatCents = (cents: number) => currency.format(cents / 100)

type Promotion = { discount: number; stock: number | null; total: number | null; vip: boolean; flash: boolean; popularity: number | null; crop: string }
const promotions: Record<string, Promotion> = {
  'prod-orbit': { discount: 40, stock: 18, total: 60, vip: false, flash: true, popularity: 920, crop: '93% 17%' },
  'prod-pulse': { discount: 50, stock: 8, total: 40, vip: true, flash: false, popularity: 780, crop: '59% 75%' },
  'prod-wave': { discount: 60, stock: 12, total: 50, vip: true, flash: true, popularity: 1050, crop: '99% 83%' },
}

export function promotionFor(product: Product) {
  // Future catalog entries remain visible; no invented discount, stock or popularity.
  const offer = promotions[product.id] ?? { discount: 0, stock: null, total: null, vip: false, flash: false, popularity: null, crop: 'center' }
  const originalCents = Math.round(product.price * 100)
  const priceCents = Math.round(originalCents * (100 - offer.discount) / 100)
  return { ...offer, originalCents, priceCents, savingCents: originalCents - priceCents }
}

export type PromotionSort = 'discount' | 'price' | 'popular'
export type PromotionFilters = { category: string; discount: string; flash: boolean; vip: boolean }
export const INITIAL_FILTERS: PromotionFilters = { category: '', discount: '', flash: false, vip: false }
export function selectPromotions(products: Product[], filters: PromotionFilters, sort: PromotionSort) {
  return products.filter((product) => {
    const offer = promotionFor(product)
    return (!filters.category || product.category === filters.category) &&
      (!filters.discount || (filters.discount === 'under50' ? offer.discount < 50 : offer.discount >= 50)) &&
      (!filters.flash || offer.flash) && (!filters.vip || offer.vip)
  }).sort((a, b) => {
    const left = promotionFor(a), right = promotionFor(b)
    const difference = sort === 'price' ? left.priceCents - right.priceCents : sort === 'popular'
      ? (right.popularity ?? -1) - (left.popularity ?? -1) : right.discount - left.discount
    return difference || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id)
  })
}

// BLACK10: one public product, BF subtotal >= R$300, 10%, max R$50; no combos/VIP.
export function couponSaving(product: Product) {
  const offer = promotionFor(product)
  return !offer.vip && offer.priceCents >= 30_000 ? Math.min(5000, Math.round(offer.priceCents * .1)) : 0
}
export const COMBO_IDS = ['prod-orbit', 'prod-wave']
export function comboFor(products: Product[]) {
  const items = COMBO_IDS.map((id) => products.find((product) => product.id === id))
  if (items.some((item) => !item)) return null
  const offers = items.map((item) => promotionFor(item!))
  const subtotalCents = offers.reduce((total, offer) => total + offer.priceCents, 0)
  const originalCents = offers.reduce((total, offer) => total + offer.originalCents, 0)
  const extraSavingCents = Math.round(subtotalCents * .05)
  return { subtotalCents, originalCents, extraSavingCents, priceCents: subtotalCents - extraSavingCents,
    savingCents: originalCents - subtotalCents + extraSavingCents, vip: offers.some((offer) => offer.vip) }
}
