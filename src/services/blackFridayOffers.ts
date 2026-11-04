import { INITIAL_PRODUCTS } from './storeService'
import type { Product } from '../types/store'

export const BLACK_FRIDAY_DEADLINE = '2026-12-01T02:59:59Z'
export const OFFER_CATEGORIES = ['Todos', 'Áudio imersivo', 'Wearables', 'Áudio conectado', 'Combos'] as const
export type OfferCategory = (typeof OFFER_CATEGORIES)[number]
export type OfferSort = 'discount' | 'savings' | 'price'
export type Coupon = { code: 'BF360' | 'VIP10'; percent: number }
export type BlackFridayOffer = {
  id: string
  name: string
  description: string
  category: Exclude<OfferCategory, 'Todos'>
  products: Product[]
  originalCents: number
  promotionalCents: number
  discountPercent: number
  savingsCents: number
  flash: boolean
  lot: string
}

function makeOffer(
  products: Product[],
  discountPercent: number,
  flash: boolean,
  lot: string,
  combo?: { id: string; name: string; description: string },
): BlackFridayOffer {
  const originalCents = products.reduce((sum, product) => sum + Math.round(product.price * 100), 0)
  const promotionalCents = Math.round(originalCents * (100 - discountPercent) / 100)
  return {
    id: combo?.id ?? products[0].id,
    name: combo?.name ?? products[0].name,
    description: combo?.description ?? products[0].description,
    category: combo ? 'Combos' : products[0].category as BlackFridayOffer['category'],
    products,
    originalCents,
    promotionalCents,
    discountPercent,
    savingsCents: originalCents - promotionalCents,
    flash,
    lot,
  }
}

const [orbit, pulse, wave] = INITIAL_PRODUCTS

// Deterministic local campaign: no API, storage, real inventory or checkout.
export const BLACK_FRIDAY_OFFERS: BlackFridayOffer[] = [
  makeOffer([orbit], 30, true, 'BF-01 · 80 unidades ilustrativas'),
  makeOffer([pulse], 25, false, 'BF-02 · 60 unidades ilustrativas'),
  makeOffer([wave], 20, true, 'BF-03 · 100 unidades ilustrativas'),
  makeOffer([orbit, pulse], 40, true, 'BF-04 · 40 kits ilustrativos', {
    id: 'combo-orbit-pulse', name: 'Combo Ritmo & Imersão', description: 'Orbit + Pulse. Seu som, seu ritmo, uma só seleção.',
  }),
  makeOffer([orbit, wave], 35, false, 'BF-05 · 50 kits ilustrativos', {
    id: 'combo-orbit-wave', name: 'Combo Som em Todo Lugar', description: 'Orbit + Wave. Da sua playlist ao próximo encontro.',
  }),
]

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export function formatBRL(cents: number): string {
  return currency.format(cents / 100)
}

export function resolveCoupon(raw: string): Coupon | null {
  const code = raw.trim().toUpperCase()
  if (code === 'BF360') return { code, percent: 5 }
  if (code === 'VIP10') return { code, percent: 10 }
  return null
}

export function filterOffers(category: OfferCategory, flashOnly: boolean, sort: OfferSort): BlackFridayOffer[] {
  return BLACK_FRIDAY_OFFERS.filter((offer) =>
    (category === 'Todos' || category === offer.category) && (!flashOnly || offer.flash),
  ).sort((a, b) => {
    if (sort === 'price') return a.promotionalCents - b.promotionalCents
    if (sort === 'savings') return b.savingsCents - a.savingsCents
    return b.discountPercent - a.discountPercent
  })
}

export function calculateSummary(selectedIds: readonly string[], coupon: Coupon | null) {
  // Filtering the catalog guarantees at most one unit of each offer, even for duplicate ids.
  const offers = BLACK_FRIDAY_OFFERS.filter((offer) => selectedIds.includes(offer.id))
  const originalCents = offers.reduce((sum, offer) => sum + offer.originalCents, 0)
  const subtotalCents = offers.reduce((sum, offer) => sum + offer.promotionalCents, 0)
  const couponDiscountCents = Math.round(subtotalCents * (coupon?.percent ?? 0) / 100)
  const totalCents = subtotalCents - couponDiscountCents
  return { offers, originalCents, subtotalCents, couponDiscountCents, totalCents, savingsCents: originalCents - totalCents }
}

export function getCountdown(now: number) {
  const totalSeconds = Math.max(0, Math.ceil((Date.parse(BLACK_FRIDAY_DEADLINE) - now) / 1000))
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor(totalSeconds / 3600) % 24,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
    ended: totalSeconds === 0,
  }
}
