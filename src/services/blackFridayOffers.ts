export const BLACK_FRIDAY_DEADLINE = '2026-12-01T02:59:59Z'
export const OFFER_CATEGORIES = ['Todos', 'Ingressos/Passaportes', 'Workshops & Cursos', 'Merchandising/Kits', 'Combos'] as const
export type OfferCategory = (typeof OFFER_CATEGORIES)[number]
export type OfferSort = 'discount' | 'savings' | 'price'
export type Coupon = { code: 'PMIDF20' | 'SUMMIT360'; percent: number }
export type BlackFridayOffer = {
  id: string
  name: string
  description: string
  category: Exclude<OfferCategory, 'Todos'>
  benefits: string[]
  badges: string[]
  art: 'passport' | 'workshop' | 'kit' | 'mentoring'
  originalCents: number
  promotionalCents: number
  discountPercent: number
  savingsCents: number
  lot: string
}

function makeOffer(offer: Omit<BlackFridayOffer, 'discountPercent' | 'savingsCents'>): BlackFridayOffer {
  return {
    ...offer,
    discountPercent: Math.round((offer.originalCents - offer.promotionalCents) * 100 / offer.originalCents),
    savingsCents: offer.originalCents - offer.promotionalCents,
  }
}

// Deterministic local campaign: no API, storage, real inventory or checkout.
export const BLACK_FRIDAY_OFFERS: BlackFridayOffer[] = [
  makeOffer({
    id: 'passaporte-vip', name: 'Passaporte VIP PMI Summit DF', category: 'Ingressos/Passaportes', art: 'passport',
    description: 'Dois dias para ampliar sua visão, conectar líderes e transformar projetos em impacto.',
    benefits: ['2 dias de congresso', 'Palestras magnas', 'Networking VIP'],
    badges: ['Acumula PDUs', 'Vagas Limitadas DF'],
    originalCents: 120000, promotionalCents: 84000, lot: 'DF-01 · passaportes ilustrativos',
  }),
  makeOffer({
    id: 'combo-ia-agil', name: 'Combo Credencial + Workshop IA & Métodos Ágeis', category: 'Combos', art: 'workshop',
    description: 'A experiência do congresso encontra a prática: novas ferramentas para liderar a mudança.',
    benefits: ['Credencial para o congresso', 'Workshop IA & Métodos Ágeis', 'Aprendizado com PDUs'],
    badges: ['Acumula PDUs', 'Exclusivo Black Friday'],
    originalCents: 180000, promotionalCents: 108000, lot: 'DF-02 · combos ilustrativos',
  }),
  makeOffer({
    id: 'kit-oficial', name: 'Kit Oficial PMI Summit DF', category: 'Merchandising/Kits', art: 'kit',
    description: 'Uma seleção executiva para acompanhar ideias, encontros e seu próximo grande projeto.',
    benefits: ['Mochila executiva tech', 'Garrafa térmica inteligente', 'Caderno smart', 'Credencial VIP'],
    badges: ['Exclusivo Black Friday'],
    originalCents: 39900, promotionalCents: 29925, lot: 'DF-03 · kits ilustrativos',
  }),
  makeOffer({
    id: 'mentoria-express', name: 'Mentoria Express PMP / Liderança', category: 'Workshops & Cursos', art: 'mentoring',
    description: 'Clareza para seu próximo passo profissional, em uma conversa dedicada aos seus desafios.',
    benefits: ['Mentoria individual', 'Líderes certificados', 'Foco em PMP e liderança'],
    badges: ['Vagas Limitadas DF'],
    originalCents: 65000, promotionalCents: 42250, lot: 'DF-04 · sessões ilustrativas',
  }),
]

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export function formatBRL(cents: number): string {
  return currency.format(cents / 100)
}

export function resolveCoupon(raw: string): Coupon | null {
  const code = raw.trim().toUpperCase()
  if (code === 'PMIDF20') return { code, percent: 20 }
  if (code === 'SUMMIT360') return { code, percent: 15 }
  return null
}

export function filterOffers(category: OfferCategory, sort: OfferSort): BlackFridayOffer[] {
  return BLACK_FRIDAY_OFFERS.filter((offer) =>
    category === 'Todos' || category === offer.category,
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
