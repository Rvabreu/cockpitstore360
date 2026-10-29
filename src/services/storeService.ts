import type { OrderEvent, OrderWithEvents, Product } from '../types/store'
import { csrfFetch } from './authService'

// R3-3: pinned localStorage keys. The API is the source of truth; successful
// responses are mirrored to these keys and read back only when the API fails.
const PRODUCTS_STORAGE_KEY = 'cockpit_store_products_v1'
const ORDER_STORAGE_KEY = 'cockpit_store_order_v1'
const DATA_CHANGE_EVENT = 'cockpit_store_data_change'

const NOT_FOUND_MESSAGE = 'Pedido não localizado neste ambiente de demonstração.'
const FOUND_MESSAGE = 'Pedido CS-2048 encontrado. Os dados exibidos são fictícios.'
const AWAITING_DETAIL = 'Aguardando atualização'

export const SEED_ORDER_ID = 'CS-2048'

// R3-4: ascending createdAt so the catalog renders Orbit, Pulse, Wave in mockup order.
export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-orbit',
    name: 'Orbit Headphones Pro',
    description: 'Som premium para qualquer jornada.',
    category: 'Áudio imersivo',
    price: 699,
    image: '/assets/hero_produtos.svg#orbit',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'prod-pulse',
    name: 'Pulse Watch S2',
    description: 'Seu ritmo, sob controle.',
    category: 'Wearables',
    price: 899,
    image: '/assets/hero_produtos.svg#pulse',
    createdAt: '2026-10-02T10:00:00.000Z',
  },
  {
    id: 'prod-wave',
    name: 'Wave Mini Speaker',
    description: 'Som potente em qualquer lugar.',
    category: 'Áudio conectado',
    price: 349,
    image: '/assets/hero_produtos.svg#wave',
    createdAt: '2026-10-03T10:00:00.000Z',
  },
]

// Raw ordered events for the seed order (titles/details verbatim from the mockup).
export const SEED_ORDER_EVENTS: Array<{ title: string; detail: string }> = [
  { title: 'Pedido confirmado', detail: '19 out · 10h12' },
  { title: 'Em separação', detail: '20 out · 08h35' },
  { title: 'Em transporte', detail: '21 out · 14h20' },
  { title: 'Entregue', detail: 'Entrega confirmada' },
]

/**
 * Build the derived OrderWithEvents shape (status + displayDetail + statusLabel)
 * from the raw order fields. Shared by the seed constant and the offline advance
 * fallback so the derivation never drifts from the server.
 */
export function buildOrderWithEvents(params: {
  id: string
  productId: string
  productName: string
  variant: string
  quantity: number
  total: number
  placedAt: string
  currentStep: number
  events: Array<{ title: string; detail: string }>
}): OrderWithEvents {
  const events: OrderEvent[] = params.events.map((e, i) => ({
    stepIndex: i,
    title: e.title,
    detail: e.detail,
    displayDetail: i <= params.currentStep ? e.detail : AWAITING_DETAIL,
    status: i < params.currentStep ? 'done' : i === params.currentStep ? 'current' : 'pending',
  }))

  return {
    id: params.id,
    productId: params.productId,
    productName: params.productName,
    variant: params.variant,
    quantity: params.quantity,
    total: params.total,
    placedAt: params.placedAt,
    currentStep: params.currentStep,
    statusLabel: events[params.currentStep]?.title ?? '',
    events,
  }
}

// The single seed order, fully renderable so R3-1 can seed React state synchronously.
export const INITIAL_ORDER: OrderWithEvents = buildOrderWithEvents({
  id: SEED_ORDER_ID,
  productId: 'prod-orbit',
  productName: 'Orbit Headphones Pro',
  variant: 'Grafite',
  quantity: 1,
  total: 699,
  placedAt: '19/10/2026',
  currentStep: 1,
  events: SEED_ORDER_EVENTS,
})

// In-memory cache for SSR / fallback.
let inMemoryProducts: Product[] = [...INITIAL_PRODUCTS]
let inMemoryOrder: OrderWithEvents = INITIAL_ORDER

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/* ==================== LocalStorage Fallbacks ==================== */

export function getStoredProducts(): Product[] {
  if (!isBrowser() || typeof window.localStorage === 'undefined') {
    return inMemoryProducts
  }
  try {
    const raw = window.localStorage.getItem(PRODUCTS_STORAGE_KEY)
    if (!raw) {
      window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(INITIAL_PRODUCTS))
      return INITIAL_PRODUCTS
    }
    return JSON.parse(raw) as Product[]
  } catch (e) {
    console.error('Error reading products from localStorage:', e)
    return inMemoryProducts
  }
}

export function saveProducts(products: Product[]): void {
  inMemoryProducts = products
  if (isBrowser() && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products))
      window.dispatchEvent(new Event(DATA_CHANGE_EVENT))
    } catch (e) {
      console.error('Error saving products to localStorage:', e)
    }
  }
}

export function getStoredOrder(): OrderWithEvents {
  if (!isBrowser() || typeof window.localStorage === 'undefined') {
    return inMemoryOrder
  }
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) {
      window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(INITIAL_ORDER))
      return INITIAL_ORDER
    }
    return JSON.parse(raw) as OrderWithEvents
  } catch (e) {
    console.error('Error reading order from localStorage:', e)
    return inMemoryOrder
  }
}

export function saveOrder(order: OrderWithEvents): void {
  inMemoryOrder = order
  if (isBrowser() && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order))
      window.dispatchEvent(new Event(DATA_CHANGE_EVENT))
    } catch (e) {
      console.error('Error saving order to localStorage:', e)
    }
  }
}

/** Normalize a user/path order id: decode, strip leading '#', trim, uppercase. */
export function normalizeOrderId(raw: string): string {
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {
    value = raw
  }
  return value.replace(/^#/, '').trim().toUpperCase()
}

/* ==================== Backend REST API Calls (SQLite Persisted) ==================== */

export async function fetchProductsApi(): Promise<Product[]> {
  try {
    const res = await fetch('/api/products')
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = (await res.json()) as Product[]
    saveProducts(data)
    return data
  } catch (e) {
    console.warn('API /api/products unavailable, using fallback data:', e)
    return getStoredProducts()
  }
}

export async function loadOrderApi(id: string): Promise<OrderWithEvents> {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}`)
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = (await res.json()) as OrderWithEvents
    saveOrder(data)
    return data
  } catch (e) {
    console.warn(`API /api/orders/${id} unavailable, using fallback data:`, e)
    return getStoredOrder()
  }
}

export async function advanceOrderApi(id: string): Promise<OrderWithEvents> {
  try {
    const res = await csrfFetch(`/api/orders/${encodeURIComponent(id)}/advance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = (await res.json()) as OrderWithEvents
    saveOrder(data)
    return data
  } catch (e) {
    console.warn(`API advance ${id} failed, computing next step locally:`, e)
    const current = getStoredOrder()
    const eventCount = current.events.length
    const nextStep = current.currentStep >= eventCount - 1 ? 0 : current.currentStep + 1
    const next = buildOrderWithEvents({
      id: current.id,
      productId: current.productId,
      productName: current.productName,
      variant: current.variant,
      quantity: current.quantity,
      total: current.total,
      placedAt: current.placedAt,
      currentStep: nextStep,
      events: current.events.map((ev) => ({ title: ev.title, detail: ev.detail })),
    })
    saveOrder(next)
    return next
  }
}

/**
 * Validation-only lookup (useStore() contract): never swaps the displayed order,
 * only returns an { ok, message } pair for the search box. The two pt-BR strings
 * are identical whether served by the API or the offline fallback.
 */
export async function getOrder(id: string): Promise<{ ok: boolean; message: string }> {
  const normalized = normalizeOrderId(id)
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(normalized)}`)
    if (res.ok) {
      return { ok: true, message: FOUND_MESSAGE }
    }
    if (res.status === 404) {
      return { ok: false, message: NOT_FOUND_MESSAGE }
    }
    throw new Error(`HTTP error ${res.status}`)
  } catch (e) {
    console.warn(`API lookup ${normalized} failed, using offline validation:`, e)
    if (normalized === SEED_ORDER_ID) {
      return { ok: true, message: FOUND_MESSAGE }
    }
    return { ok: false, message: NOT_FOUND_MESSAGE }
  }
}
